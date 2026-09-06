import { describe, expect, it } from "vitest";
import { buildBreadcrumbNode } from "../breadcrumb.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildBreadcrumbNode", () => {
  it("returns null when only one breadcrumb", () => {
    const page = makePage({
      breadcrumbs: [{ name: "Home", url: "https://example.com/de/" }],
    });
    const ctx = createJsonLdContext(page);
    expect(buildBreadcrumbNode(ctx)).toBeNull();
  });

  it("builds BreadcrumbList with multiple crumbs", () => {
    const page = makePage({
      breadcrumbs: [
        { name: "Home", url: "https://example.com/de/" },
        { name: "About", url: "https://example.com/de/about/" },
      ],
    });
    const ctx = createJsonLdContext(page);
    const node = buildBreadcrumbNode(ctx);
    expect(node).not.toBeNull();
    expect(node!["@type"]).toBe("BreadcrumbList");
    expect(node!.itemListElement).toHaveLength(2);
    expect(node as Record<string, unknown>).toMatchObject({
      itemListElement: [
        { position: 1, name: "Home" },
        { position: 2, name: "About" },
      ],
    });
  });

  it("resolves relative crumb URLs against page URL", () => {
    const page = makePage({
      breadcrumbs: [
        { name: "Home", url: "/de/" },
        { name: "About", url: "/de/about/" },
      ],
    });
    const ctx = createJsonLdContext(page);
    const node = buildBreadcrumbNode(ctx);
    const items = (node as Record<string, unknown[]>).itemListElement as Record<string, unknown>[];
    expect(items[0].item).toBe("https://example.com/de/");
    expect(items[1].item).toBe("https://example.com/de/about/");
  });

  it("assigns position-scoped @id to each crumb", () => {
    const page = makePage({
      breadcrumbs: [
        { name: "Home", url: "https://example.com/de/" },
        { name: "About", url: "https://example.com/de/about/" },
      ],
    });
    const ctx = createJsonLdContext(page);
    const node = buildBreadcrumbNode(ctx);
    const items = (node as Record<string, unknown[]>).itemListElement as Record<string, unknown>[];
    expect(items[0]["@id"]).toBe(`${ctx.breadcrumbId}/1`);
    expect(items[1]["@id"]).toBe(`${ctx.breadcrumbId}/2`);
  });
});
