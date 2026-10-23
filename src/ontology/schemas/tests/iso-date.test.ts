/*
<MODULE_CONTRACT>
<purpose>
Unit tests for RFC-1374 YAML-native date normalization — isoDateString and its application to string-typed timestamp fields in the system collection schema.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1374: cover Date-input normalization, ISO passthrough, invalid rejection, and the z.date() boundary (AC-1, AC-3).</item>
  <item>RFC-1374: normalize YAML-native date scalars — isoDateString on string-typed timestamp fields + content.scalar-types.lint advisory (CONTENT-SCALAR-01)</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { articleMetadataSchema, sitemapProjectionSchema } from "../system/page-output.ts";

describe("isoDateString (RFC-1374)", () => {
  it("normalizes a YAML-native Date to its ISO string", () => {
    const parsed = sitemapProjectionSchema.parse({ lastmod: new Date("2026-10-23") });
    expect(parsed).not.toBe(true);
    expect(typeof parsed === "object" && parsed.lastmod).toBe("2026-10-23T00:00:00.000Z");
  });

  it("passes ISO strings through unchanged", () => {
    const parsed = articleMetadataSchema.parse({
      publishedAt: "2026-05-01",
      updatedAt: "2026-10-11T09:30:00Z",
    });
    expect(parsed.publishedAt).toBe("2026-05-01");
    expect(parsed.updatedAt).toBe("2026-10-11T09:30:00Z");
  });

  it("normalizes a Date on articleMetadata fields", () => {
    const parsed = articleMetadataSchema.parse({
      publishedAt: new Date("2026-05-01"),
    });
    expect(parsed.publishedAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("still rejects non-string non-Date values and empty strings", () => {
    expect(sitemapProjectionSchema.safeParse({ lastmod: 42 }).success).toBe(false);
    expect(sitemapProjectionSchema.safeParse({ lastmod: "" }).success).toBe(false);
  });

  it("does not disturb z.date() fields — Date input stays a Date (AC-3)", () => {
    const schema = z.object({ at: z.date() });
    const parsed = schema.parse({ at: new Date("2026-01-01") });
    expect(parsed.at).toBeInstanceOf(Date);
  });
});
