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
</CHANGE_SUMMARY>
*/

/** A single cookie a catalog module may set. */
export interface CookieDescriptor {
  /** Cookie name (e.g. "wg_ref"). */
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
export const COOKIE_MODULES: readonly CookieModule[] = [
  {
    moduleId: "referral.attribution",
    entitlement: "referral.attribution",
    cookies: [
      {
        name: "wg_ref",
        maxAgeDays: 180,
        sameSite: "Lax",
        purpose: "Recommender attribution — remembers which Empfehlungsgeber link brought this visitor",
      },
    ],
  },
];

/**
 * Site-level gate: true iff any entitled feature owns catalog cookies.
 * Drives the conditional consent surface — a site without an entitled
 * cookie module renders no banner and sets no flag (DNA-13).
 */
export function siteUsesCookies(entitled: readonly string[]): boolean {
  const set = new Set(entitled);
  return COOKIE_MODULES.some((m) => set.has(m.entitlement));
}
