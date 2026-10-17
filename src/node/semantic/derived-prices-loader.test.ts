/*
<MODULE_CONTRACT>
  <purpose>
Unit tests for derived prices loader covering loadDerivedPrices (RFC-1137). It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1137: initial tests — cwd is a required parameter (compile-time guard via @ts-expect-error), missing file warns with the resolved path, present file loads entries.</item>
  <item>RFC-1137: explicit site root for derived-prices loaders (ADR-0089 instance)</item>
</CHANGE_SUMMARY>
*/

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDerivedPrices } from "./derived-prices-loader.ts";

describe("loadDerivedPrices (RFC-1137)", () => {
  let workpieceRoot: string;

  beforeEach(() => {
    workpieceRoot = mkdtempSync(join(tmpdir(), "derived-prices-"));
    mkdirSync(join(workpieceRoot, "src"), { recursive: true });
  });

  afterEach(() => {
    rmSync(workpieceRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("AC-2: cwd is a required parameter — omitting it is a compile-time error", () => {
    // @ts-expect-error — RFC-1137: no ambient process.cwd() default (ADR-0089/DNA-105)
    expect(() => loadDerivedPrices()).toThrow();
  });

  it("AC-3: absent file warns with the workpiece-resolved path and returns null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = loadDerivedPrices(workpieceRoot);
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    const message = warn.mock.calls[0]?.[0] as string;
    expect(message).toContain(join(workpieceRoot, "src", "derived-prices.generated.json"));
    expect(message).toContain("derived-prices.materialize");
  });

  it("loads entries from <cwd>/src/derived-prices.generated.json", () => {
    const entry = {
      amount: { value: 100, currency: "EUR" },
      targetCurrency: "EUR",
      trace: { source: { amount: 100, currency: "EUR" } },
    };
    writeFileSync(
      join(workpieceRoot, "src", "derived-prices.generated.json"),
      JSON.stringify({ "offer/1": [entry] }),
    );
    const result = loadDerivedPrices(workpieceRoot);
    expect(result).toEqual({ "offer/1": [entry] });
  });

  it("returns null for an empty {} file (RFC-1074)", () => {
    writeFileSync(join(workpieceRoot, "src", "derived-prices.generated.json"), "{}");
    expect(loadDerivedPrices(workpieceRoot)).toBeNull();
  });
});
