/*
<MODULE_CONTRACT>
<purpose>RFC-1192: the wg_consent localStorage flag — the platform's single cookie-consent
record — and cookieWriteAllowed(), the mandatory write-gate every catalog module calls
before setting a cookie. Also owns writeConsentFlag() so the flag shape has exactly one
writer.</purpose>
<non-goals>
  <item>Never throw on absent, malformed, or unavailable storage — the gate fails closed.</item>
  <item>Never log or persist PII — the flag is {v, at, granted} only.</item>
  <item>Do not render UI — the consent surface lives in cookie-consent.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1192: initial consent flag + write-gate (RFC-1192 amends RFC-0188 storage policy).</item>
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

/**
 * Parses a `name=value` pair out of a cookie source string — the shared
 * split/trim/decode used by the consent-gated readers below (RFC-1192).
 */
function parseCookiePair(source: string | null, name: string): string | null {
  if (!source) return null;
  for (const part of source.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/** localStorage key holding the cookie-consent record. */
export const CONSENT_FLAG_KEY = "wg_consent";

/** Consent record persisted in localStorage under `wg_consent`. */
export interface ConsentFlag {
  /** Flag schema version — currently 1. */
  v: number;
  /** ISO-8601 timestamp of the recorded choice. */
  at: string;
  /** The visitor's choice — true: cookies permitted; false: recorded decline. */
  granted: boolean;
}

function isConsentFlag(value: unknown): value is ConsentFlag {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { v?: unknown }).v === 1 &&
    typeof (value as { at?: unknown }).at === "string" &&
    typeof (value as { granted?: unknown }).granted === "boolean"
  );
}

/**
 * Reads the flag; returns null when absent, malformed, or storage is
 * unavailable (private mode) — never throws.
 */
export function readConsentFlag(): ConsentFlag | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_FLAG_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isConsentFlag(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Writes the consent record — the single writer for the flag shape.
 * Returns false when storage is unavailable; never throws.
 */
export function writeConsentFlag(granted: boolean): boolean {
  try {
    const flag: ConsentFlag = { v: 1, at: new Date().toISOString(), granted };
    window.localStorage.setItem(CONSENT_FLAG_KEY, JSON.stringify(flag));
    return true;
  } catch {
    return false;
  }
}

/**
 * The single write-gate. Returns true iff the flag exists AND granted is
 * true; callers MUST NOT set a cookie on false (absent or declined).
 * Never throws, never logs PII.
 */
export function cookieWriteAllowed(): boolean {
  return readConsentFlag()?.granted === true;
}

/**
 * Reads a first-party cookie by name. Returns null when absent or
 * `document.cookie` is unavailable — never throws.
 */
export function readCookie(name: string): string | null {
  try {
    return parseCookiePair(document.cookie, name);
  } catch {
    return null;
  }
}

/**
 * Consent-gated first-party cookie write — the only path catalog modules use
 * to persist state. Returns false (and writes nothing) when the gate is
 * closed; the caller keeps its captured state in-memory for same-request
 * pass-through. Never throws.
 */
export function writeCookie(name: string, value: string, maxAgeDays: number): boolean {
  if (!cookieWriteAllowed()) return false;
  try {
    const maxAge = Math.floor(maxAgeDays * 86400);
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure`;
    return true;
  } catch {
    return false;
  }
}
