/*
<MODULE_CONTRACT>
<purpose>
Unit tests for derived prices loader covering loadDerivedPrices. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the derived suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadDerivedPrices } from "../semantic/derived-prices-loader.ts";

describe("loadDerivedPrices", () => {
  it("returns null when file does not exist", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "test-prices-"));
    try {
      const result = loadDerivedPrices(tmpDir);
      expect(result).toBeNull();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns null for empty {} content (RFC-1074)", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "test-prices-"));
    try {
      const srcDir = join(tmpDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "derived-prices.generated.json"), "{}\n");
      const result = loadDerivedPrices(tmpDir);
      expect(result).toBeNull();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("loads and parses JSON when file exists", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "test-prices-"));
    try {
      const srcDir = join(tmpDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(
        join(srcDir, "derived-prices.generated.json"),
        JSON.stringify({
          "https://warpgogol.com/id/offerings/hosting": [
            {
              chargeRef: "monthly",
              targetCurrency: "USD",
              amount: { value: "15", currency: "USD" },
              trace: {
                source: { amount: "10", currency: "EUR" },
                rate: { value: "0.9", pair: "EUR/USD" },
              },
            },
          ],
        }),
      );
      const result = loadDerivedPrices(tmpDir);
      expect(result).not.toBeNull();
      expect(Object.keys(result!)).toContain("https://warpgogol.com/id/offerings/hosting");
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
