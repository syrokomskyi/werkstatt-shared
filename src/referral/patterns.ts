/*
<MODULE_CONTRACT>
<purpose>
[RFC-1198] Client-safe referral pattern constants — regexes and bounds shared
by the browser prefill (?ref), the worker redirect, and the partner schema.
Zero dependencies: importing this module must never pull the Zod schemas or
the reserved-slug table into a client bundle.
</purpose>
<non-goals>
  <item>No Zod, no loaders, no RESERVED_REFERRAL_SLUGS — those live in partners.ts (server-side).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198 fo-fix: extracted from partners.ts — the Zod module pulled RESERVED_REFERRAL_SLUGS ("sitemap") into the send-message client chunk and tripped dist.asset-integrity.validate's js-literal scan (DIST-ASSET-01).</item>
  <item>RFC-1257: structured CtaTarget + scenario-plumbed contact links</item>
</CHANGE_SUMMARY>
*/

/** Slug contract: kebab-case, 3–32 chars (brief WP1). */
export const REFERRAL_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Pattern for the `?ref` query param — slightly looser than the slug
    contract (accepts any dash-starting shape) but same bounded charset/length;
    used by the client prefill and the worker redirect. */
export const REF_PARAM_PATTERN = /^[a-z0-9-]{3,32}$/;

/** Pattern for the `?scenario` form-intent param (RFC-1257) — bounded
    slug-like charset; client preselect, API normalization, and authored
    option ids share this one definition. */
export const SCENARIO_PARAM_PATTERN = /^[a-z0-9-]{1,32}$/;

/** Key/value charsets for the `query` map on internal link targets
    (RFC-1257) — schema-level bound so authored params stay URL-safe and
    audit-greppable. Archetype yaml shapes inline the same literals. */
export const TARGET_QUERY_KEY_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;
export const TARGET_QUERY_VALUE_PATTERN = /^[a-zA-Z0-9_%.-]{0,128}$/;

/** Max length of the raw `referrer` form value forwarded to integrations. */
export const REFERRER_MAX_LENGTH = 80;
