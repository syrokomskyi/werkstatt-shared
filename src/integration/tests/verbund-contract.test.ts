/*
<MODULE_CONTRACT>
<purpose>Verbund contract conformance tests (VID-013). Loads the golden
fixtures from every vendored spec snapshot (docs/specs/verbund-integration-spec-*)
and validates each against its declared JSON Schema. Replaces shared runtime
code as the conformance mechanism — shared code with Lagebild is forbidden
(VID-001).</purpose>
<non-goals>
  <item>Do not read schemas or fixtures from the Lagebild repository — only
  the vendored snapshots are authoritative (VID-011 pins are per package).</item>
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
import { funnelPayloadToProcessHint } from "../lagebild-destination-adapter.ts";

// VID-013: fixtures are validated byte-exact from the vendored snapshots.
// Resolved via import.meta.url — never process.cwd() (DNA-105).
const SPECS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../docs/specs");

interface FixtureMeta {
  file: string;
  schemaPath: string;
  expect: string;
  payload: unknown;
}

function loadFixture(fixturesDir: string, file: string): FixtureMeta {
  const raw = readFileSync(join(fixturesDir, file), "utf8");
  const payload = parseYaml(raw) as Record<string, unknown>;
  const schemaMatch = raw.match(/^# fixture-for:\s*(\S+)/m);
  const expectMatch = raw.match(/^# expect:\s*(\w+)/m);
  // Some v0.1.1 fixtures (policy-assert.*) ship without the header comments;
  // fall back to the payload's own `schema` discriminator ("policy-assert/v1"
  // → schemas/policy-assert.schema.yaml). Header still wins when present.
  const schemaField = typeof payload?.["schema"] === "string" ? payload["schema"] : undefined;
  const derived = schemaField?.replace(/\/v\d+$/, "");
  const schemaPath = schemaMatch?.[1] ?? (derived ? `schemas/${derived}.schema.yaml` : undefined);
  const expect_ = expectMatch?.[1] ?? "valid";
  if (!schemaPath) {
    throw new Error(
      `fixture ${file} declares no schema — no "# fixture-for:" header and ` +
        `no top-level "schema" field. That is a packaging defect; file an ` +
        `amendment instead of guessing.`,
    );
  }
  return { file, schemaPath, expect: expect_, payload };
}

function buildAjv(schemasDir: string): { ajv: Ajv2020; schemaIds: Map<string, string> } {
  // validateFormats: false — `format` keywords (date-time, uri) are annotations
  // only; ajv-formats is intentionally not a dependency of this package.
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  // Register every vendored schema under its $id. Relative $refs
  // (e.g. "./party-ref.schema.yaml" inside verbund-event) resolve against the
  // referrer's $id namespace — but the publisher only bumps $ids of changed
  // schemas, so a v0.1.2 schema can reference a file whose $id still says
  // v0.1.1. Alias every schema as <namespace>/<filename> for each namespace
  // present in the snapshot (file-location semantics); a ref to a file that
  // does not exist still fails, so this masks nothing.
  const schemaIds = new Map<string, string>();
  const schemas: { file: string; schema: { $id: string } }[] = [];
  for (const file of readdirSync(schemasDir).filter((f) => f.endsWith(".yaml"))) {
    const schema = parseYaml(readFileSync(join(schemasDir, file), "utf8")) as { $id: string };
    schemas.push({ file, schema });
    schemaIds.set(`schemas/${file}`, schema.$id);
  }
  const namespaces = new Set(
    schemas.map(({ schema }) => schema.$id.split("/").slice(0, -1).join("/")),
  );
  for (const { file, schema } of schemas) {
    ajv.addSchema(schema);
    for (const ns of namespaces) {
      const alias = `${ns}/${file}`;
      if (alias !== schema.$id && !schemaIds.has(alias)) {
        ajv.addSchema(schema, alias);
      }
    }
  }
  return { ajv, schemaIds };
}

// One validator per vendored snapshot — schema $ids may collide across
// spec versions, so packages never share an Ajv instance.
const specDirs = readdirSync(SPECS_ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.startsWith("verbund-integration-spec-"))
  .map((e) => e.name)
  .sort();

expect(
  specDirs.length,
  "no vendored verbund spec snapshots found under docs/specs/ — run fo-spec-ingest",
).toBeGreaterThan(0);

for (const specId of specDirs) {
  const specDir = join(SPECS_ROOT, specId);
  const schemasDir = join(specDir, "schemas");
  const fixturesDir = join(specDir, "fixtures");
  const fixtureFiles = readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".yaml"))
    .sort();
  const fixtures = fixtureFiles.map((f) => loadFixture(fixturesDir, f));
  const { ajv, schemaIds } = buildAjv(schemasDir);

  test(`${specId}: snapshot ships a golden fixture for every payload schema (VID-013)`, () => {
    const schemaFiles = readdirSync(schemasDir).filter((f) => f.endsWith(".yaml"));
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
    test(`${specId}: fixture ${fixture.file} validates against ${fixture.schemaPath}`, () => {
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
          `vendored fixture ${specId}/fixtures/${fixture.file} failed ` +
            `${fixture.schemaPath}: ${JSON.stringify(validate.errors)}. ` +
            `If this fixture passes in Lagebild, this is a contract defect — ` +
            `file an amendment under docs/specs/${specId}/amendments/ targeting ` +
            `the fixture; never patch the snapshot.`,
        ).toBe(true);
      } else {
        expect(valid).toBe(false);
      }
    });
  }

  test(`${specId}: werkstatt-facing fixtures prove the surface (party-ref + process-hint)`, () => {
    // The fixtures the V01 handoff names explicitly. The generic loop above
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

  // RFC-1239 (V04, H02): the hint the adapter emits must validate against the
  // vendored schema of EVERY pinned snapshot — the producer and the contract
  // drift-check live in the same suite.
  test(`${specId}: emitted process_hint validates against vendored schema (RFC-1239)`, () => {
    const hint = funnelPayloadToProcessHint(
      {
        funnelVersion: "1.0.0",
        eventKind: "qualification.answered",
        stage: "qualification_company",
        previousStage: "qualification_priority",
      },
      "2026-10-08T10:00:00.000Z",
    );
    expect(hint, "funnel transition must produce a process_hint").toBeDefined();

    const schemaId = schemaIds.get("schemas/process-hint.schema.yaml");
    const validate = schemaId ? ajv.getSchema(schemaId) : undefined;
    expect(validate, `${specId} ships no process-hint schema`).toBeDefined();
    expect(
      validate!(hint),
      `emitted process_hint failed ${specId} schema: ` +
        `${JSON.stringify(validate!.errors)} — the producer drifted from the ` +
        `vendored contract; fix the adapter, never patch the snapshot`,
    ).toBe(true);
  });
}
