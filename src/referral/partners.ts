/*
<MODULE_CONTRACT>
<purpose>
[RFC-1198] Referral-partner contract for cookie-free attribution: the zod schema
for the site-owned `src/content/referral-partners/partners.yaml` collection, the
reserved-slug list, the active-partner loader used by generated routes and the
worker bundle, and the server-side raw-input→slug resolver.

Attribution lives only in the URL (`/r/<slug>` landing, `?ref=` param) and in
the voluntary `referrer` form field — no cookies, no localStorage, no storage
of any kind on the visitor's device.
</purpose>
<non-goals>
  <item>No PII handling here — displayName is public on /r/<slug> by contract.</item>
  <item>Do not read cookies/DOM/storage — this module is runtime-agnostic.</item>
  <item>Do not resolve slugs against a remote registry — the site content file is the only partner source (brief WP1/WP3).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198: created — partner schema, reserved slugs, loader, resolver.</item>
  <item>RFC-1198: cookie-free referral attribution — /r/<slug> partner landings + voluntary referrer field

Replace the RFC-1191 wg_ref cookie capture with URL+form attribution:
static /r/<slug> and /<lang>/r/<slug> partner landings (noindex, zero JS,
consent-gated via publicNameConsentRef), ?ref prefill on the existing
referrerField rail, server-side slug resolution against the bundled
partners.yaml, referral_partner_slug/name on the Lagebild ingress contract,
legacy /?ref -> /r/<slug> 302 in the generated worker, and full removal of
the cookie capture module (wg_ref, referral.attribution entitlement,
payload.attribution).</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { parse as yamlParse } from "yaml";

/** Slug contract: kebab-case, 3–32 chars (brief WP1). */
export const REFERRAL_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Pattern for the `?ref` query param — slightly looser than the slug
    contract (accepts any dash-starting shape) but same bounded charset/length;
    used by the client prefill and the worker redirect. */
export const REF_PARAM_PATTERN = /^[a-z0-9-]{3,32}$/;

/** Max length of the raw `referrer` form value forwarded to integrations. */
export const REFERRER_MAX_LENGTH = 80;

/** Slugs that may never name a partner — every reserved route/namespace per
    brief WP1 plus the platform's known top-level namespaces. The loader also
    rejects a slug equal to any existing route; the route check is the
    generator's job (it has the registry), this list covers the static set. */
export const RESERVED_REFERRAL_SLUGS: readonly string[] = [
  "admin",
  "api",
  "kontakt",
  "preis",
  "uk",
  "de",
  "r",
  "team",
  "agb",
  "datenschutz",
  "impressum",
  "nachweise",
  "notausgang",
  "ratgeber",
  "leistungen",
  "website",
];

export const ReferralPartnerSchema = z.object({
  slug: z
    .string()
    .regex(REFERRAL_SLUG_PATTERN)
    .min(3)
    .max(32)
    .refine((s) => !RESERVED_REFERRAL_SLUGS.includes(s), { message: "reserved slug" }),
  /** Public name — requires written partner consent (publicNameConsentRef). */
  displayName: z.string().min(1),
  compensation: z.enum(["referral-fee", "none", "steward"]),
  locales: z.array(z.enum(["de", "uk"])).min(1),
  active: z.boolean(),
  /** Reference to the written public-name consent (identifier/date), not its
      content. Empty → partner never builds. */
  publicNameConsentRef: z.string(),
});

export const ReferralPartnersFileSchema = z.object({
  partners: z.array(ReferralPartnerSchema),
});

export type ReferralPartner = z.infer<typeof ReferralPartnerSchema>;

/**
 * Parses a `partners.yaml` collection into the active-partner set. An entry is
 * active for the build only when `active && publicNameConsentRef` — the
 * written-consent gate is enforced here so a missing reference can never
 * produce a public page or a resolvable slug. Malformed entries are skipped
 * with a structured warn (slug only) — a bad partner must not fail a build.
 */
export function loadActiveReferralPartners(
  globbed: Record<string, string>,
  warn: (code: string, data: Record<string, unknown>) => void = () => {},
): ReferralPartner[] {
  const out: ReferralPartner[] = [];
  const seen = new Set<string>();
  for (const raw of Object.values(globbed)) {
    let parsed: unknown;
    try {
      parsed = ReferralPartnersFileSchema.parse(yamlLike(raw));
    } catch {
      warn("referral.partners.invalid", { reason: "schema" });
      continue;
    }
    for (const partner of (parsed as z.infer<typeof ReferralPartnersFileSchema>).partners) {
      if (RESERVED_REFERRAL_SLUGS.includes(partner.slug)) {
        warn("referral.partners.reserved", { slug: partner.slug });
        continue;
      }
      if (seen.has(partner.slug)) {
        warn("referral.partners.duplicate", { slug: partner.slug });
        continue;
      }
      if (!partner.active || partner.publicNameConsentRef.trim() === "") continue;
      seen.add(partner.slug);
      out.push(partner);
    }
  }
  return out;
}

/**
 * Server-side resolution of the voluntary `referrer` raw input to an active
 * partner slug. Trim + case-insensitive match. Returns null when the input is
 * empty, over-length, or matches no active partner — the raw value still flows
 * as `referrer_uri` for manual review (RFC-0567 rail).
 */
export function resolveReferralPartner(
  rawInput: string,
  partners: readonly ReferralPartner[],
): ReferralPartner | null {
  const candidate = rawInput.trim().toLowerCase();
  if (!candidate || candidate.length > REFERRER_MAX_LENGTH) return null;
  return partners.find((p) => p.slug === candidate) ?? null;
}

/** Partners files are authored YAML; a JSON body (e.g. generated fixture) is
    also accepted verbatim. */
function yamlLike(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  return yamlParse(trimmed);
}
