/*
<MODULE_CONTRACT>
<purpose>Generator for lagebild-contracts.types.generated.ts — derives the
Werkstatt-side wire types for the Lagebild ingress contract from the vendored
Verbund spec snapshot (PLAN-RFC-1238-01, RFC-1238/AMD-WERKSTATT-02 delivered).
Reads the YAML schemas byte-exact from docs/specs/ and emits TypeScript
interfaces; never reads the Lagebild repository (VID-001) and never patches
snapshots (VID-014).</purpose>
<non-goals>
  <item>Not a generic JSON Schema to TypeScript mapper — it covers exactly the
  constructs the Verbund schemas use (object, enum, const, oneOf/anyOf, $ref,
  type:[X,"null"], arrays) and fails loudly on anything else so a schema
  change can never silently mis-derive.</item>
  <item>Does not generate the client-side input/result types
  (IngressSubmitInput, IngressResult, LagebildIngressConfig) — those are
  Werkstatt-internal, not contract surfaces.</item>
</non-goals>
</MODULE_CONTRACT>
*/

// Run: pnpm --filter @warpgogol/werkstatt-shared exec node \
//   src/integration/codegen/verbund-contract-types.ts
// (Node 24 type-stripping — no tsx dependency.)

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

// VID-011 pin — bump when a newer verbund-integration-spec snapshot is
// vendored, then regenerate.
const SPEC_VERSION = "verbund-integration-spec-v0.1.3";

const SPECS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../docs/specs");
const SCHEMAS_DIR = join(SPECS_ROOT, SPEC_VERSION, "schemas");
const OUT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lagebild-contracts.types.generated.ts",
);

// The egress closure of website-ingress.schema.yaml, in dependency order.
const SCHEMA_FILES = [
  "process-hint.schema.yaml",
  "acquisition-context.schema.yaml",
  "website-ingress.schema.yaml",
] as const;

// Canonical type names per schema file (kept stable for lagebild-ingress.ts
// re-exports and adapter call sites).
const ROOT_NAMES: Record<string, string> = {
  "process-hint.schema.yaml": "IngressProcessHint",
  "acquisition-context.schema.yaml": "AcquisitionContext",
  "website-ingress.schema.yaml": "WebsiteIngressPayload",
};

// Nested object/enum constructs get names via this path map — anything not
// listed here makes the generator throw instead of inventing names.
const NESTED_NAMES: Record<string, string> = {
  "website-ingress.identity_claims.items": "IdentityClaim",
  "website-ingress.identity_claims.items.claim_type": "IdentityClaimType",
  "website-ingress.origin": "IngressOrigin",
  "website-ingress.explicit_policy_assertions.items": "ExplicitPolicyAssertion",
  "website-ingress.explicit_policy_assertions.items.kind": "PolicyAssertionKind",
  "website-ingress.attribution": "IngressAttribution",
  "website-ingress.interaction_kind": "IngressInteractionKind",
  "process-hint.system": "IngressProcessHintSystem",
};

interface Emitted {
  name: string;
  jsdoc: string[];
  body: string[];
}

const emitted: Emitted[] = [];
const emittedNames = new Set<string>();

type Schema = Record<string, unknown>;

function jsdoc(text: unknown): string[] {
  return typeof text === "string" && text.trim() !== ""
    ? [`/** ${text.trim().replace(/\s+/g, " ")} */`]
    : [];
}

function schemaBasename(ref: string): string {
  return ref.replace(/^\.\//, "");
}

function rootName(file: string): string {
  const name = ROOT_NAMES[file];
  if (!name) throw new Error(`no ROOT_NAMES entry for ${file} — extend the generator`);
  return name;
}

function shortPath(path: string): string {
  return path.replace(/\.schema\.yaml$/, "");
}

// Resolve a $ref to a named type, lazily emitting the target schema first.
function emitRef(ref: string, schemas: Map<string, Schema>): string {
  const file = schemaBasename(ref);
  const name = rootName(file);
  if (!emittedNames.has(name)) {
    const schema = schemas.get(file);
    if (!schema) throw new Error(`unresolvable $ref ${ref} — file not in SCHEMA_FILES`);
    emitRoot(file, schema, schemas);
  }
  return name;
}

// Union member or leaf: returns a TS type expression.
function tsType(node: Schema, path: string, schemas: Map<string, Schema>): string {
  if (typeof node["const"] !== "undefined") return JSON.stringify(node["const"]);
  if (Array.isArray(node["enum"])) {
    return (node["enum"] as unknown[]).map((v) => JSON.stringify(v)).join(" | ");
  }
  if (typeof node["$ref"] === "string") return emitRef(node["$ref"], schemas);
  if (Array.isArray(node["oneOf"]) || Array.isArray(node["anyOf"])) {
    const members = (node["oneOf"] ?? node["anyOf"]) as Schema[];
    return members.map((m) => tsType(m, path, schemas)).join(" | ");
  }

  const t = node["type"];
  if (Array.isArray(t)) {
    return t.map((member) => tsType({ ...node, type: member }, path, schemas)).join(" | ");
  }
  switch (t) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "number":
    case "integer":
      return "number";
    case "null":
      return "null";
    case "array":
      return `readonly ${tsType(node["items"] as Schema, `${path}.items`, schemas)}[]`;
    case "object": {
      if (!node["properties"]) return "Record<string, unknown>";
      const name = NESTED_NAMES[path];
      if (!name) {
        throw new Error(
          `anonymous object at ${path} — add a NESTED_NAMES entry (schema changed; regenerate deliberately)`,
        );
      }
      emitInterface(name, node, path, schemas);
      return name;
    }
    default:
      throw new Error(`unsupported schema construct at ${path}: ${JSON.stringify(node)}`);
  }
}

function emitInterface(
  name: string,
  schema: Schema,
  path: string,
  schemas: Map<string, Schema>,
): void {
  if (emittedNames.has(name)) return;
  emittedNames.add(name);
  const required = new Set((schema["required"] as string[] | undefined) ?? []);
  const props = (schema["properties"] as Record<string, Schema> | undefined) ?? {};
  const body: string[] = [`export interface ${name} {`];
  for (const [key, propSchema] of Object.entries(props)) {
    // Enums on the wire get named union types via NESTED_NAMES.
    let typeExpr: string;
    const enumPath = `${path}.${key}`;
    if (Array.isArray(propSchema["enum"]) && NESTED_NAMES[enumPath]) {
      const enumName = NESTED_NAMES[enumPath];
      emitEnum(enumName, propSchema);
      typeExpr = enumName;
    } else {
      typeExpr = tsType(propSchema, enumPath, schemas);
    }
    body.push(...jsdoc(propSchema["description"]).map((l) => `  ${l}`));
    body.push(`  readonly ${key}${required.has(key) ? "" : "?"}: ${typeExpr};`);
  }
  body.push("}");
  emitted.push({ name, jsdoc: jsdoc(schema["description"]), body });
}

function emitEnum(name: string, schema: Schema): void {
  if (emittedNames.has(name)) return;
  emittedNames.add(name);
  const members = (schema["enum"] as unknown[]).map((v) => JSON.stringify(v)).join(" | ");
  emitted.push({
    name,
    jsdoc: jsdoc(schema["description"]),
    body: [`export type ${name} = ${members};`],
  });
}

function emitRoot(file: string, schema: Schema, schemas: Map<string, Schema>): void {
  emitInterface(rootName(file), schema, shortPath(file), schemas);
}

// --- load schemas -----------------------------------------------------------

const schemas = new Map<string, Schema>();
const hash = createHash("sha256");
for (const file of SCHEMA_FILES) {
  const bytes = readFileSync(join(SCHEMAS_DIR, file));
  hash.update(bytes);
  schemas.set(file, parseYaml(bytes.toString("utf8")) as Schema);
}
const sourceHash = hash.digest("hex");

// --- emit -------------------------------------------------------------------

for (const file of SCHEMA_FILES) {
  emitRoot(file, schemas.get(file)!, schemas);
}

const header = [
  "// GENERATED. Do not change this line unless the file contains project specific changes.",
  "// DO NOT EDIT THIS FILE. Changes are overwritten on the next build.",
  "// Owner command: verbund.contract.types.generate",
  "// Edit instead: packages/werkstatt-shared/src/integration/codegen/verbund-contract-types.ts",
  "// Regenerate:   pnpm --filter @warpgogol/werkstatt-shared exec node src/integration/codegen/verbund-contract-types.ts",
  `// sourceHash: ${sourceHash}`,
  `// Source: docs/specs/${SPEC_VERSION}/schemas/{${SCHEMA_FILES.map((f) => f.replace(/\.schema\.yaml$/, "")).join(",")}}.schema.yaml`,
  "// Generated by: PLAN-RFC-1238-01 (RFC-1238) — types derived byte-exact from the vendored Verbund contract. Do not hand-edit.",
  "",
].join("\n");

const output = header + emitted.map((e) => [...e.jsdoc, ...e.body].join("\n")).join("\n\n") + "\n";

writeFileSync(OUT_FILE, output);
console.log(`wrote ${OUT_FILE} (${emitted.length} types, sourceHash ${sourceHash.slice(0, 12)}…)`);
