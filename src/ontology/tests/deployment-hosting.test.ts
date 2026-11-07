/*
<MODULE_CONTRACT>
<purpose>RFC-1529 r2 tests for deploymentHostingSchema — the declared host
block's kind-conditional requirements.</purpose>
</MODULE_CONTRACT>
*/

import { describe, expect, it } from "vitest";
import { deploymentHostingSchema } from "../operations/leitstand.ts";

describe("deploymentHostingSchema (RFC-1529)", () => {
  it("accepts a full provisional-studio-domain declaration", () => {
    expect(
      deploymentHostingSchema.safeParse({
        kind: "provisional-studio-domain",
        baseDomain: "warpgogol.com",
        zoneId: "zone-1",
      }).success,
    ).toBe(true);
  });

  it("rejects a provisional-studio-domain declaration missing baseDomain/zoneId", () => {
    expect(deploymentHostingSchema.safeParse({ kind: "provisional-studio-domain" }).success).toBe(
      false,
    );
    expect(
      deploymentHostingSchema.safeParse({
        kind: "provisional-studio-domain",
        baseDomain: "warpgogol.com",
      }).success,
    ).toBe(false);
    expect(
      deploymentHostingSchema.safeParse({
        kind: "provisional-studio-domain",
        zoneId: "zone-1",
      }).success,
    ).toBe(false);
  });

  it("accepts a bare provisional-workers-dev declaration (no studio zone to point at)", () => {
    expect(deploymentHostingSchema.safeParse({ kind: "provisional-workers-dev" }).success).toBe(
      true,
    );
  });
});
