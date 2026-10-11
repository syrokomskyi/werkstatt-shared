import { describe, it, expect } from "vitest";
import {
  ctaVariantSchema,
  ctaSizeSchema,
  ctaIconPositionSchema,
  ctaTargetSchema,
} from "../section-cta.ts";

describe("ctaVariantSchema", () => {
  it("accepts valid variants", () => {
    for (const v of ["primary", "secondary", "ghost", "danger"]) {
      expect(ctaVariantSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid variant", () => {
    expect(() => ctaVariantSchema.parse("link")).toThrow();
  });
});

describe("ctaSizeSchema", () => {
  it("accepts valid sizes", () => {
    for (const s of ["sm", "md", "lg"]) {
      expect(ctaSizeSchema.parse(s)).toBe(s);
    }
  });

  it("rejects invalid size", () => {
    expect(() => ctaSizeSchema.parse("xl")).toThrow();
  });
});

describe("ctaIconPositionSchema", () => {
  it("accepts valid positions", () => {
    expect(ctaIconPositionSchema.parse("leading")).toBe("leading");
    expect(ctaIconPositionSchema.parse("trailing")).toBe("trailing");
  });

  it("rejects invalid position", () => {
    expect(() => ctaIconPositionSchema.parse("top")).toThrow();
  });
});

// RFC-1257: CtaTarget is a discriminated union — internal (with bounded
// query map), external, and same-page anchor. Legacy bare-string targets are
// rejected after the migration.
describe("ctaTargetSchema (RFC-1257)", () => {
  it("accepts an internal target with pageId only", () => {
    expect(ctaTargetSchema.parse({ kind: "internal", pageId: "contact" })).toEqual({
      kind: "internal",
      pageId: "contact",
    });
  });

  it("accepts an internal target with query and anchor", () => {
    expect(
      ctaTargetSchema.parse({
        kind: "internal",
        pageId: "contact",
        query: { scenario: "bestand" },
        anchor: "send-message",
      }),
    ).toEqual({
      kind: "internal",
      pageId: "contact",
      query: { scenario: "bestand" },
      anchor: "send-message",
    });
  });

  it("accepts external and anchor targets", () => {
    expect(ctaTargetSchema.parse({ kind: "external", href: "https://example.com" })).toEqual({
      kind: "external",
      href: "https://example.com",
    });
    expect(ctaTargetSchema.parse({ kind: "anchor", anchor: "zusagen" })).toEqual({
      kind: "anchor",
      anchor: "zusagen",
    });
  });

  it("rejects legacy bare-string targets", () => {
    expect(ctaTargetSchema.safeParse("contact").success).toBe(false);
    expect(ctaTargetSchema.safeParse("#zusagen").success).toBe(false);
  });

  it("rejects unknown kinds and extra keys", () => {
    expect(ctaTargetSchema.safeParse({ kind: "mailto", href: "x@y.z" }).success).toBe(false);
    expect(
      ctaTargetSchema.safeParse({ kind: "internal", pageId: "contact", extra: 1 }).success,
    ).toBe(false);
  });

  it("bounds query keys and values by the shared charset patterns", () => {
    const base = { kind: "internal", pageId: "contact" } as const;
    // key too long / illegal charset
    expect(ctaTargetSchema.safeParse({ ...base, query: { ["a".repeat(33)]: "v" } }).success).toBe(
      false,
    );
    expect(ctaTargetSchema.safeParse({ ...base, query: { "bad key!": "v" } }).success).toBe(false);
    // value too long / illegal charset
    expect(ctaTargetSchema.safeParse({ ...base, query: { k: "v".repeat(129) } }).success).toBe(
      false,
    );
    expect(ctaTargetSchema.safeParse({ ...base, query: { k: "v v" } }).success).toBe(false);
    // legal percent/underscore/dash/dot values pass
    expect(
      ctaTargetSchema.safeParse({ ...base, query: { ref: "ost-post", t: "20%off_x.y" } }).success,
    ).toBe(true);
  });

  it("rejects query on external and anchor variants", () => {
    expect(
      ctaTargetSchema.safeParse({ kind: "external", href: "https://x.y", query: {} }).success,
    ).toBe(false);
    expect(ctaTargetSchema.safeParse({ kind: "anchor", anchor: "a", query: {} }).success).toBe(
      false,
    );
  });
});
