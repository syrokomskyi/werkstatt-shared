/*
<MODULE_CONTRACT>
<purpose>RFC-1192: tests for the conditional cookie-consent surface — self-gating on the
host node, recorded-choice skip, accept/decline flag writes, and the wg:cookie-consent
CustomEvent (AC-2 conditional render, AC-3 flag record).</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1192: initial consent-surface tests.</item>
</CHANGE_SUMMARY>
*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_CONSENT_EVENT, initCookieConsent } from "../cookie-consent.ts";
import { CONSENT_FLAG_KEY, readConsentFlag } from "../cookie-write-gate.ts";

interface FakeElement {
  attrs: Record<string, string>;
  children: FakeElement[];
  listeners: Record<string, (() => void) | undefined>;
  style: { cssText: string };
  textContent: string;
  type: string;
  setAttribute: (name: string, value: string) => void;
  appendChild: (child: FakeElement) => void;
  addEventListener: (type: string, fn: () => void) => void;
  remove: ReturnType<typeof vi.fn>;
  click: () => void;
}

function fakeElement(): FakeElement {
  const el: FakeElement = {
    attrs: {},
    children: [],
    listeners: {},
    style: { cssText: "" },
    textContent: "",
    type: "",
    setAttribute: (n, v) => {
      el.attrs[n] = v;
    },
    appendChild: (c) => {
      el.children.push(c);
    },
    addEventListener: (t, fn) => {
      el.listeners[t] = fn;
    },
    remove: vi.fn(),
    click: () => el.listeners.click?.(),
  };
  return el;
}

function stubDom(opts: { hostPresent: boolean; flagRaw?: string | null }) {
  const data = new Map<string, string>();
  if (opts.flagRaw !== undefined && opts.flagRaw !== null) {
    data.set(CONSENT_FLAG_KEY, opts.flagRaw);
  }
  const host = fakeElement();
  const documentStub = {
    querySelector: vi.fn((sel: string) =>
      sel === "[data-cookie-consent-host]" && opts.hostPresent ? host : null,
    ),
    createElement: vi.fn(() => fakeElement()),
  };
  const windowStub = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
    dispatchEvent: vi.fn(),
  };
  class FakeCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("window", windowStub);
  vi.stubGlobal("CustomEvent", FakeCustomEvent);
  return { host, documentStub, windowStub, data };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initCookieConsent gating (AC-2)", () => {
  it("renders nothing when the host node is absent (unentitled site)", () => {
    const { host, documentStub } = stubDom({ hostPresent: false });
    initCookieConsent(["referral.attribution"]);
    expect(documentStub.createElement).not.toHaveBeenCalled();
    expect(host.children).toHaveLength(0);
  });

  it("renders nothing when a consent flag already exists", () => {
    const { documentStub } = stubDom({
      hostPresent: true,
      flagRaw: JSON.stringify({ v: 1, at: new Date().toISOString(), granted: false }),
    });
    initCookieConsent(["referral.attribution"]);
    expect(documentStub.createElement).not.toHaveBeenCalled();
  });

  it("renders nothing when no catalog modules are active for the site", () => {
    const { host, documentStub } = stubDom({ hostPresent: true });
    initCookieConsent([]);
    expect(documentStub.createElement).not.toHaveBeenCalled();
    expect(host.children).toHaveLength(0);
  });
});

describe("initCookieConsent choices (AC-3)", () => {
  it("accept writes {v:1, at, granted:true} and dispatches the consent event", () => {
    const { host, windowStub } = stubDom({ hostPresent: true });
    initCookieConsent(["referral.attribution"]);
    expect(host.children).toHaveLength(1);
    const banner = host.children[0];
    // last two appended children are the accept and decline buttons
    const accept = banner.children[banner.children.length - 2];
    accept.click();
    expect(readConsentFlag()?.granted).toBe(true);
    expect(windowStub.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: COOKIE_CONSENT_EVENT, detail: { granted: true } }),
    );
    expect(banner.remove).toHaveBeenCalled();
  });

  it("decline writes granted:false and dispatches the consent event", () => {
    const { host, windowStub } = stubDom({ hostPresent: true });
    initCookieConsent(["referral.attribution"]);
    const banner = host.children[0];
    const decline = banner.children[banner.children.length - 1];
    decline.click();
    expect(readConsentFlag()?.granted).toBe(false);
    expect(windowStub.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: COOKIE_CONSENT_EVENT, detail: { granted: false } }),
    );
  });
});
