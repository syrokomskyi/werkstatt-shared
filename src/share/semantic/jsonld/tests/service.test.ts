import { describe, expect, it } from "vitest";
import { buildServiceNodes } from "../service.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildServiceNodes", () => {
  it("returns org-level Service nodes for non-surface pages", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.services = [
      { id: "s1", name: "Hosting", description: "Managed hosting" },
      { id: "s2", name: "Security" },
    ];
    const ctx = createJsonLdContext(page);
    const nodes = buildServiceNodes(ctx);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]["@type"]).toBe("Service");
    expect(nodes[0].name).toBe("Hosting");
    expect(nodes[0].description).toBe("Managed hosting");
    expect(nodes[0].provider).toEqual({ "@id": ctx.ids.organization });
  });

  it("emits industry-specific Service node when industryService is present", () => {
    const page = makePage({
      surfaceId: "website-local",
      depth: 1,
      industryService: {
        serviceType: "Web Development",
        audience: "Nonprofits",
        description: "Custom web development",
        areaServed: "Berlin",
      },
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildServiceNodes(ctx);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]["@type"]).toBe("Service");
    expect(nodes[0].serviceType).toBe("Web Development");
    expect(nodes[0].audience).toEqual({ "@type": "Audience", name: "Nonprofits" });
    expect(nodes[0].areaServed).toEqual({ "@type": "City", name: "Berlin" });
  });

  it("suppresses Service nodes for surface pages without industryService at prohibited depths", () => {
    const page = makePage({
      surfaceId: "website-local",
      depth: 0,
    });
    const ctx = createJsonLdContext(page);
    expect(buildServiceNodes(ctx)).toEqual([]);
  });

  it("emits org-level Service nodes for surface depth-1 without industryService", () => {
    const page = makePage({
      surfaceId: "website-local",
      depth: 1,
      organization: makePage().organization,
    });
    page.organization.services = [{ id: "s1", name: "Consulting" }];
    const ctx = createJsonLdContext(page);
    const nodes = buildServiceNodes(ctx);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe("Consulting");
  });
});
