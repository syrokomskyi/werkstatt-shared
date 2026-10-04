/*
<MODULE_CONTRACT>
<purpose>RFC-1192: tests for the wg_consent flag + cookieWriteAllowed() write-gate — absent,
declined, granted, malformed, and unavailable-storage paths (AC-3 flag shape, AC-4 gate).</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1192: initial write-gate tests.</item>
</CHANGE_SUMMARY>
*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { cookieWriteAllowed, readConsentFlag, writeConsentFlag } from "../cookie-write-gate.ts";

function stubStorage(overrides: Partial<Storage> = {}) {
  const data = new Map<string, string>();
  const storage = {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
    removeItem: vi.fn((k: string) => void data.delete(k)),
    ...overrides,
  };
  vi.stubGlobal("window", { localStorage: storage });
  return { storage, data };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readConsentFlag", () => {
  it("returns null when the flag is absent", () => {
    stubStorage();
    expect(readConsentFlag()).toBeNull();
  });

  it("returns null for malformed flag JSON", () => {
    const { storage } = stubStorage();
    storage.getItem.mockReturnValue("{not json");
    expect(readConsentFlag()).toBeNull();
  });

  it("returns null for a well-formed JSON that is not the flag shape", () => {
    const { storage } = stubStorage();
    storage.getItem.mockReturnValue(JSON.stringify({ v: 1, at: "x" }));
    expect(readConsentFlag()).toBeNull();
  });

  it("returns null when storage throws (private mode)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
      },
    });
    expect(readConsentFlag()).toBeNull();
  });
});

describe("writeConsentFlag + readConsentFlag", () => {
  it("persists {v:1, at:<ISO>, granted:true}", () => {
    stubStorage();
    expect(writeConsentFlag(true)).toBe(true);
    const flag = readConsentFlag();
    expect(flag?.v).toBe(1);
    expect(flag?.granted).toBe(true);
    expect(() => new Date(flag!.at).toISOString()).not.toThrow();
  });

  it("persists granted:false for a recorded decline", () => {
    stubStorage();
    writeConsentFlag(false);
    expect(readConsentFlag()?.granted).toBe(false);
  });
});

describe("cookieWriteAllowed", () => {
  it("is false when the flag is absent", () => {
    stubStorage();
    expect(cookieWriteAllowed()).toBe(false);
  });

  it("is false when the flag records a decline", () => {
    stubStorage();
    writeConsentFlag(false);
    expect(cookieWriteAllowed()).toBe(false);
  });

  it("is true only when granted is true", () => {
    stubStorage();
    writeConsentFlag(true);
    expect(cookieWriteAllowed()).toBe(true);
  });
});
