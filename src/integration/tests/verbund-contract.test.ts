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
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import { funnelPayloadToProcessHint } from "../lagebild-destination-adapter.ts";
import { captureAcquisition, readAcquisition } from "../acquisition.ts";
import type { WebsiteIngressPayload } from "../lagebild-contracts.types.generated.ts";

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

// VID-011 pin for the derived types (PLAN-RFC-1238-01) — the newest vendored
// snapshot; bump alongside codegen/verbund-contract-types.ts SPEC_VERSION.
const PIN = "verbund-integration-spec-v0.1.4";
const GENERATED_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lagebild-contracts.types.generated.ts",
);
const GENERATED_SCHEMA_FILES = [
  "process-hint.schema.yaml",
  "acquisition-context.schema.yaml",
  "website-ingress.schema.yaml",
] as const;

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

  // RFC-1241 (V05): the block the capture/read path actually produces must
  // validate against acquisition-context.schema.yaml on every snapshot that
  // ships it (v0.1.3+) — producer and contract drift-check in the same suite.
  if (schemaIds.has("schemas/acquisition-context.schema.yaml")) {
    test(`${specId}: emitted acquisition validates against vendored schema (RFC-1241)`, () => {
      const data: Record<string, string> = {};
      const storage = {
        getItem: (k: string) => data[k] ?? null,
        setItem: (k: string, v: string) => {
          data[k] = v;
        },
      };
      captureAcquisition(
        "?utm_source=meta&utm_medium=paid_social&utm_campaign=sit001-bw-v1&utm_id=exp_01",
        storage,
      );
      const block = readAcquisition(storage);
      expect(block, "UTM-tagged landing must produce an acquisition block").toBeDefined();

      const schemaId = schemaIds.get("schemas/acquisition-context.schema.yaml");
      const validate = schemaId ? ajv.getSchema(schemaId) : undefined;
      expect(validate).toBeDefined();
      expect(
        validate!(block),
        `emitted acquisition failed ${specId} schema: ` +
          `${JSON.stringify(validate!.errors)} — the producer drifted from the ` +
          `vendored contract; fix acquisition.ts, never patch the snapshot`,
      ).toBe(true);
    });
  }

  // PLAN-RFC-1238-01: two payload assertions against the website-ingress
  // schema where the snapshot ships one (v0.1.2+, AMD-WERKSTATT-02):
  //  a) the surface the adapter actually emits validates on every snapshot —
  //     wire conformance of what we really send;
  //  b) the full derived-type surface (incl. acquisition, which arrived in
  //     v0.1.3) validates only on the PIN — older snapshots legitimately
  //     reject superset fields via additionalProperties: false.
  const ingressSchemaId = schemaIds.get("schemas/website-ingress.schema.yaml");
  if (ingressSchemaId) {
    test(`${specId}: emitted-surface ingress payload validates against website-ingress schema`, () => {
      const payload: WebsiteIngressPayload = {
        contract_version: 1,
        tenant_id: "ten_warpgogol000001",
        source_system_id: "site_warpgogol_main",
        submission_id: "sub_0123456789abcdef",
        idempotency_key: "ten_warpgogol000001:sub_0123456789abcdef",
        occurred_at: "2026-10-08T10:00:00.000Z",
        interaction_kind: "other",
        identity_claims: [
          { claim_type: "email", value: "client@example.test", label: "contact" },
          { claim_type: "other", value: { channel: "telegram", handle: "@client" } },
        ],
        message: "hello",
        origin: { page_uri: "https://warpgogol.example/form", referrer_uri: null, locale: "de" },
        explicit_policy_assertions: [
          {
            kind: "consent",
            purpose: "contact",
            channel: "email",
            value: true,
            statement_ref: null,
          },
        ],
        correlation_id: "corr_0001",
        referral_partner_slug: "partner-slug",
        referral_partner_name: "Partner Name",
        partner_mode: "referral-fee",
        policy_effective_from: "2026-01-01",
        captured_at: "2026-10-08T09:55:00.000Z",
        disclosure_version: "v1",
        process_hint: funnelPayloadToProcessHint(
          {
            funnelVersion: "1.0.0",
            eventKind: "qualification.answered",
            stage: "qualification_company",
            previousStage: "qualification_priority",
          },
          "2026-10-08T10:00:00.000Z",
        )!,
        // RFC-1241: the adapter now emits acquisition — include it on the
        // emitted surface where the snapshot ships the schema (v0.1.3+);
        // earlier snapshots legitimately lack it.
        ...(schemaIds.has("schemas/acquisition-context.schema.yaml")
          ? {
              acquisition: {
                schema: "acquisition-context/v1" as const,
                utm_source: "meta",
                utm_medium: "paid_social",
                utm_campaign: "sit001-bw-v1",
                utm_term: "-",
                utm_content: "cre_b3d8e2f1",
                utm_id: "exp_7f2a91c4",
              },
            }
          : {}),
      };
      const validate = ajv.getSchema(ingressSchemaId)!;
      expect(
        validate(payload),
        `emitted ingress surface failed ${specId} website-ingress schema: ` +
          `${JSON.stringify(validate.errors)} — the wire shape drifted from ` +
          `the vendored contract; fix the adapter, never patch the snapshot`,
      ).toBe(true);
    });
  }

  if (specId === PIN && ingressSchemaId) {
    test(`${specId}: full derived-type surface validates on the pinned snapshot`, () => {
      const payload: WebsiteIngressPayload = {
        contract_version: 1,
        tenant_id: "ten_warpgogol000001",
        source_system_id: "site_warpgogol_main",
        submission_id: "sub_0123456789abcdef",
        idempotency_key: "ten_warpgogol000001:sub_0123456789abcdef",
        occurred_at: "2026-10-08T10:00:00.000Z",
        interaction_kind: "other",
        identity_claims: [
          { claim_type: "email", value: "client@example.test", label: "contact" },
          { claim_type: "other", value: { channel: "telegram", handle: "@client" } },
        ],
        message: "hello",
        origin: { page_uri: "https://warpgogol.example/form", referrer_uri: null, locale: "de" },
        acquisition_refs: ["campaign-2026-q4"],
        explicit_policy_assertions: [
          {
            kind: "consent",
            purpose: "contact",
            channel: "email",
            value: true,
            statement_ref: null,
          },
        ],
        correlation_id: "corr_0001",
        attribution: { referral_code: "LEGACY42", first_touch_at: "2026-10-01T09:00:00.000Z" },
        referral_partner_slug: "partner-slug",
        referral_partner_name: "Partner Name",
        partner_mode: "referral-fee",
        policy_effective_from: "2026-01-01",
        captured_at: "2026-10-08T09:55:00.000Z",
        disclosure_version: "v1",
        process_hint: funnelPayloadToProcessHint(
          {
            funnelVersion: "1.0.0",
            eventKind: "qualification.answered",
            stage: "qualification_company",
            previousStage: "qualification_priority",
          },
          "2026-10-08T10:00:00.000Z",
        )!,
        acquisition: {
          schema: "acquisition-context/v1",
          utm_source: "newsletter",
          utm_medium: "email",
          utm_campaign: "launch-2026",
          utm_id: "cmp_0001",
          utm_content: "cta-button",
          utm_term: "studio",
        },
      };
      const validate = ajv.getSchema(ingressSchemaId)!;
      expect(
        validate(payload),
        `full ingress payload failed ${specId} website-ingress schema: ` +
          `${JSON.stringify(validate.errors)} — the derived types or the ` +
          `emitted wire shape drifted from the vendored contract`,
      ).toBe(true);
    });
  }
}

// Drift gate (PLAN-RFC-1238-01): lagebild-contracts.types.generated.ts must be
// regenerated whenever the pinned schema bytes change — the sourceHash marker
// in its header is the only guard, so it is checked here alongside the schemas.
test("lagebild-contracts.types.generated.ts is in sync with the pinned vendored schemas (drift gate)", () => {
  const generated = readFileSync(GENERATED_FILE, "utf8");
  const markerMatch = generated.match(/^\/\/ sourceHash: ([0-9a-f]{64})$/m);
  expect(
    markerMatch,
    "generated types file is missing the sourceHash marker — regenerate via " +
      "pnpm --filter @warpgogol/werkstatt-shared exec node src/integration/codegen/verbund-contract-types.ts",
  ).toBeTruthy();

  const hash = createHash("sha256");
  for (const file of GENERATED_SCHEMA_FILES) {
    const path = join(SPECS_ROOT, PIN, "schemas", file);
    expect(existsSync(path), `pinned schema missing: ${path}`).toBe(true);
    hash.update(readFileSync(path));
  }
  expect(
    markerMatch![1],
    `vendored ${PIN} schema bytes changed — regenerate the derived types ` +
      `and update codegen/verbund-contract-types.ts if the construct set grew`,
  ).toBe(hash.digest("hex"));
});
