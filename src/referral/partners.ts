/*
<MODULE_CONTRACT>
<purpose>
[RFC-1222] Trust-handoff referral-partner registry contract — typed loader for
the site-authored `content/referral-partners/partners.yaml` with an explicit
lifecycle (pending|active|retired) and a structured consent union. The schema
gates identity: active partners need recorded consent, pending partners emit
the landing minus identity (anonymous copy), retired partners keep a nameless
status page. Resolver and landing
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
  <item>RFC-1258: schema v3 — `quote`/`quoteConsent` replaced forward-only by `statement`/`statementConsent`/`statementConfirmedAt`; `basis[]` (claim+verifiedBy+date), per-partner `scope`, `validUntil` (required on active), consent-gated `website`/`photo`, `relationToClientWorld`; expiry is data + validator, the lifecycle enum stays closed (DNA-19).</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { parse as yamlParse } from "yaml";
import { REFERRAL_SLUG_PATTERN, REF_PARAM_PATTERN, REFERRER_MAX_LENGTH } from "./patterns.ts";

export { REFERRAL_SLUG_PATTERN, REF_PARAM_PATTERN, REFERRER_MAX_LENGTH };

/** RFC-1258 phrase guard — closed denylist of unverifiable claim patterns for
    authored referral copy (brief §9: "garantiert", "der beste", "viele
    zufriedene Kunden", …). The validator flags a sentence matching a pattern
    unless the same sentence also carries a negation token (de: nicht/kein/
    ohne; uk: не/без/жодного) — negated forms ("Wir garantieren nicht") are
    legitimate. Extend via RFC, never silently. */
export const REFERRAL_PHRASE_GUARD_PATTERNS: readonly {
  readonly label: string;
  readonly pattern: RegExp;
}[] = [
  { label: "garantiert", pattern: /\bgarant\w*\b/i },
  {
    label: "der/die/das beste",
    pattern: /\bbeste\b|\bbesten\b|\bbester\b|\bbestes\b|\bbestem\b/i,
  },
  { label: "viele zufriedene Kunden", pattern: /\bviele\s+zufriedene\s+Kunden\b/i },
  { label: "Platz 1 bei Google", pattern: /\bPlatz\s*1\b|\bPosition\s*1\b/i },
  { label: "Nummer 1", pattern: /\bNummer\s*1\b/i },
  { label: "гарантія", pattern: /гарант[а-яіїєґ]*/i },
  { label: "найкращий", pattern: /найкращ[а-яіїєґ]*/i },
  {
    label: "багато задоволених клієнтів",
    pattern: /багато\s+задоволених\s+клієнтів/i,
  },
];

/** Negation tokens that legitimize a sentence carrying a guard pattern —
    German and Ukrainian (the registry's two locales). Cyrillic needs explicit
    delimiters: JS `\b` is ASCII-only (`\w` = [A-Za-z0-9_]), so `\bне\b` never
    matches — the negation word is matched with punctuation/space delimiters. */
export const REFERRAL_PHRASE_NEGATION_PATTERN =
  /\bnicht\b|\bkein\w*\b|\bohne\b|\bnie\b|(^|[\s,.!?;:«»„"'\-])не([\s,.!?;:«»„"']|$)|(^|[\s,.!?;:«»„"'\-])без([\s,.!?;:«»„"']|$)|жодн[а-яіїєґ]*/i;

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

/** RFC-1222 + referral-brief-v1: partner lifecycle. Pending partners emit the
    landing minus identity while public-name consent is unrecorded; active
    partners emit the full landing; retired partners keep a nameless status
    page; paused partners emit nothing public — the slug falls back to the
    neutral /r/ document (referral-brief-v1 mode D). */
export const ReferralPartnerStatusSchema = z.enum(["pending", "active", "retired", "paused"]);
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

/** Granted-consent subset (document|channel) — used for the quote gate where
    `none` is meaningless: an unconsented quote simply stays absent. */
const GrantedConsentSchema = z.discriminatedUnion("method", [
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

export const ReferralPartnerSchema = z
  .object({
    slug: z
      .string()
      .regex(REFERRAL_SLUG_PATTERN)
      .min(3)
      .max(32)
      .refine((s) => !RESERVED_REFERRAL_SLUGS.includes(s), { message: "reserved slug" }),
    /** Public display name — consent-gated: withheld while `pending`,
        never emitted on `retired`/`paused` pages or nameless JSON docs.
        Optional (referral-brief-v1 mode B): a partner may exist with no
        recorded name — the landing then runs anonymous. */
    displayName: z.string().min(1).optional(),
    /** Localized public role statement (`{ de: "…", uk: "…" }`). Falls under
        the same consent gate as displayName — it describes the same person. */
    role: LocalizedPhraseSchema.optional(),
    /** RFC-1258 (replaces RFC-1222 `quote`): the recommender's own voice —
        2–4 first-person sentences, consent-gated, dated. Never authored by
        an agent; the content carries the recommender's questionnaire answers. */
    statement: LocalizedPhraseSchema.optional(),
    /** RFC-1258: recorded consent covering the statement (same union shape
        the former `quoteConsent` used). Required iff `statement` is set. */
    statementConsent: GrantedConsentSchema.optional(),
    /** RFC-1258: the date the statement was confirmed with the recommender —
        rendered as the signature date under the statement. Required iff
        `statement` is set. */
    statementConfirmedAt: IsoDateSchema.optional(),
    /** RFC-1258: "Was ich selbst geprüft habe" — each item: claim (localized)
        + who verified it + the date. Items the recommender did not verify are
        simply absent; requires `statement`. */
    basis: z
      .array(
        z
          .object({
            claim: LocalizedPhraseSchema,
            verifiedBy: z.enum(["recommender", "warpgogol"]),
            date: IsoDateSchema,
          })
          .strict(),
      )
      .optional(),
    /** RFC-1258: the recommender's own fit view — localized lists. Requires
        `statement`; renders in the recommender's voice section, never in the
        studio's transparency card (two voices, two scopes). */
    scope: z
      .object({
        fits: z.array(LocalizedPhraseSchema).min(1),
        doesNotFit: z.array(LocalizedPhraseSchema).min(1),
      })
      .strict()
      .optional(),
    /** RFC-1258: the recommendation holds until this date — required on
        `active` partners (validator enforces future-at-validate-time; the
        schema stays time-free per DNA-105). */
    validUntil: IsoDateSchema.optional(),
    /** RFC-1258: the recommender's website — consent-gated like the name. */
    website: z.string().url().optional(),
    websiteConsent: GrantedConsentSchema.optional(),
    /** RFC-1258: the recommender's photo — a site-root-relative public path
        (e.g. "/r/assets/ostpost/portrait.jpg" under `public/`; the landing is
        static and outside the content-collection image pipeline), consent-
        gated like the name. */
    photo: z
      .string()
      .min(1)
      .regex(/^\//, "photo must be a site-root-relative path starting with /")
      .optional(),
    photoConsent: GrantedConsentSchema.optional(),
    /** RFC-1258: one phrase about the recommender's relation to the client's
        world ("Ich begleite Betriebe, die …") — consent-gated like role. */
    relationToClientWorld: LocalizedPhraseSchema.optional(),
    compensation: z.enum(["referral-fee", "none", "steward"]),
    /** Language codes for the localized landings. Open set (ISO-639-1) — the
        site's `system.md i18n.supported` decides which of them actually emit;
        the unprefixed `/r/<slug>` canonical landing always emits for active
        partners in the site default language. */
    locales: z.array(LangCodeSchema).min(1),
    /** referral-brief-v1 `lang_default`: first-display language for the
        partner's shared link — the worker redirects the unprefixed
        `/r/<slug>` to this locale's twin when set and ≠ site default. */
    langDefault: LangCodeSchema.optional(),
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
    if (partner.status === "active" && !partner.displayName) {
      ctx.addIssue({
        code: "custom",
        message: `active partner "${partner.slug}" has no displayName — recorded consent covers a name that must exist`,
        path: ["displayName"],
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
    // RFC-1222 slug-privacy guard: the slug must not spell a display-name
    // token — the URL itself would leak the identity it pseudonymizes.
    if (partner.displayName && slugContainsNameToken(partner.slug, partner.displayName)) {
      ctx.addIssue({
        code: "custom",
        message: `partner slug "${partner.slug}" contains a displayName token — pick a pseudonymous slug`,
        path: ["slug"],
      });
    }
    // RFC-1258 statement gate (replaces the RFC-1222 quote rules): the
    // recommender's voice needs recorded consent, active status, a confirmed
    // date, and locale membership.
    if (partner.statement) {
      if (!partner.statementConsent) {
        ctx.addIssue({
          code: "custom",
          message: `partner "${partner.slug}" carries a statement but no statementConsent — the recommender's voice needs recorded consent`,
          path: ["statementConsent"],
        });
      }
      if (!partner.statementConfirmedAt) {
        ctx.addIssue({
          code: "custom",
          message: `partner "${partner.slug}" carries a statement but no statementConfirmedAt — a dated claim requires its confirmation date`,
          path: ["statementConfirmedAt"],
        });
      }
      if (partner.status !== "active") {
        ctx.addIssue({
          code: "custom",
          message: `partner "${partner.slug}" carries a statement but is not active — the voice renders only on the named landing`,
          path: ["statement"],
        });
      }
      for (const lang of Object.keys(partner.statement)) {
        if (!partner.locales.includes(lang)) {
          ctx.addIssue({
            code: "custom",
            message: `partner "${partner.slug}" statement.${lang} is outside declared locales`,
            path: ["statement", lang],
          });
        }
      }
    }
    if (partner.statementConsent && !partner.statement) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" records statementConsent but has no statement`,
        path: ["statementConsent"],
      });
    }
    if (partner.statementConfirmedAt && !partner.statement) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" records statementConfirmedAt but has no statement`,
        path: ["statementConfirmedAt"],
      });
    }
    if (partner.basis) {
      if (!partner.statement) {
        ctx.addIssue({
          code: "custom",
          message: `partner "${partner.slug}" carries basis but no statement — the checked-facts list belongs to the recommender's voice`,
          path: ["basis"],
        });
      }
      partner.basis.forEach((item, index) => {
        if (!item.date || !item.verifiedBy) {
          ctx.addIssue({
            code: "custom",
            message: `partner "${partner.slug}" basis[${index}] lacks date or verifiedBy — every basis item carries fact + verifier + date`,
            path: ["basis", index],
          });
        }
        for (const lang of Object.keys(item.claim)) {
          if (!partner.locales.includes(lang)) {
            ctx.addIssue({
              code: "custom",
              message: `partner "${partner.slug}" basis[${index}].claim.${lang} is outside declared locales`,
              path: ["basis", index, "claim", lang],
            });
          }
        }
      });
    }
    if (partner.scope) {
      if (!partner.statement) {
        ctx.addIssue({
          code: "custom",
          message: `partner "${partner.slug}" carries scope but no statement — the fit view belongs to the recommender's voice`,
          path: ["scope"],
        });
      }
      for (const list of ["fits", "doesNotFit"] as const) {
        for (const phrase of partner.scope[list]) {
          for (const lang of Object.keys(phrase)) {
            if (!partner.locales.includes(lang)) {
              ctx.addIssue({
                code: "custom",
                message: `partner "${partner.slug}" scope.${list} phrase.${lang} is outside declared locales`,
                path: ["scope", list],
              });
            }
          }
        }
      }
    }
    if (partner.status === "active" && !partner.validUntil) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" is active without validUntil — a dated recommendation expires; set the term the recommender agreed to`,
        path: ["validUntil"],
      });
    }
    if (partner.website && !partner.websiteConsent) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" carries a website but no websiteConsent — independent verification paths are consent-gated`,
        path: ["websiteConsent"],
      });
    }
    if (partner.websiteConsent && !partner.website) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" records websiteConsent but has no website`,
        path: ["websiteConsent"],
      });
    }
    if (partner.website && partner.status !== "active") {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" carries a website but is not active — verification paths render only on the named landing`,
        path: ["website"],
      });
    }
    if (partner.photo && !partner.photoConsent) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" carries a photo but no photoConsent — the portrait is consent-gated like the name`,
        path: ["photoConsent"],
      });
    }
    if (partner.photoConsent && !partner.photo) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" records photoConsent but has no photo`,
        path: ["photoConsent"],
      });
    }
    if (partner.photo && partner.status !== "active") {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" carries a photo but is not active — the portrait renders only on the named landing`,
        path: ["photo"],
      });
    }
    if (partner.relationToClientWorld) {
      if (!partner.statementConsent) {
        ctx.addIssue({
          code: "custom",
          message: `partner "${partner.slug}" carries relationToClientWorld but no statementConsent — the relation phrase is part of the recommender's voice`,
          path: ["statementConsent"],
        });
      }
      for (const lang of Object.keys(partner.relationToClientWorld)) {
        if (!partner.locales.includes(lang)) {
          ctx.addIssue({
            code: "custom",
            message: `partner "${partner.slug}" relationToClientWorld.${lang} is outside declared locales`,
            path: ["relationToClientWorld", lang],
          });
        }
      }
    }
    if (partner.langDefault && !partner.locales.includes(partner.langDefault)) {
      ctx.addIssue({
        code: "custom",
        message: `partner "${partner.slug}" langDefault "${partner.langDefault}" is outside declared locales`,
        path: ["langDefault"],
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
    /** RFC-1222: proof points shown before the CTA (e.g. Eigene Domain /
        Schriftliche Verantwortung / Betreuter Betrieb / Vorgesehener
        Ausstieg) — lang → list of authored phrases. */
    proofs: z.record(LangCodeSchema, z.array(z.string().min(1)).min(1)).optional(),
    /** RFC-1222: open-price line with `{price:<offering>:<charge>}` markers —
        amounts always resolve from PBP offerings, never literal digits. */
    priceLine: LocalizedPhraseSchema.optional(),
    /** referral-brief-v1: the transparency-card "Gilt für" row — the scope
        the recommendation covers (e.g. the digital-foundation scope list). */
    scopeLine: LocalizedPhraseSchema.optional(),
    /** referral-brief-v1: the transparency-card "Nicht Bestandteil" row —
        what the recommendation does NOT cover. */
    exclusionsLine: LocalizedPhraseSchema.optional(),
    /** RFC-1258: the transparency-card "Was der Empfehlende erfährt" line —
        what the recommender learns about the client, grounded in AGB
        § 12 Abs. 3 / Datenschutz § 5.4. Studio-specific process truth. */
    recommenderLearnsLine: LocalizedPhraseSchema.optional(),
    /** referral-brief-v1: AGB section anchors per language for in-copy
        references — `lang → anchorKey → anchor` (e.g.
        `{ de: { b2b: "sec-1-4" } }`). */
    agbAnchors: z.record(LangCodeSchema, z.record(z.string().min(1), z.string().min(1))).optional(),
  })
  .strict();

export const ReferralPartnersFileSchema = z
  .object({
    /** Optional per-language slug of the site's referral-program explainer
        page (e.g. `{ de: "verantwortungsvolle-empfehlungen" }`). Site-authored —
        the platform must not hardcode site routes. When absent, landings omit
        the program link. */
    programRoutes: z.record(LangCodeSchema, z.string().min(1)).optional(),
    /** Optional per-language slug of the site's pricing/scope page — target of
        the landing's "Leistungsumfang prüfen →" link next to the open price. */
    pricingRoutes: z.record(LangCodeSchema, z.string().min(1)).optional(),
    /** Optional site-authored landing copy facts (reward phrase, steward role
        term, audience clause, legal pointer, proofs, open-price line). */
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
    `retired` emits a nameless status page, `pending` emits the landing minus
    identity (no displayName/role) while public-name consent is unrecorded,
    `paused` emits nothing public (referral-brief-v1 mode D — the /r/<slug>
    request falls back to the neutral document). */
export interface ReferralPartnerLifecycleSets {
  readonly active: ReferralPartner[];
  readonly retired: ReferralPartner[];
  readonly pending: ReferralPartner[];
  readonly paused: ReferralPartner[];
}

/** Lifecycle statuses that emit a referral route twin (landing and/or
    /r/<slug>.json). `paused` is deliberately absent — emitters and the parity
    gate must stay locked on this single set even if the enum grows. */
export const REFERRAL_ROUTE_EMITTING_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "pending",
  "retired",
]);

export type ReferralPartnerWarn = (code: string, data: Record<string, unknown>) => void;

/** RFC-1222: strict source validation for `referral.partners.validate` —
    returns the parsed file or the full issue list (loaders swallow these into
    a single warn; the author-stage guard needs each violation named). */
export function validateReferralPartnersSource(
  raw: string,
): { file: ReferralPartnersFile; issues: string[] } | { file: null; issues: string[] } {
  let yaml: unknown;
  try {
    yaml = yamlLike(raw);
  } catch (error) {
    return { file: null, issues: [`yaml: ${String(error).slice(0, 300)}`] };
  }
  const parsed = ReferralPartnersFileSchema.safeParse(yaml);
  if (!parsed.success) {
    return {
      file: null,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "file"}: ${issue.message}`,
      ),
    };
  }
  return { file: parsed.data, issues: [] };
}

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
  const sets: ReferralPartnerLifecycleSets = { active: [], retired: [], pending: [], paused: [] };
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

/** Reads the optional site-authored `pricingRoutes` map (lang → page slug). */
export function loadReferralPricingRoutes(
  globbed: Record<string, string>,
): Record<string, string> | null {
  for (const raw of Object.values(globbed)) {
    try {
      const parsed = ReferralPartnersFileSchema.parse(yamlLike(raw));
      return parsed.pricingRoutes ?? null;
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
