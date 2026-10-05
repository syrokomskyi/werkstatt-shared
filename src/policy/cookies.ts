/*
<MODULE_CONTRACT>
<purpose>RFC-1192: the closed catalog of platform modules permitted to set first-party
cookies (the bounded cookie class that amends RFC-0188's blanket prohibition) plus the
siteUsesCookies() gate that drives the conditional consent surface.</purpose>
<non-goals>
  <item>Do not read or write cookies, localStorage, or the DOM — this module is
        runtime-agnostic policy data + a pure predicate.</item>
  <item>Do not extend COOKIE_MODULES without a new RFC — closed catalog (DNA-19).</item>
  <item>Do not duplicate the entitlement catalog — entries reference ENTITLED_FEATURES
        ids owned by entitlement.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1192: initial COOKIE_MODULES catalog + siteUsesCookies gate.</item>
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

/** A single cookie a catalog module may set. */
export interface CookieDescriptor {
  /** Cookie name (e.g. "session_pref"). */
  name: string;
  /** Max-Age in days the module may request. */
  maxAgeDays: number;
  /** Required SameSite — the bounded class only permits "Lax". */
  sameSite: "Lax";
  /** Whether the cookie must be HttpOnly (server-set only). Absent = JS-readable. */
  httpOnly?: boolean;
  /** Human-readable purpose shown on the consent surface. */
  purpose: string;
}

/** A platform module permitted to set cookies when entitled. */
export interface CookieModule {
  /** Catalog key — matches an ENTITLED_FEATURES id (string-typed to stay
      decoupled from the entitlement union; membership is enforced by review). */
  moduleId: string;
  /** Entitlement feature id gating this module's cookies. */
  entitlement: string;
  cookies: CookieDescriptor[];
}

/**
 * Closed catalog — the only modules permitted to set cookies anywhere in the
 * platform. Empty slots do not exist by construction: an entry absent from this
 * array may never set a cookie (RFC-1192 amends RFC-0188).
 */
// RFC-1198: the catalog is empty — referral attribution moved to URL+form data
// only (no client storage anywhere in the new code path). siteUsesCookies()
// returns false for every site, so the consent surface never renders. The
// bounded-cookie mechanism stays available for future entitled modules.
export const COOKIE_MODULES: readonly CookieModule[] = [];

/**
 * Site-level gate: true iff any entitled feature owns catalog cookies.
 * Drives the conditional consent surface — a site without an entitled
 * cookie module renders no banner and sets no flag (DNA-13).
 */
export function siteUsesCookies(entitled: readonly string[]): boolean {
  const set = new Set(entitled);
  return COOKIE_MODULES.some((m) => set.has(m.entitlement));
}
