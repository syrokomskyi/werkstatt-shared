/*
<MODULE_CONTRACT>
<purpose>RFC-1191: the referral.attribution capture module — reads the ?ref= code on every
page render, persists first-touch attribution {refCode, firstTouchAt} in the bounded
wg_ref cookie through the RFC-1192 consent gate, and exposes getAttribution() for the
UChat context injector. First-touch wins: an existing attribution is never overwritten;
a repeat visit with the same code refreshes the cookie lifetime (180 days).</purpose>
<non-goals>
  <item>Does not emit any event — no visit counting, no beacon. Attribution leaves the
        site only attached to a PII-bearing conversion event.</item>
  <item>Does not run when the site lacks the referral.attribution entitlement —
        the module is compiled out, never loaded.</item>
  <item>Does not stamp ?ref= on internal links for the UChat-only path — the same-request
        URL pass-through covers no-JS conversions; link stamping is a follow-up for the
        full SSR form path.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Post-deploy E2E: persist the captured state on wg:cookie-consent — a suppressed
        pre-consent write is retried when the visitor grants consent, otherwise
        accepting the banner left wg_ref unwritten until the next ?ref= visit.</item>
  <item>RFC-1191: initial referral capture module (consent-gated, first-touch, 180d TTL).</item>
</CHANGE_SUMMARY>
*/

import {
  REF_CODE_PATTERN,
  WG_REF_COOKIE,
  decodeRefCookieValue,
  encodeRefCookieValue,
  type ReferralAttributionPayload,
} from "../integration/referral.ts";
import { readCookie, writeCookie } from "./cookie-write-gate.ts";
import { COOKIE_CONSENT_EVENT } from "./cookie-consent.ts";
import { COOKIE_MODULES } from "../policy/cookies.ts";

/**
 * TTL bound from the closed COOKIE_MODULES catalog. Absent entry ⇒ capture
 * stays in-memory only — a missing catalog row can never write a cookie.
 */
const COOKIE_SPEC = COOKIE_MODULES.find((m) => m.moduleId === "referral.attribution")?.cookies[0];

let cached: ReferralAttributionPayload | null = null;
let initialized = false;

function persistCached(): void {
  if (!cached || !COOKIE_SPEC) return;
  const epoch = Math.floor(new Date(cached.firstTouchAt).getTime() / 1000);
  writeCookie(WG_REF_COOKIE, encodeRefCookieValue(cached.refCode, epoch), COOKIE_SPEC.maxAgeDays);
}

const onConsent = (event: Event): void => {
  if ((event as CustomEvent<{ granted?: boolean }>).detail?.granted === true) persistCached();
};

function readPersisted(): ReferralAttributionPayload | null {
  const raw = readCookie(WG_REF_COOKIE);
  return raw ? decodeRefCookieValue(raw) : null;
}

/**
 * Runs on every page render while the referral.attribution entitlement is on
 * (self-gated like external-link-qr — init() is a no-op otherwise). Captures a
 * valid ?ref= code; the write goes through the consent gate, so pre-consent it
 * is suppressed but the captured state is still live for same-request
 * pass-through (getAttribution).
 */
export function initReferralCapture(): void {
  if (initialized) return;
  initialized = true;

  // A suppressed write at init is retried once consent lands — the captured
  // ?ref= state survives in `cached`, so granting consent persists it then.
  globalThis.addEventListener?.(COOKIE_CONSENT_EVENT, onConsent);

  const params = new URLSearchParams(globalThis.location?.search ?? "");
  const ref = params.get("ref");
  const existing = readPersisted();
  cached = existing;
  exposeToSiteConfig();

  // SMOKE-INIT-01 (RFC-0974): marker after the last listener registration so
  // smoke tests can synchronize on capture init completion.
  document.documentElement?.setAttribute?.("data-referral-capture-initialized", "true");

  if (!ref || !REF_CODE_PATTERN.test(ref)) return;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (existing && existing.refCode !== ref) return; // first-touch wins
  const state = existing ?? {
    refCode: ref,
    firstTouchAt: new Date(nowSeconds * 1000).toISOString(),
  };
  cached = state;
  exposeToSiteConfig();
  // Same-code repeat visits refresh the TTL inside the policy bound; pre-consent
  // the write is suppressed and retried by the consent listener above.
  persistCached();
}

/**
 * RFC-1191: expose the captured state for the UChat context injector —
 * external widgets cannot read first-party cookies from their own origin,
 * so the ref code reaches them through the site config on every render.
 */
function exposeToSiteConfig(): void {
  const siteConfig = (globalThis as { __SITE_CONFIG?: Record<string, unknown> }).__SITE_CONFIG;
  if (siteConfig && cached) {
    siteConfig.referral = { refCode: cached.refCode, firstTouchAt: cached.firstTouchAt };
  }
}

/**
 * The current attribution state for the UChat context injector and tests.
 * Post-consent this is the persisted cookie state; pre-consent it is the
 * in-memory capture of the current request's ?ref= (same-request pass-through).
 */
export function getAttribution(): ReferralAttributionPayload | null {
  return cached;
}

/** Test-only reset so each spec starts from a clean module state. */
export function resetReferralCaptureForTests(): void {
  cached = null;
  initialized = false;
  globalThis.removeEventListener?.(COOKIE_CONSENT_EVENT, onConsent);
}
