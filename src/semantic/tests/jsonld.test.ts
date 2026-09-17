import { describe, expect, it } from "vitest";
import { buildJsonLd } from "../jsonld.ts";
import { makePage } from "./helpers.ts";

describe("buildJsonLd", () => {
  it("produces a valid JSON-LD document with @context and @graph", () => {
    const page = makePage();
    const doc = buildJsonLd(page);
    expect(doc["@context"]).toBe("https://schema.org");
    expect(Array.isArray(doc["@graph"])).toBe(true);
    expect(doc["@graph"].length).toBeGreaterThan(0);
  });

  it("includes Organization and WebSite nodes in graph", () => {
    const page = makePage();
    const doc = buildJsonLd(page);
    const types = doc["@graph"].map((n) => n["@type"]);
    expect(types.some((t) => Array.isArray(t) && t.includes("Organization"))).toBe(true);
    expect(types.some((t) => t === "WebSite" || (Array.isArray(t) && t.includes("WebSite")))).toBe(
      true,
    );
  });

  it("includes WebPage node in graph", () => {
    const page = makePage();
    const doc = buildJsonLd(page);
    const types = doc["@graph"].map((n) => n["@type"]);
    expect(types.some((t) => Array.isArray(t) && t.includes("WebPage"))).toBe(true);
  });

  it("deduplicates graph nodes by @id", () => {
    const page = makePage();
    const doc = buildJsonLd(page);
    const ids = doc["@graph"].map((n) => n["@id"]).filter(Boolean);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("includes BreadcrumbList when breadcrumbs > 1", () => {
    const page = makePage({
      breadcrumbs: [
        { name: "Home", url: "https://example.com/de/" },
        { name: "About", url: "https://example.com/de/about/" },
      ],
    });
    const doc = buildJsonLd(page);
    const types = doc["@graph"].map((n) => n["@type"]);
    expect(types).toContain("BreadcrumbList");
  });

  it("includes extraGraphNodes when provided", () => {
    const page = makePage({
      extraGraphNodes: [
        { "@type": "SoftwareApplication", "@id": "https://example.com/#/schema/app", name: "App" },
      ],
    });
    const doc = buildJsonLd(page);
    const ids = doc["@graph"].map((n) => n["@id"]);
    expect(ids).toContain("https://example.com/#/schema/app");
  });
});
