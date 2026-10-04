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
</CHANGE_SUMMARY>
*/

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
