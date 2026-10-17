/*
<MODULE_CONTRACT>
<purpose>
Unit tests for breadcrumbs covering stripSiteNameFromTitle; surfaceAncestorPageIds; buildBreadcrumbTrail. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the breadcrumbs suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import {
  buildBreadcrumbTrail,
  stripSiteNameFromTitle,
  surfaceAncestorPageIds,
  type BreadcrumbAncestorResolver,
} from "../breadcrumbs.ts";

describe("stripSiteNameFromTitle", () => {
  it("strips site name suffix", () => {
    expect(stripSiteNameFromTitle("About | Warpgogol")).toBe("About");
  });

  it("returns title unchanged when no separator", () => {
    expect(stripSiteNameFromTitle("About")).toBe("About");
  });

  it("trims whitespace", () => {
    expect(stripSiteNameFromTitle("  About  ")).toBe("About");
  });
});

describe("surfaceAncestorPageIds", () => {
  it("returns empty for non-surface pageId", () => {
    expect(surfaceAncestorPageIds("some-page")).toEqual([]);
  });

  it("returns empty for depth-0 root landing", () => {
    expect(surfaceAncestorPageIds("industry:_root")).toEqual([]);
  });

  it("returns root + intermediate ancestors for depth-2", () => {
    expect(surfaceAncestorPageIds("industry:tech:saas")).toEqual([
      "industry:_root",
      "industry:tech",
    ]);
  });
});

describe("buildBreadcrumbTrail", () => {
  const noopResolver: BreadcrumbAncestorResolver = {
    resolveAncestors: async () => [],
  };

  it("builds [Home, self] trail with no ancestors", async () => {
    const trail = await buildBreadcrumbTrail({
      pageId: "about",
      pageTitle: "About | Site",
      selfUrl: "https://example.com/de/about/",
      homeLabel: "Home",
      homeUrl: "https://example.com/de/",
      lang: "de",
      defaultLang: "de",
      resolver: noopResolver,
    });
    expect(trail).toHaveLength(2);
    expect(trail[0]).toEqual({ name: "Home", url: "https://example.com/de/" });
    expect(trail[1]).toEqual({
      name: "About",
      url: "https://example.com/de/about/",
      pageId: "about",
    });
  });

  it("inserts ancestors between Home and self", async () => {
    const resolver: BreadcrumbAncestorResolver = {
      resolveAncestors: async () => [{ name: "Section", url: "https://example.com/de/section/" }],
    };
    const trail = await buildBreadcrumbTrail({
      pageId: "page",
      pageTitle: "Page",
      selfUrl: "https://example.com/de/section/page/",
      homeLabel: "Home",
      homeUrl: "https://example.com/de/",
      lang: "de",
      defaultLang: "de",
      resolver,
    });
    expect(trail).toHaveLength(3);
    expect(trail[1]).toEqual({ name: "Section", url: "https://example.com/de/section/" });
  });

  it("deduplicates ancestors that collapse onto Home or self", async () => {
    const resolver: BreadcrumbAncestorResolver = {
      resolveAncestors: async () => [
        { name: "Home", url: "https://example.com/de/" },
        { name: "Self", url: "https://example.com/de/page/" },
        { name: "Real Ancestor", url: "https://example.com/de/real/" },
      ],
    };
    const trail = await buildBreadcrumbTrail({
      pageId: "page",
      pageTitle: "Page",
      selfUrl: "https://example.com/de/page/",
      homeLabel: "Home",
      homeUrl: "https://example.com/de/",
      lang: "de",
      defaultLang: "de",
      resolver,
    });
    expect(trail).toHaveLength(3);
    expect(trail[1]).toEqual({ name: "Real Ancestor", url: "https://example.com/de/real/" });
  });

  it("drops ancestors with empty names", async () => {
    const resolver: BreadcrumbAncestorResolver = {
      resolveAncestors: async () => [
        { name: "  ", url: "https://example.com/de/empty/" },
        { name: "Valid", url: "https://example.com/de/valid/" },
      ],
    };
    const trail = await buildBreadcrumbTrail({
      pageId: "page",
      pageTitle: "Page",
      selfUrl: "https://example.com/de/page/",
      homeLabel: "Home",
      homeUrl: "https://example.com/de/",
      lang: "de",
      defaultLang: "de",
      resolver,
    });
    expect(trail).toHaveLength(3);
    expect(trail[1]).toEqual({ name: "Valid", url: "https://example.com/de/valid/" });
  });
});
