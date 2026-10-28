/*
<MODULE_CONTRACT>
<purpose>
  RFC-1418 AC-3 + AC-7 (shared side): the resourceBudget policy schema accepts
  `inlineCssBytes {limit, mode}`, rejects malformed shapes, and resolve()
  applies the shared 24 KB blocking default when a site omits the key.
</purpose>
<non-goals>
  <item>dist measurement lives in werkstatt-site checks — this file pins the policy contract only.</item>
</non-goals>
</MODULE_CONTRACT>
*/

import { describe, expect, it } from "vitest";
import {
  INLINE_CSS_BUDGET_DEFAULT,
  resolveResourceBudget,
  resourceBudgetConfigSchema,
} from "../resource-budget.ts";

const BASE = {
  maxPageWeightKb: 2048,
  maxJsKb: 512,
  maxRequests: 80,
  maxThirdPartyOrigins: 8,
  enforce: "advisory",
} as const;

describe("inlineCssBytes policy schema (AC-3)", () => {
  it("accepts a well-formed inlineCssBytes block", () => {
    const parsed = resourceBudgetConfigSchema.safeParse({
      ...BASE,
      inlineCssBytes: { limit: 8192, mode: "advisory" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed inlineCssBytes shapes", () => {
    for (const bad of [
      { ...BASE, inlineCssBytes: { limit: -1, mode: "blocking" } },
      { ...BASE, inlineCssBytes: { limit: 100 } },
      { ...BASE, inlineCssBytes: { limit: 100, mode: "strict" } },
      { ...BASE, inlineCssBytes: { limit: 100, mode: "blocking", extra: 1 } },
      { ...BASE, inlineCssBytes: 1024 },
    ]) {
      expect(resourceBudgetConfigSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("inlineCssBytes default resolution (AC-7)", () => {
  it("undefined override resolves the shared 24 KB blocking default", () => {
    const r = resolveResourceBudget(undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.inlineCssBytes).toEqual(INLINE_CSS_BUDGET_DEFAULT);
    expect(r.config.inlineCssBytes?.limit).toBe(24576);
    expect(r.config.inlineCssBytes?.mode).toBe("blocking");
  });

  it("an authored block without inlineCssBytes still resolves the default", () => {
    const r = resolveResourceBudget(BASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.inlineCssBytes).toEqual(INLINE_CSS_BUDGET_DEFAULT);
  });

  it("an authored inlineCssBytes override wins over the default", () => {
    const r = resolveResourceBudget({
      ...BASE,
      inlineCssBytes: { limit: 4096, mode: "advisory" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.inlineCssBytes).toEqual({ limit: 4096, mode: "advisory" });
  });
});
