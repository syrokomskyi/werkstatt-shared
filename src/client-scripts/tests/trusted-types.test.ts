import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * WebIDL-faithful TrustedTypes factory stub: `createHTML`/`createScriptURL`
 * declare `input` as DOMString, so the browser stringifies the argument
 * before invoking the policy callback. The mock reproduces that coercion —
 * an object brand would arrive as "[object Object]".
 */
function installTrustedTypes() {
  const factory = {
    createPolicy(
      _name: string,
      rules: {
        createHTML?(input: unknown): string;
        createScriptURL?(input: unknown): string;
      },
    ) {
      return {
        createHTML: (input: unknown) => rules.createHTML?.(String(input)),
        createScriptURL: (input: unknown) => rules.createScriptURL?.(String(input)),
      };
    },
  };
  (globalThis as { trustedTypes?: unknown }).trustedTypes = factory;
  return factory;
}

async function importModule() {
  return import("../trusted-types.ts");
}

describe("werkstatt trusted-types policy", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
  });

  it("ttScriptURL returns a minted trusted URL that round-trips the policy", async () => {
    installTrustedTypes();
    const { ttScriptURL } = await importModule();
    expect(ttScriptURL("https://matomo-proxy.example/m.js")).toBe(
      "https://matomo-proxy.example/m.js",
    );
  });

  it("rejects unbranded input passed straight to the policy", async () => {
    installTrustedTypes();
    const mod = await importModule();
    expect(() => mod.werkstattPolicy?.createScriptURL("https://evil.example/x.js")).toThrow(
      /refusing unbranded input/,
    );
  });

  it("each minted value is single-use — replaying it throws", async () => {
    installTrustedTypes();
    const mod = await importModule();
    mod.ttScriptURL("https://a.example/one.js");
    expect(() => mod.werkstattPolicy?.createScriptURL("https://a.example/one.js")).toThrow(
      /refusing unbranded input/,
    );
  });

  it("double-minting the same URL allows two consecutive passes", async () => {
    installTrustedTypes();
    const mod = await importModule();
    expect(mod.ttScriptURL("https://a.example/dup.js")).toBe("https://a.example/dup.js");
    expect(mod.ttScriptURL("https://a.example/dup.js")).toBe("https://a.example/dup.js");
    expect(() => mod.werkstattPolicy?.createScriptURL("https://a.example/dup.js")).toThrow(
      /refusing unbranded input/,
    );
  });

  it("ttHTML returns minted HTML and rejects raw strings", async () => {
    installTrustedTypes();
    const mod = await importModule();
    expect(mod.ttHTML("<b>ok</b>")).toBe("<b>ok</b>");
    expect(() => mod.werkstattPolicy?.createHTML("<b>ok</b>")).toThrow(/refusing unbranded input/);
  });

  it("falls back to a raw string pass-through without TrustedTypes support", async () => {
    const mod = await importModule();
    expect(mod.werkstattPolicy).toBeUndefined();
    expect(mod.ttScriptURL("https://a.example/x.js")).toBe("https://a.example/x.js");
    expect(mod.ttHTML("<i>y</i>")).toBe("<i>y</i>");
  });

  it("ttMaybeHTML mints strings and passes non-strings through untouched", async () => {
    installTrustedTypes();
    const mod = await importModule();
    const el = { tag: "div" } as const;
    expect(mod.ttMaybeHTML(el)).toBe(el);
    expect(mod.ttMaybeHTML("<b>minted</b>")).toBe("<b>minted</b>");
    expect(() => mod.werkstattPolicy?.createHTML("<b>minted</b>")).toThrow(
      /refusing unbranded input/,
    );
  });
});
