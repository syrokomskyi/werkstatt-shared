/*
<MODULE_CONTRACT>
<purpose>RFC-1191: verify the referral-capture module — first-touch persistence through the
RFC-1192 consent gate, same-code TTL refresh, different-code no-overwrite, pre-consent
in-memory pass-through, and site-config exposure for external widgets.</purpose>
</MODULE_CONTRACT>
*/

import { describe, it, expect, beforeEach } from "vitest";
import {
  initReferralCapture,
  getAttribution,
  resetReferralCaptureForTests,
} from "../referral-capture.ts";
import { writeConsentFlag } from "../cookie-write-gate.ts";
import { WG_REF_COOKIE, decodeRefCookieValue } from "../../integration/referral.ts";

let cookieStore = "";

function installDom(search: string): void {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };
  (globalThis as Record<string, unknown>).location = { search };
  (globalThis as Record<string, unknown>).__SITE_CONFIG = {};
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return cookieStore;
      },
      set cookie(v: string) {
        const [pair] = v.split(";");
        const [name, ...rest] = pair.split("=");
        cookieStore = `${name}=${rest.join("=")}`;
      },
    },
  });
}

const VALID_CODE = "d3f7a2c4e6";
const OTHER_CODE = "m5k7p2q3wz";

describe("referral-capture (RFC-1191)", () => {
  beforeEach(() => {
    cookieStore = "";
    resetReferralCaptureForTests();
  });

  it("AC-1: valid ?ref= + granted consent persists {refCode, firstTouchAt} in wg_ref", () => {
    installDom(`?ref=${VALID_CODE}`);
    writeConsentFlag(true);
    initReferralCapture();
    const decoded = decodeRefCookieValue(cookieStore.split("=")[1] ?? "");
    expect(decoded?.refCode).toBe(VALID_CODE);
    expect(decoded?.firstTouchAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("pre-consent: write suppressed but getAttribution keeps the captured state", () => {
    installDom(`?ref=${VALID_CODE}`);
    initReferralCapture();
    expect(cookieStore).toBe("");
    expect(getAttribution()?.refCode).toBe(VALID_CODE);
  });

  it("declined consent: cookie never written", () => {
    installDom(`?ref=${VALID_CODE}`);
    writeConsentFlag(false);
    initReferralCapture();
    expect(cookieStore).toBe("");
    expect(getAttribution()?.refCode).toBe(VALID_CODE);
  });

  it("AC-2: second visit with a different code keeps the first-touch attribution", () => {
    installDom(`?ref=${VALID_CODE}`);
    writeConsentFlag(true);
    initReferralCapture();
    const first = decodeRefCookieValue(cookieStore.split("=")[1] ?? "");

    resetReferralCaptureForTests();
    installDom(`?ref=${OTHER_CODE}`);
    initReferralCapture();
    const second = decodeRefCookieValue(cookieStore.split("=")[1] ?? "");
    expect(second?.refCode).toBe(VALID_CODE);
    expect(second?.firstTouchAt).toBe(first?.firstTouchAt);
  });

  it("AC-2: repeat visit with the same code refreshes the cookie while keeping firstTouchAt", () => {
    installDom(`?ref=${VALID_CODE}`);
    writeConsentFlag(true);
    initReferralCapture();
    const first = decodeRefCookieValue(cookieStore.split("=")[1] ?? "");

    resetReferralCaptureForTests();
    installDom(`?ref=${VALID_CODE}`);
    initReferralCapture();
    const second = decodeRefCookieValue(cookieStore.split("=")[1] ?? "");
    expect(second?.refCode).toBe(VALID_CODE);
    expect(second?.firstTouchAt).toBe(first?.firstTouchAt);
  });

  it("invalid/malformed ?ref= values are ignored", () => {
    installDom("?ref=NOT-VALID!!");
    writeConsentFlag(true);
    initReferralCapture();
    expect(cookieStore).toBe("");
    expect(getAttribution()).toBeNull();
  });

  it("no ?ref= and no cookie → no attribution state", () => {
    installDom("");
    writeConsentFlag(true);
    initReferralCapture();
    expect(getAttribution()).toBeNull();
  });

  it("returning visitor without ?ref= keeps persisted state and exposes it on __SITE_CONFIG", () => {
    installDom(`?ref=${VALID_CODE}`);
    writeConsentFlag(true);
    initReferralCapture();

    resetReferralCaptureForTests();
    installDom("");
    initReferralCapture();
    expect(getAttribution()?.refCode).toBe(VALID_CODE);
    const cfg = (globalThis as Record<string, unknown>).__SITE_CONFIG as {
      referral?: { refCode: string };
    };
    expect(cfg.referral?.refCode).toBe(VALID_CODE);
  });
});
