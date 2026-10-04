/*
<MODULE_CONTRACT>
<purpose>RFC-1191: the referral.attribution contracts — the opaque ref-code pattern, the
typed payload.attribution block carried on PII-bearing IntegrationEvents, the wg_ref
cookie name, and the cookie-value codec (<code>.<unixSeconds>) that embeds firstTouchAt
inside the cookie value itself.</purpose>
<non-goals>
  <item>No PII anywhere in this module — the refCode is an opaque handle resolved to a
        recommender contact only inside Lagebild.</item>
  <item>Do not read or write cookies/DOM here — the capture module
        (client-scripts/referral-capture.ts) consumes this contract.</item>
  <item>Do not resolve codes against the registry — resolution is Lagebild-internal.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1191: initial referral-attribution contracts + wg_ref codec.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/** Closed charset/length for ref codes (RFC-1191: opaque, non-guessable). */
export const REF_CODE_PATTERN = /^[a-z2-7]{10}$/;

/** First-party cookie name registered in COOKIE_MODULES (RFC-1192). */
export const WG_REF_COOKIE = "wg_ref";

/**
 * Typed attribution payload carried on PII-bearing IntegrationEvents in
 * `payload.attribution`. Contains no PII — the refCode is an opaque handle
 * resolved to a recommender contact only inside Lagebild.
 */
export interface ReferralAttributionPayload {
  /** Opaque referrer code from the ?ref= URL param. */
  refCode: string;
  /** ISO-8601 first-touch time — decoded from the wg_ref value's epoch suffix. */
  firstTouchAt: string;
}

/** Zod schema the dispatch path validates attribution against. */
export const ReferralAttributionPayloadSchema = z.object({
  refCode: z.string().regex(REF_CODE_PATTERN),
  firstTouchAt: z.string().datetime(),
});

/**
 * Encodes the wg_ref cookie value: `<refCode>.<unixSeconds>`. The epoch suffix
 * is the durable home of firstTouchAt — the cookie value itself carries it,
 * so no session cache or server state is needed to reconstruct it.
 */
export function encodeRefCookieValue(refCode: string, epochSeconds: number): string {
  return `${refCode}.${epochSeconds}`;
}

/**
 * Decodes a wg_ref cookie value into the typed attribution payload.
 * Returns null for any malformed value (no code, no epoch suffix, non-numeric
 * epoch, non-pattern code) — callers treat null as "no attribution".
 */
export function decodeRefCookieValue(value: string): ReferralAttributionPayload | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;
  const refCode = value.slice(0, dot);
  const epoch = Number(value.slice(dot + 1));
  if (!REF_CODE_PATTERN.test(refCode) || !Number.isInteger(epoch) || epoch <= 0) return null;
  return { refCode, firstTouchAt: new Date(epoch * 1000).toISOString() };
}

/**
 * Reads a named cookie out of a raw `Cookie` request header — used by
 * server-side dispatch paths for the pure-HTML fallback (no client JS).
 */
export function readCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/**
 * Resolves referral attribution for a server-side dispatch path (RFC-1191).
 * Order: (1) the consent-gated `wg_ref` cookie on the request, (2) a valid
 * `?ref=` param on `pageUrl` (the URL of the page the form lived on, posted
 * as the request's `referrer` field) — the same-request pass-through that
 * covers pre-consent / no-JS conversions. Returns null when neither yields a
 * valid code — callers attach nothing and the event still delivers.
 */
export function readAttributionFromRequest(
  request: Request,
  pageUrl?: string | null,
): ReferralAttributionPayload | null {
  const raw = readCookieHeader(request.headers.get("cookie"), WG_REF_COOKIE);
  if (raw) {
    const decoded = decodeRefCookieValue(raw);
    if (decoded) return decoded;
  }
  for (const candidate of [pageUrl, request.url]) {
    if (!candidate) continue;
    try {
      const ref = new URL(candidate).searchParams.get("ref");
      if (ref && REF_CODE_PATTERN.test(ref)) {
        return { refCode: ref, firstTouchAt: new Date().toISOString() };
      }
    } catch {
      // Malformed candidate URL — try the next one.
    }
  }
  return null;
}
