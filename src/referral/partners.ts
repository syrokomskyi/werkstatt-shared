/*
<MODULE_CONTRACT>
<purpose>
[RFC-1222] Trust-handoff referral-partner registry contract — typed loader for
the site-authored `content/referral-partners/partners.yaml` with an explicit
lifecycle (pending|active|retired) and a structured consent union. The schema
gates emission: active partners need recorded consent, pending partners never
resolve, retired partners keep a nameless status page. Resolver and landing
consumers read this module; client-safe constants stay in ./patterns.ts.
</purpose>
<non-goals>
  <item>No legacy dual path — the v1 fields (`active`, `publicNameConsentRef`) are schema-invalid by design.</item>
  <item>No runtime fetch — the loader parses an already-bundled YAML payload (build-time inlining).</item>
  <item>No client bundle — this module is server/build-side; import patterns.ts from client code.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198: created — schema + loader + resolver.</item>
  <item>RFC-1198 fo-fix: extracted client-safe constants to ./patterns.ts (Zod + RESERVED_REFERRAL_SLUGS leaked into the send-message client chunk).</item>
  <item>RFC-1222: schema v2 — `status` lifecycle replaces `active`, structured `consent` union (none|document|channel) replaces `publicNameConsentRef`, `role` + `retiredAt` added, schema enforces active⇒consent granted and retired⇒retiredAt, slug-PII guard exported; forward-only, no v1 acceptance.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { parse as yamlParse } from "yaml";
import { REFERRAL_SLUG_PATTERN, REF_PARAM_PATTERN, REFERRER_MAX_LENGTH } from "./patterns.ts";

export { REFERRAL_SLUG_PATTERN, REF_PARAM_PATTERN, REFERRER_MAX_LENGTH };

/** Slugs that may never name a partner — platform-owned namespaces only.
    Partner slugs live under the `/r/` prefix and cannot collide with authored
    routes; this list guards only against names that would mimic platform
    machinery inside that namespace. Site-specific page slugs are deliberately
    NOT listed — they are site content, not platform constants. */
export const RESERVED_REFERRAL_SLUGS: readonly string[] = [
  "admin",
  "api",
  "portal",
  "r",
  "robots",
  "sitemap",
  "well-known",
];

/** Open ISO-639-1 language code — the site's `system.md i18n.supported`
    decides which locales actually emit; the schema stays language-agnostic. */
const LangCodeSchema = z.string().regex(/^[a-z]{2}$/);

/** Localized display phrase map — `{ de: "…", uk: "…" }`. Site-authored
    because legal wording must be authored, never derived. */
const LocalizedPhraseSchema = z.record(LangCodeSchema, z.string().min(1));

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** RFC-1222: partner lifecycle. Pending partners exist in the registry but
    emit nothing public; retired partners emit a nameless status page. */
export const ReferralPartnerStatusSchema = z.enum(["pending", "active", "retired"]);
export type ReferralPartnerStatus = z.infer<typeof ReferralPartnerStatusSchema>;

/** RFC-1222: structured consent record aligned with the `pbp/consent@1`
    method vocabulary. `none` records the explicit absence of consent — a
    partner declaring it can never be `active`. `document` points at a
    pbp/consent entity under `business-profile/{lang}/trust/consents/`.
    `channel` records the venue consent arrived on. `grantedAt` is mandatory
    on every granted variant. Members are strict — an unrecognised key fails
    the file rather than being silently stripped. */
export const ReferralConsentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("none") }).strict(),
  z
    .object({
      method: z.literal("document"),
      ref: z.string().min(1),
      grantedAt: IsoDateSchema,
    })
    .strict(),
  z
    .object({
      method: z.literal("channel"),
      channel: z.enum(["email", "telegram", "whatsapp", "phone", "in-person"]),
      grantedAt: IsoDateSchema,
    })
    .strict(),
]);
export type ReferralConsent = z.infer<typeof ReferralConsentSchema>;

export const ReferralPartnerSchema = z
  .object({
    slug: z
      .string()
      .regex(REFERRAL_SLUG_PATTERN)
      .min(3)
      .max(32)
      .refine((s) => !RESERVED_REFERRAL_SLUGS.includes(s), { message: "reserved slug" }),
    /** Public display name — consent-gated: never emitted while `pending`,
        never emitted on `retired` pages or retired JSON. */
    displayName: z.string().min(1),
    /** Localized public role statement (`{ de: "…", uk: "…" }`). Falls under
        the same consent gate as displayName — it describes the same person. */
    role: LocalizedPhraseSchema.optional(),
    compensation: z.enum(["referral-fee", "none", "steward"]),
    /** Language codes for the localized landings. Open set (ISO-639-1) — the
        site's `system.md i18n.supported` decides which of them actually emit;
        the unprefixed `/r/<slug>` canonical landing always emits for active
        partners in the site default language. */
    locales: z.array(LangCodeSchema).min(1),
    status: ReferralPartnerStatusSchema,
    consent: ReferralConsentSchema,
    /** Present iff status is "retired" — the status page cites the date. */
    retiredAt: IsoDateSchema.optional(),
  })
  .strict()
  .superRefine((partner, ctx) => {
    if (partner.status === "active" && partner.consent.method === "none") {
      ctx.addIssue({
        code: "custom",
        message: `active partner "${partner.slug}" has consent.method none — consent must be recorded before emission`,
        path: ["consent"],
      });
    }
    if (partner.status === "retired" && !partner.retiredAt) {
      ctx.addIssue({
        code: "custom",
        message: `retired partner "${partner.slug}" requires retiredAt`,
        path: ["retiredAt"],
      });
    }
    if (partner.status !== "retired" && partner.retiredAt) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" carries retiredAt but is not retired`,
        path: ["retiredAt"],
      });
    }
    if (partner.role) {
      for (const lang of Object.keys(partner.role)) {
        if (!partner.locales.includes(lang)) {
          ctx.addIssue({
            code: "custom",
            message: `partner "${partner.slug}" role.${lang} is outside declared locales`,
            path: ["role", lang],
          });
        }
      }
    }
  });
export type ReferralPartner = z.infer<typeof ReferralPartnerSchema>;

/** Site-authored landing copy facts — the pieces of the referral landing that
    vary per site (economics, audience, role term, legal pointer). The platform
    owns the sentence structure; the site owns these phrases. */
export const ReferralLandingConfigSchema = z
  .object({
    /** Reward display phrase per compensation variant, interpolated into the
        disclosure (e.g. `referral-fee: { de: "70 €" }` → "erhält Anna dafür
        70 € von …"; `steward` is appended after ", unter anderem"). */
    rewardPhrases: z
      .object({
        "referral-fee": LocalizedPhraseSchema.optional(),
        steward: LocalizedPhraseSchema.optional(),
      })
      .strict()
      .optional(),
    /** Role term for the steward disclosure variant (e.g. "Markt-Steward"). */
    stewardRole: LocalizedPhraseSchema.optional(),
    /** Audience/product clause for the lead sentence (e.g. "Firmenwebsites
        für Handwerk und lokales Gewerbe"). Absent → generic "Websites". */
    audiencePhrase: LocalizedPhraseSchema.optional(),
    /** Legal pointer appended to the referred-customer benefit sentence
        (e.g. "(AGB § 3 Abs. 5)"). The platform must not hardcode document
        section numbers — they are site-text decisions. */
    conditionsNote: LocalizedPhraseSchema.optional(),
  })
  .strict();

export const ReferralPartnersFileSchema = z
  .object({
    /** Optional per-language slug of the site's referral-program explainer
        page (e.g. `{ de: "verantwortungsvolle-empfehlungen" }`). Site-authored —
        the platform must not hardcode site routes. When absent, landings omit
        the program link. */
    programRoutes: z.record(LangCodeSchema, z.string().min(1)).optional(),
    /** Optional site-authored landing copy facts (reward phrase, steward role
        term, audience clause, legal pointer). */
    landing: ReferralLandingConfigSchema.optional(),
    partners: z.array(ReferralPartnerSchema).default([]),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    for (const partner of file.partners) {
      if (seen.has(partner.slug)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate partner slug "${partner.slug}"`,
          path: ["partners"],
        });
      }
      seen.add(partner.slug);
    }
  });
export type ReferralLandingConfig = z.infer<typeof ReferralLandingConfigSchema>;
export type ReferralPartnersFile = z.infer<typeof ReferralPartnersFileSchema>;

/** Partners classified by lifecycle — `active` emits landings and resolves,
    `retired` emits a nameless status page, `pending` emits nothing public. */
export interface ReferralPartnerLifecycleSets {
  readonly active: ReferralPartner[];
  readonly retired: ReferralPartner[];
  readonly pending: ReferralPartner[];
}

export type ReferralPartnerWarn = (code: string, data: Record<string, unknown>) => void;

/**
 * Parses `partners.yaml` payloads into lifecycle-classified partner sets. A
 * malformed file warns (`referral.partners.invalid`) and contributes nothing —
 * a bad registry must not fail a build, and strict whole-file validation
 * (schema + duplicate slugs) keeps a typo from silently dropping one partner
 * while emitting the rest.
 */
export function loadReferralPartners(
  globbed: Record<string, string>,
  warn: ReferralPartnerWarn = () => {},
): ReferralPartnerLifecycleSets {
  const sets: ReferralPartnerLifecycleSets = { active: [], retired: [], pending: [] };
  const seen = new Set<string>();
  for (const raw of Object.values(globbed)) {
    let parsed: ReferralPartnersFile;
    try {
      parsed = ReferralPartnersFileSchema.parse(yamlLike(raw));
    } catch (error) {
      const detail =
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "schema")
          : String(error).slice(0, 200);
      warn("referral.partners.invalid", { reason: "schema", detail });
      continue;
    }
    for (const partner of parsed.partners) {
      if (RESERVED_REFERRAL_SLUGS.includes(partner.slug)) {
        warn("referral.partners.reserved", { slug: partner.slug });
        continue;
      }
      if (seen.has(partner.slug)) {
        warn("referral.partners.duplicate", { slug: partner.slug });
        continue;
      }
      seen.add(partner.slug);
      sets[partner.status].push(partner);
    }
  }
  return sets;
}

/** Active partners only — the set that may resolve names and emit landings. */
export function loadActiveReferralPartners(
  globbed: Record<string, string>,
  warn: ReferralPartnerWarn = () => {},
): ReferralPartner[] {
  return loadReferralPartners(globbed, warn).active;
}

/**
 * Server-side resolution of the voluntary `referrer` raw input to an ACTIVE
 * partner. Trim + case-insensitive match. Returns null when the input is
 * empty, over-length, matches no active partner, or hits a pending/retired
 * partner — a retired slug must never re-attribute. The raw value still flows
 * as `referrer_uri` for manual review (RFC-0567 rail).
 */
export function resolveReferralPartner(
  rawInput: string,
  partners: readonly ReferralPartner[],
): ReferralPartner | null {
  const candidate = rawInput.trim().toLowerCase();
  if (!candidate || candidate.length > REFERRER_MAX_LENGTH) return null;
  return partners.find((p) => p.slug === candidate && p.status === "active") ?? null;
}

/**
 * Reads the optional site-authored `programRoutes` map (lang → page slug) from
 * the same partners.yaml. Returns null when absent or malformed — the landing
 * then omits the program link rather than guessing a site route.
 */
export function loadReferralProgramRoutes(
  globbed: Record<string, string>,
): Record<string, string> | null {
  for (const raw of Object.values(globbed)) {
    try {
      const parsed = ReferralPartnersFileSchema.parse(yamlLike(raw));
      return parsed.programRoutes ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Reads the optional site-authored `landing` copy-facts block from the same
 * partners.yaml. Returns null when absent or malformed — landings then use
 * the generic site-agnostic phrases (no reward amount, generic audience).
 */
export function loadReferralLandingConfig(
  globbed: Record<string, string>,
): ReferralLandingConfig | null {
  for (const raw of Object.values(globbed)) {
    try {
      const parsed = ReferralPartnersFileSchema.parse(yamlLike(raw));
      return parsed.landing ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * RFC-1222 slug-privacy guard: a slug must not contain any token of the
 * partner's displayName — otherwise the URL itself leaks the identity it is
 * meant to pseudonymize. Tokens are lowercase alphanumeric runs ≥3 chars
 * compared against the slug's dash-separated segments (a segment match means
 * the name is legible in the URL; substrings inside a longer invented token
 * are not a leak).
 */
export function slugContainsNameToken(slug: string, displayName: string): boolean {
  const nameTokens = displayName
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/u)
    .filter((t) => t.length >= 3);
  const slugTokens = new Set(slug.toLowerCase().split("-").filter(Boolean));
  return nameTokens.some((t) => slugTokens.has(t));
}

/** Partners files are authored YAML; a JSON body (e.g. generated fixture) is
    also accepted verbatim. */
function yamlLike(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  return yamlParse(trimmed);
}
