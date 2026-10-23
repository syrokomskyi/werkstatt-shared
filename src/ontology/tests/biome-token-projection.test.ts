/*
<MODULE_CONTRACT>
<purpose>
RFC-1379: pins for the heroEyebrow projection slot — the optional biome
components field projects to --ds-color-hero-eyebrow, stays absent when unset
(the CSS layer supplies the accent/ink defaults), and the emitted name is
declared in the generated token-name set.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the projection module owns the authoritative behavior.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1379: components.heroEyebrow → --ds-color-hero-eyebrow pins (AC-2).</item>
  <item>RFC-1379: hero cta token precedence and light-hero eyebrow contrast</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import {
  getAllProjectedTokenNames,
  projectBiomeToTokens,
} from "../biome-token-projection.ts";
import { biomeComponentsSchema } from "../schemas/biome.ts";

describe("biome token projection — heroEyebrow (RFC-1379)", () => {
  it("projects components.heroEyebrow to --ds-color-hero-eyebrow", () => {
    const tokens = projectBiomeToTokens({ components: { heroEyebrow: "rgb(10 20 30)" } });
    expect(tokens.get("--ds-color-hero-eyebrow")).toBe("rgb(10 20 30)");
  });

  it("emits no hero-eyebrow token when the field is unset — CSS defaults own the fallback", () => {
    const tokens = projectBiomeToTokens({ components: {} });
    expect(tokens.has("--ds-color-hero-eyebrow")).toBe(false);
  });

  it("schema accepts the optional heroEyebrow cssValue", () => {
    const parsed = biomeComponentsSchema.safeParse({ heroEyebrow: "#123456" });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.heroEyebrow).toBe("#123456");
  });

  it("the projected name participates in the contract surface (biome.contract.validate coverage)", () => {
    expect(getAllProjectedTokenNames()).toContain("--ds-color-hero-eyebrow");
  });
});
