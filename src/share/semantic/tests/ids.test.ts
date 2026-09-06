import { describe, expect, it } from "vitest";
import {
  canonicalRootUrl,
  createSemanticIds,
  getBaseUrl,
  markdownTwinRelPath,
  markdownTwinUrlPath,
  toAbsoluteUrl,
  toCanonicalUrl,
  toPathname,
} from "../ids.ts";

describe("getBaseUrl", () => {
  it("returns origin from string URL", () => {
    expect(getBaseUrl("https://example.com/de/page")).toBe("https://example.com");
  });

  it("returns origin from URL object", () => {
    expect(getBaseUrl(new URL("https://example.com/de/page?q=1"))).toBe("https://example.com");
  });
});

describe("toCanonicalUrl", () => {
  it("strips search and hash", () => {
    expect(toCanonicalUrl("https://example.com/de/page?q=1#top")).toBe(
      "https://example.com/de/page",
    );
  });
});

describe("toAbsoluteUrl", () => {
  it("resolves relative path against base", () => {
    expect(toAbsoluteUrl("https://example.com", "/de/page")).toBe("https://example.com/de/page");
  });
});

describe("canonicalRootUrl", () => {
  it("returns unprefixed root URL", () => {
    expect(canonicalRootUrl("https://example.com")).toBe("https://example.com/");
  });
});

describe("toPathname", () => {
  it("extracts pathname from URL string", () => {
    expect(toPathname("https://example.com/de/page?q=1")).toBe("/de/page");
  });
});

describe("markdownTwinRelPath", () => {
  const opts = { supportedLangs: ["de", "uk"] };

  it("returns index.md for root path", () => {
    expect(markdownTwinRelPath("/", opts)).toBe("index.md");
  });

  it("returns lang-root index for language root", () => {
    expect(markdownTwinRelPath("/de/", opts)).toBe("de/index.md");
  });

  it("returns nested path as .md file", () => {
    expect(markdownTwinRelPath("/de/about/", opts)).toBe("de/about.md");
  });
});

describe("markdownTwinUrlPath", () => {
  it("prefixes rel path with slash", () => {
    expect(markdownTwinUrlPath("/de/about/", { supportedLangs: ["de"] })).toBe("/de/about.md");
  });
});

describe("createSemanticIds", () => {
  const ids = createSemanticIds("https://example.com");

  it("generates organization id", () => {
    expect(ids.organization).toBe("https://example.com/#/schema/organization");
  });

  it("generates website id", () => {
    expect(ids.website).toBe("https://example.com/#/schema/website");
  });

  it("generates webpage id from page URL", () => {
    expect(ids.webpage("https://example.com/de/page")).toBe(
      "https://example.com/de/page#/schema/webpage",
    );
  });

  it("generates breadcrumb id from page URL", () => {
    expect(ids.breadcrumb("https://example.com/de/page")).toBe(
      "https://example.com/de/page#/schema/breadcrumb",
    );
  });

  it("generates person id with slugified name", () => {
    expect(ids.person("Jane Doe")).toBe("https://example.com/#/schema/person/jane-doe");
  });

  it("generates initiative id with slugified name", () => {
    expect(ids.initiative("Project Alpha")).toBe(
      "https://example.com/#/schema/initiative/project-alpha",
    );
  });

  it("generates service id with slugified name", () => {
    expect(ids.service("Web Hosting")).toBe("https://example.com/#/schema/service/web-hosting");
  });

  it("generates faq id from page URL", () => {
    expect(ids.faq("https://example.com/de/page")).toBe(
      "https://example.com/de/page#/schema/faq",
    );
  });

  it("strips trailing slash from baseUrl", () => {
    const ids2 = createSemanticIds("https://example.com/");
    expect(ids2.organization).toBe("https://example.com/#/schema/organization");
  });
});
