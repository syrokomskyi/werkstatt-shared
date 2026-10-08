/*
<MODULE_CONTRACT>
<purpose>Verbund contract conformance tests (VID-013). Loads the golden
fixtures from the vendored spec snapshot (docs/specs/verbund-integration-spec-v0.1.0)
and validates each against its declared JSON Schema. Replaces shared runtime
code as the conformance mechanism — shared code with Lagebild is forbidden
(VID-001).</purpose>
<non-goals>
  <item>Do not read schemas or fixtures from the Lagebild repository — only
  the vendored snapshot is authoritative (VID-011 pin).</item>
  <item>Do not send anything to Lagebild — these tests perform no network IO.</item>
</non-goals>
</MODULE_CONTRACT>
*/

import { test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";

// VID-013: fixtures are validated byte-exact from the vendored snapshot.
// Resolved via import.meta.url — never process.cwd() (DNA-105).
const SPEC_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../docs/specs/verbund-integration-spec-v0.1.0",
);
const SCHEMAS_DIR = join(SPEC_DIR, "schemas");
const FIXTURES_DIR = join(SPEC_DIR, "fixtures");

interface FixtureMeta {
  file: string;
  schemaPath: string;
  expect: string;
  payload: unknown;
}

function loadFixture(file: string): FixtureMeta {
  const raw = readFileSync(join(FIXTURES_DIR, file), "utf8");
  const schemaMatch = raw.match(/^# fixture-for:\s*(\S+)/m);
  const expectMatch = raw.match(/^# expect:\s*(\w+)/m);
  if (!schemaMatch || !expectMatch) {
    throw new Error(
      `fixture ${file} lacks "# fixture-for:" or "# expect:" header — ` +
        `every golden fixture must declare its schema and expectation`,
    );
  }
  return {
    file,
    schemaPath: schemaMatch[1]!,
    expect: expectMatch[1]!,
    payload: parseYaml(raw),
  };
}

function buildAjv(): { ajv: Ajv2020; schemaIds: Map<string, string> } {
  // validateFormats: false — `format` keywords (date-time, uri) are annotations
  // only; ajv-formats is intentionally not a dependency of this package.
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  // Register every vendored schema under its $id so relative $refs
  // (e.g. "./party-ref.schema.yaml" inside verbund-event) resolve.
  const schemaIds = new Map<string, string>();
  for (const file of readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".yaml"))) {
    const schema = parseYaml(readFileSync(join(SCHEMAS_DIR, file), "utf8")) as { $id: string };
    ajv.addSchema(schema);
    schemaIds.set(`schemas/${file}`, schema.$id);
  }
  return { ajv, schemaIds };
}

const fixtureFiles = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".yaml"))
  .sort();
const fixtures = fixtureFiles.map(loadFixture);
const { ajv, schemaIds } = buildAjv();

test("vendored snapshot ships a golden fixture for every payload schema (VID-013)", () => {
  const schemaFiles = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".yaml"));
  for (const schemaFile of schemaFiles) {
    const covered = fixtures.some((f) => f.schemaPath === `schemas/${schemaFile}`);
    expect(
      covered,
      `schema ${schemaFile} has no golden fixture — VID-013 requires every ` +
        `payload schema to ship at least one example in fixtures/`,
    ).toBe(true);
  }
});

for (const fixture of fixtures) {
  test(`fixture ${fixture.file} validates against ${fixture.schemaPath}`, () => {
    const schemaId = schemaIds.get(fixture.schemaPath);
    const validate = schemaId ? ajv.getSchema(schemaId) : undefined;
    expect(
      validate,
      `fixture ${fixture.file} points at ${fixture.schemaPath} which is not ` +
        `registered in schemas/ — check the fixture-for header against the ` +
        `vendored schema files`,
    ).toBeDefined();
    const valid = validate!(fixture.payload);

    if (fixture.expect === "valid") {
      expect(
        valid,
        `vendored fixture ${fixture.file} failed ${fixture.schemaPath}: ` +
          `${JSON.stringify(validate.errors)}. If this fixture passes in ` +
          `Lagebild, this is a contract defect — file an amendment under ` +
          `docs/specs/verbund-integration-spec-v0.1.0/amendments/ targeting ` +
          `the fixture; never patch the snapshot.`,
      ).toBe(true);
    } else {
      expect(valid).toBe(false);
    }
  });
}

test("werkstatt-facing fixtures prove the V01 surface (party-ref + process-hint)", () => {
  // The two fixtures the V01 handoff names explicitly. The generic loop above
  // already covers them; this test documents which ones bind Werkstatt's side.
  const names = fixtures.map((f) => f.file);
  expect(names).toContain("party-ref.studio-client.yaml");
  expect(names).toContain("process-hint.funnel-stage.yaml");

  const hint = fixtures.find((f) => f.file === "process-hint.funnel-stage.yaml");
  const payload = hint!.payload as Record<string, unknown>;
  // H02: Werkstatt owns the funnel catalog; the hub must never interpret it.
  expect(payload["system"]).toBe("werkstatt");
  expect(payload["catalog_ref"]).toBe("werkstatt:visitor-funnel/v1");
});
