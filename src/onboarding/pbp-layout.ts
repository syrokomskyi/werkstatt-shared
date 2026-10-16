/*
<MODULE_CONTRACT>
<purpose>Canonical on-disk layout and serialization of PBP documents under
src/content/business-profile/<locale>/ — the single type→directory map and the
deterministic frontmatter writer shared by sternsystem.register --intake seeding
and the Nachweis I/O helpers (RFC-1307).</purpose>
<non-goals>
  <item>Do not validate entity shape — callers parse with pbpSchemaById before serializing (DNA-103).</item>
  <item>Do not read or write files; this module only computes paths and bytes.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>One map for every writer: register seeding and nachweis resolve the same directory per entity type, so a content reference like business-profile.trust/claims/<slug> means the same file everywhere.</item>
  <item>Singleton entity types (business, legal-identity, brand) are type-named files — canonical readers (semantic-loader, rfc-0483 migrator, wikidata) and business-profile.* refs all address organization/&lt;type&gt;.md; the id slug is only used by collection types.</item>
  <item>Serialization is independent of input key order: envelope keys first in fixed order, every other mapping key sorted lexicographically at every depth (DNA-58).</item>
  <item>YAML quoting follows RFC-0493 — plain scalars by default, double quotes when required, never single quotes; no line folding.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1307: introduce shared PBP layout map and canonical PBP document writer.</item>
  <item>RFC-1307: step 1 — shared PBP layout map, canonical writer, typed onboarding state</item>
  <item>RFC-1307: canonical org-singleton PBP paths, seeded hreflang+publication.gate, full rollback</item>
</CHANGE_SUMMARY>
*/

import YAML from "yaml";

/**
 * Entity type → directory below `business-profile/<locale>/`.
 * `""` means the document lives at the locale root (`business.md`).
 * Covers every `INTAKE_PBP_SCHEMA_ALLOWLIST` type plus `consent` (Nachweis).
 */
export const PBP_ENTITY_DIR_MAP: Readonly<Record<string, string>> = Object.freeze({
  business: "",
  "legal-identity": "organization",
  brand: "organization",
  "contact-point": "contact",
  offering: "offerings",
  claim: "trust/claims",
  "evidence-source": "trust/evidence",
  disclosure: "trust/disclosures",
  consent: "trust/consents",
});

/** Envelope keys emitted first, in this order; everything else is lexicographic. */
export const PBP_ENVELOPE_KEY_ORDER = ["schema", "id", "type", "status", "name"] as const;

/**
 * Types with exactly one document per locale — the file is named after the
 * type, never the entity id: root `business.md`, `organization/legal-identity.md`,
 * `organization/brand.md`. Collection types take the id slug instead
 * (`trust/claims/<slug>.md`).
 */
export const PBP_SINGLETON_TYPES: ReadonlySet<string> = new Set([
  "business",
  "legal-identity",
  "brand",
]);

/**
 * Directory (relative to `business-profile/<locale>/`) for an entity type.
 * Unknown types fall back to the type name itself — the Nachweis behaviour
 * before the map was shared.
 */
export function pbpEntityDir(entityType: string): string {
  return PBP_ENTITY_DIR_MAP[entityType] ?? entityType;
}

/**
 * Slug of a PBP entity id: the segment after the last `/` (`claim/european-quality`
 * → `european-quality`). Ids without `/` are their own slug. Throws when the
 * derived slug is not a kebab-case filename token — a malformed id must fail
 * at plan time, not land as an unresolvable file name.
 */
export function pbpEntitySlug(entityId: string): string {
  const slash = entityId.lastIndexOf("/");
  const slug = slash === -1 ? entityId : entityId.slice(slash + 1);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(
      `[pbp-layout] entity id '${entityId}' does not yield a kebab-case slug ('${slug}')`,
    );
  }
  return slug;
}

/**
 * Path of a PBP document relative to `src/content/business-profile/`, using
 * POSIX separators: `<locale>/<dir>/<slug>.md` for collection types,
 * `<locale>/<dir>/<type>.md` for singleton types (see PBP_SINGLETON_TYPES).
 */
export function pbpDocumentPath(locale: string, entity: { type: string; id: string }): string {
  const dir = pbpEntityDir(entity.type);
  const base = PBP_SINGLETON_TYPES.has(entity.type) ? entity.type : pbpEntitySlug(entity.id);
  return dir === "" ? `${locale}/${base}.md` : `${locale}/${dir}/${base}.md`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    out[key] = sortDeep(value[key]);
  }
  return out;
}

/** Reorder an entity: envelope keys first (fixed order), the rest sorted at every depth. */
export function canonicalizePbpEntity(entity: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PBP_ENVELOPE_KEY_ORDER) {
    if (entity[key] !== undefined) out[key] = sortDeep(entity[key]);
  }
  for (const key of Object.keys(entity).sort()) {
    if ((PBP_ENVELOPE_KEY_ORDER as readonly string[]).includes(key)) continue;
    if (entity[key] === undefined) continue;
    out[key] = sortDeep(entity[key]);
  }
  return out;
}

/**
 * Serialize a (schema-parsed) PBP entity as a frontmatter-only markdown
 * document. Output bytes depend only on the entity's content, never on the
 * key order it arrived in.
 */
export function serializePbpDocument(entity: Record<string, unknown>): string {
  const yaml = YAML.stringify(canonicalizePbpEntity(entity), {
    lineWidth: 0,
    singleQuote: false,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  });
  return `---\n${yaml}---\n`;
}
