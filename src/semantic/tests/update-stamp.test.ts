import { describe, expect, it } from "vitest";
import {
  isValidStampDate,
  resolveAuthoredStamp,
  resolveCklStamp,
  resolvePageUpdateStamp,
} from "../update-stamp.ts";

describe("isValidStampDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(isValidStampDate("2024-01-15")).toBe(true);
  });

  it("rejects non-string", () => {
    expect(isValidStampDate(20240115)).toBe(false);
  });

  it("rejects wrong format", () => {
    expect(isValidStampDate("2024/01/15")).toBe(false);
    expect(isValidStampDate("January 15, 2024")).toBe(false);
  });
});

describe("resolveAuthoredStamp", () => {
  it("uses output.sitemap.lastmod first", () => {
    const result = resolveAuthoredStamp({
      output: { sitemap: { lastmod: "2024-06-01" } },
    });
    expect(result?.date).toBe("2024-06-01");
    expect(result?.source).toBe("authored-system-output");
  });

  it("uses article.updatedAt when no sitemap lastmod", () => {
    const result = resolveAuthoredStamp({
      article: { updatedAt: "2024-05-01" },
    });
    expect(result?.date).toBe("2024-05-01");
    expect(result?.source).toBe("authored-page-frontmatter");
  });

  it("uses article.publishedAt when no updatedAt", () => {
    const result = resolveAuthoredStamp({
      article: { publishedAt: "2024-01-01" },
    });
    expect(result?.date).toBe("2024-01-01");
  });

  it("returns undefined when no valid dates", () => {
    expect(resolveAuthoredStamp({})).toBeUndefined();
  });

  it("ignores invalid date formats", () => {
    expect(resolveAuthoredStamp({ article: { updatedAt: "not-a-date" } })).toBeUndefined();
  });
});

describe("resolveCklStamp", () => {
  it("returns latest valid date", () => {
    const result = resolveCklStamp(["2024-01-01", "2024-06-15", "2024-03-01"], ["ledger"]);
    expect(result?.date).toBe("2024-06-15");
    expect(result?.source).toBe("ckl-claim-ledger");
  });

  it("returns undefined when no valid dates", () => {
    expect(resolveCklStamp(["invalid"], ["ledger"])).toBeUndefined();
  });
});

describe("resolvePageUpdateStamp", () => {
  it("prefers authored stamp over CKL", () => {
    const result = resolvePageUpdateStamp({
      pageId: "p1",
      lang: "de",
      pageEntry: { output: { sitemap: { lastmod: "2024-06-01" } } },
      cklLedgerDates: ["2024-01-01"],
    });
    expect(result.stamp?.date).toBe("2024-06-01");
    expect(result.stamp?.source).toBe("authored-system-output");
  });

  it("falls back to CKL when no authored stamp", () => {
    const result = resolvePageUpdateStamp({
      pageId: "p1",
      lang: "de",
      pageEntry: {},
      cklLedgerDates: ["2024-03-01"],
      cklInputs: ["ledger"],
    });
    expect(result.stamp?.date).toBe("2024-03-01");
    expect(result.stamp?.source).toBe("ckl-claim-ledger");
  });

  it("returns missingReason when no sources available", () => {
    const result = resolvePageUpdateStamp({
      pageId: "p1",
      lang: "de",
      pageEntry: {},
    });
    expect(result.stamp).toBeUndefined();
    expect(result.missingReason).toBe("no-content-source");
  });
});
