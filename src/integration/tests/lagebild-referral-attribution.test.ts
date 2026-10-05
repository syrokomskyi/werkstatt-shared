/*
<MODULE_CONTRACT>
<purpose>RFC-1191: verify the referral-attribution contracts — wg_ref codec roundtrip,
readAttributionFromRequest resolution order (cookie → pageUrl ?ref= → request ?ref=),
and the lagebild destination adapter's fail-open pass-through of payload.attribution
(AC-6/AC-7).</purpose>
</MODULE_CONTRACT>
*/

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  encodeRefCookieValue,
  decodeRefCookieValue,
  readAttributionFromRequest,
  readCookieHeader,
  WG_REF_COOKIE,
} from "../referral.ts";
import { ReferralAttributionPayloadSchema } from "../referral-schema.ts";
import { lagebildDestinationAdapter } from "../lagebild-destination-adapter.ts";
import type { IntegrationEvent } from "../port.ts";

const CODE = "d3f7a2c4e6";
const EPOCH = 1738000000;
const ISO = new Date(EPOCH * 1000).toISOString();

const SECRETS = {
  LAGEBILD_API_URL: "https://lagebild.example.test",
  LAGEBILD_API_KEY: "key",
  LAGEBILD_TENANT_ID: "t1",
  LAGEBILD_SOURCE_SYSTEM_ID: "s1",
};

function event(attribution: unknown): IntegrationEvent {
  return {
    eventId: "evt-1",
    kind: "lead",
    source: "send-message",
    locale: "de",
    occurredAt: ISO,
    contact: { email: "lead@example.test" },
    payload: { message: "hi", ...(attribution !== undefined ? { attribution } : {}) },
  };
}

describe("wg_ref codec (RFC-1191)", () => {
  it("encode/decode roundtrips {refCode, firstTouchAt}", () => {
    const value = encodeRefCookieValue(CODE, EPOCH);
    expect(value).toBe(`${CODE}.${EPOCH}`);
    expect(decodeRefCookieValue(value)).toEqual({ refCode: CODE, firstTouchAt: ISO });
  });

  it.each([
    ["no epoch suffix", CODE],
    ["empty", ""],
    ["non-numeric epoch", `${CODE}.abc`],
    ["non-pattern code", `INVALID!.${EPOCH}`],
    ["trailing dot", `${CODE}.`],
  ])("decode returns null for malformed value: %s", (_label, value) => {
    expect(decodeRefCookieValue(value)).toBeNull();
  });

  it("payload schema accepts a valid block and rejects malformed ones", () => {
    expect(
      ReferralAttributionPayloadSchema.safeParse({ refCode: CODE, firstTouchAt: ISO }).success,
    ).toBe(true);
    expect(
      ReferralAttributionPayloadSchema.safeParse({ refCode: "BAD!", firstTouchAt: ISO }).success,
    ).toBe(false);
    expect(ReferralAttributionPayloadSchema.safeParse({ refCode: CODE }).success).toBe(false);
  });
});

describe("readAttributionFromRequest (RFC-1191)", () => {
  it("reads the wg_ref cookie from the Cookie header", () => {
    const req = new Request("https://site.test/api/send-message", {
      headers: { cookie: `other=1; ${WG_REF_COOKIE}=${encodeRefCookieValue(CODE, EPOCH)}` },
    });
    expect(readAttributionFromRequest(req)).toEqual({ refCode: CODE, firstTouchAt: ISO });
  });

  it("falls back to ?ref= on the posted page URL (same-request pass-through)", () => {
    const req = new Request("https://site.test/api/send-message");
    const pageUrl = `https://site.test/kontakt?ref=${CODE}`;
    const result = readAttributionFromRequest(req, pageUrl);
    expect(result?.refCode).toBe(CODE);
    expect(result?.firstTouchAt).toMatch(/^\d{4}-/);
  });

  it("cookie wins over the URL param (first-touch persisted state)", () => {
    const req = new Request("https://site.test/api/send-message", {
      headers: { cookie: `${WG_REF_COOKIE}=${encodeRefCookieValue(CODE, EPOCH)}` },
    });
    const result = readAttributionFromRequest(req, `https://site.test/?ref=m5k7p2q3wz`);
    expect(result?.refCode).toBe(CODE);
  });

  it("returns null when nothing valid is present", () => {
    const req = new Request("https://site.test/api/send-message");
    expect(readAttributionFromRequest(req, "https://site.test/?ref=INVALID!!")).toBeNull();
  });

  it("readCookieHeader finds the named cookie only", () => {
    expect(readCookieHeader(`a=1; ${WG_REF_COOKIE}=v.v; b=2`, WG_REF_COOKIE)).toBe("v.v");
    expect(readCookieHeader("a=1", WG_REF_COOKIE)).toBeNull();
    expect(readCookieHeader(null, WG_REF_COOKIE)).toBeNull();
  });
});

describe("lagebild adapter attribution pass-through (RFC-1191 AC-6/7)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ accepted: true, submission_id: "s1" }))),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("AC-6: a valid payload.attribution maps onto the ingress attribution field", async () => {
    await lagebildDestinationAdapter.route(event({ refCode: CODE, firstTouchAt: ISO }), SECRETS);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.attribution).toEqual({ referral_code: CODE, first_touch_at: ISO });
  });

  it("AC-7: an unknown-but-pattern-conforming code passes through without local resolution", async () => {
    await lagebildDestinationAdapter.route(
      event({ refCode: "m5k7p2q3wz", firstTouchAt: ISO }),
      SECRETS,
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.attribution?.referral_code).toBe("m5k7p2q3wz");
  });

  it("AC-7: malformed attribution is omitted without failing the dispatch", async () => {
    const result = await lagebildDestinationAdapter.route(
      event({ refCode: "not-a-code!!" }),
      SECRETS,
    );
    expect(result).toEqual({ id: "s1" });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.attribution).toBeUndefined();
  });

  it("events without attribution dispatch unchanged", async () => {
    await lagebildDestinationAdapter.route(event(undefined), SECRETS);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body.attribution).toBeUndefined();
  });
});
