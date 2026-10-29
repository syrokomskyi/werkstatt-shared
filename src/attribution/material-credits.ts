/*
<MODULE_CONTRACT>
<purpose>
  RFC-0220 Material Credits helpers shared by UI and Site OS commands. Parses sidecar
  YAML records, resolves localized/default-language fallback, and builds simple
  schema.org CreativeWork-style payloads from the same structured source.
</purpose>
<non-goals>
  <item>Do not scan the filesystem; callers supply raw sidecar maps.</item>
  <item>Do not render UI; @warpgogol/werkstatt-site/ui owns presentation.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0220: initial helper surface for material credit sidecars.</item>
  <item>RFC-0227: buildMaterialCreditJsonLd emits @id for page-graph linking.</item>
  <item>RFC-1426: shared credits-page projection in werkstatt-shared, both renderers consume it

isMaterialCreditPageVisible (placeholder or display:hidden -> not on page) in
attribution-display beside the RFC-0231 resolver it amends; selectCreditsPageRecords
owns selection + visibility + materialTargetKey order. service.ts call sites and
credits-gallery switch to it; both selectLocalized copies and the barrel re-export
retired. material.credits.validate gains PAGE-HIDDEN-REFERENCED advisory (rules[]
registered), report gains pageVisible per record. AGENTS.template documents the
page-visibility rule.</item>
</CHANGE_SUMMARY>
*/

import { parse as parseYaml } from "yaml";
import { isMaterialCreditPageVisible } from "./attribution-display.ts";
import {
  type MaterialCredit,
  type MaterialCreditLabels,
  type MaterialKind,
  type MaterialTarget,
  materialCreditSchema,
  materialTargetKey,
  formatMaterialCreditLine,
} from "../schemas/material-credit.ts";

// RFC-0488: re-export label mapping helpers for @warpgogol/werkstatt-shared/attribution/material-credits consumers.
export {
  labelForSourceType,
  labelForStatus,
  labelForUsageBasis,
} from "../schemas/material-credit.ts";
export type {
  MaterialSourceType,
  MaterialCreditStatus,
  UsageBasisType,
} from "../schemas/material-credit.ts";

export interface MaterialCreditRecord {
  file: string;
  lang?: string;
  credit: MaterialCredit;
}

export type RawMaterialCreditMap = Record<string, string | { default?: string }>;

function rawToString(raw: string | { default?: string }): string {
  return typeof raw === "string" ? raw : (raw.default ?? "");
}

export function langFromCreditPath(path: string): string | undefined {
  const match = path.match(/\/src\/content\/[^/]+\/([^/]+)\//);
  if (!match) return undefined;
  const segment = match[1];
  // RFC-0220: language-agnostic asset folders (surface/assets/, shared/assets/)
  // carry no lang segment; the sidecar itself is the canonical record.
  return segment === "assets" || segment === "media" ? undefined : segment;
}

export function parseMaterialCreditMap(rawMap: RawMaterialCreditMap): MaterialCreditRecord[] {
  const records: MaterialCreditRecord[] = [];
  for (const [file, raw] of Object.entries(rawMap)) {
    const parsed = parseYaml(rawToString(raw));
    const credit = materialCreditSchema.parse(parsed);
    records.push({ file, lang: langFromCreditPath(file), credit });
  }
  return records;
}

export function findMaterialCredit(
  records: MaterialCreditRecord[],
  target: MaterialTarget,
  lang: string,
  defaultLang: string,
): MaterialCredit | null {
  const candidates = lang === defaultLang ? [lang, undefined] : [lang, defaultLang, undefined];
  for (const candidateLang of candidates) {
    const key = materialTargetKey(target, candidateLang);
    const record = records.find((item) => {
      const recordLang = item.credit.target.lang ?? item.lang;
      return materialTargetKey(item.credit.target, recordLang) === key;
    });
    if (record) return record.credit;
  }
  return null;
}

/**
 * RFC-1426: the credits page's shared projection — per-language selection
 * (exact → default → language-agnostic), page-visibility filter, canonical
 * materialTargetKey order. Both credits-page renderers (generated prose and
 * credits-gallery) consume this so their record set and order can never drift.
 * Visibility applies AFTER selection: a `hidden` localized record drops its
 * target rather than silently falling back to a visible lang twin.
 */
export function selectCreditsPageRecords(
  records: MaterialCreditRecord[],
  lang: string,
  defaultLang: string,
): MaterialCreditRecord[] {
  const resolveLang = (record: MaterialCreditRecord): string | undefined =>
    record.credit.target.lang ?? record.lang;
  const identityKey = (record: MaterialCreditRecord): string => {
    const target = record.credit.target;
    return [target.kind, target.domain ?? "", target.id].join(":");
  };
  const priorityFor = (recordLang: string | undefined): number => {
    if (recordLang === lang) return 0;
    if (recordLang === defaultLang) return 1;
    if (!recordLang) return 2;
    return -1;
  };

  const bestByTarget = new Map<string, { record: MaterialCreditRecord; priority: number }>();
  for (const record of records) {
    const priority = priorityFor(resolveLang(record));
    if (priority < 0) continue;
    const key = identityKey(record);
    const current = bestByTarget.get(key);
    if (!current || priority < current.priority) {
      bestByTarget.set(key, { record, priority });
    }
  }
  return [...bestByTarget.values()]
    .map((entry) => entry.record)
    .filter((record) => isMaterialCreditPageVisible(record.credit))
    .sort((a, b) =>
      materialTargetKey(a.credit.target, resolveLang(a)).localeCompare(
        materialTargetKey(b.credit.target, resolveLang(b)),
      ),
    );
}

export function creditByTarget(
  rawMap: RawMaterialCreditMap,
  target: MaterialTarget,
  lang: string,
  defaultLang: string,
): MaterialCredit | null {
  return findMaterialCredit(parseMaterialCreditMap(rawMap), target, lang, defaultLang);
}

export function schemaTypeForMaterial(
  kind: MaterialKind,
): "ImageObject" | "VideoObject" | "CreativeWork" {
  if (kind === "image") return "ImageObject";
  if (kind === "video") return "VideoObject";
  return "CreativeWork";
}

/**
 * RFC-0227: stable @id for a material credit node, derived from the content URL.
 * Used by both the disclosure <script> and any page-graph associatedMedia reference.
 */
export function materialCreditAtId(contentUrl?: string, targetId?: string): string | undefined {
  const base = contentUrl ?? (targetId ? `urn:material:${targetId}` : undefined);
  return base ? `${base}#material` : undefined;
}

export function buildMaterialCreditJsonLd(
  credit: MaterialCredit,
  contentUrl?: string,
  labels?: MaterialCreditLabels,
): Record<string, unknown> {
  const creators = credit.parties.filter(
    (party) => party.role === "creator" || party.role === "coCreator",
  );
  const creator =
    creators.length === 1
      ? {
          "@type": creators[0].kind === "Organization" ? "Organization" : "Person",
          name: creators[0].name,
          url: creators[0].url,
        }
      : creators.map((party) => ({
          "@type": party.kind === "Organization" ? "Organization" : "Person",
          name: party.name,
          ...(party.url ? { url: party.url } : {}),
        }));

  const copyrightHolder = resolveCopyrightHolder(credit);
  const copyrightYear =
    credit.license.copyrightYear ?? copyrightYearFromNotice(credit.license.copyrightNotice);
  // RFC-0227: stable @id for page-graph linking.
  const atId = materialCreditAtId(contentUrl, credit.target.id);

  return {
    "@type": schemaTypeForMaterial(credit.target.kind),
    ...(atId ? { "@id": atId } : {}),
    ...(contentUrl ? { contentUrl } : {}),
    name: credit.title ?? credit.target.id,
    ...(labels ? { creditText: formatMaterialCreditLine(credit, labels) } : {}),
    creator,
    ...(copyrightHolder ? { copyrightHolder } : {}),
    ...(copyrightYear ? { copyrightYear } : {}),
    ...(credit.license.copyrightNotice ? { copyrightNotice: credit.license.copyrightNotice } : {}),
    // RFC-0223: only emit a URL as schema.org license; the human label stays in creditText.
    ...(credit.license.url ? { license: credit.license.url } : {}),
    ...(credit.license.acquireLicensePage
      ? { acquireLicensePage: credit.license.acquireLicensePage }
      : {}),
    ...(credit.createdAt ? { dateCreated: credit.createdAt } : {}),
  };
}

function copyrightYearFromNotice(notice?: string): number | undefined {
  const match = notice?.match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : undefined;
}

function resolveCopyrightHolder(credit: MaterialCredit): Record<string, unknown> | undefined {
  const holder = credit.parties.find((party) => party.role === "rightsHolder");
  if (holder) {
    return {
      "@type": holder.kind === "Person" ? "Person" : "Organization",
      name: holder.name,
      ...(holder.url ? { url: holder.url } : {}),
    };
  }
  const fromNotice = credit.license.copyrightNotice
    ?.match(/©\s*\d{0,4}\s*([^.]+?)\.?\s*(?:All rights|$)/i)?.[1]
    ?.trim();
  return fromNotice ? { "@type": "Organization", name: fromNotice } : undefined;
}
