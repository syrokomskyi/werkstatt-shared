import { describe, expect, it } from "vitest";
import { buildPersonNodes } from "../person.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildPersonNodes", () => {
  it("returns empty array when no people, founders, or boardMembers", () => {
    const page = makePage();
    const ctx = createJsonLdContext(page);
    expect(buildPersonNodes(ctx)).toEqual([]);
  });

  it("builds Person nodes from page.people", () => {
    const page = makePage({
      people: [{ name: "Jane Doe", role: "CEO", description: "A leader" }],
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildPersonNodes(ctx);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]["@type"]).toBe("Person");
    expect(nodes[0].name).toBe("Jane Doe");
    expect(nodes[0].jobTitle).toBe("CEO");
    expect(nodes[0].description).toBe("A leader");
    expect(nodes[0].worksFor).toEqual({ "@id": ctx.ids.organization });
  });

  it("merges founders, boardMembers, and people with deduplication by name", () => {
    const page = makePage({
      organization: makePage().organization,
      people: [{ name: "Jane Doe", role: "CEO" }],
    });
    page.organization.founders = [{ name: "Jane Doe", role: "Founder" }];
    page.organization.boardMembers = [{ name: "John Smith", role: "Board Member" }];
    const ctx = createJsonLdContext(page);
    const nodes = buildPersonNodes(ctx);
    expect(nodes).toHaveLength(2);
    const names = nodes.map((n) => n.name);
    expect(names).toContain("Jane Doe");
    expect(names).toContain("John Smith");
  });

  it("emits extended fields (address, knowsAbout, affiliation)", () => {
    const page = makePage({
      people: [
        {
          name: "Jane Doe",
          address: { addressLocality: "Berlin", addressCountry: "DE" },
          knowsAbout: ["AI", "Cloud"],
          affiliation: { name: "Warpgogol", url: "https://example.com" },
        },
      ],
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildPersonNodes(ctx);
    expect(nodes[0].address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Berlin",
      addressCountry: "DE",
    });
    expect(nodes[0].knowsAbout).toEqual(["AI", "Cloud"]);
    expect(nodes[0].affiliation).toEqual({
      "@type": "Organization",
      name: "Warpgogol",
      url: "https://example.com",
    });
  });

  it("emits birthDate, deathDate, image, sameAs, profileUrl", () => {
    const page = makePage({
      people: [
        {
          name: "Jane Doe",
          birthDate: "1980",
          deathDate: "2024",
          image: "https://example.com/jane.jpg",
          sameAs: ["https://linkedin.com/in/jane"],
          profileUrl: "https://example.com/de/team/jane/",
        },
      ],
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildPersonNodes(ctx);
    expect(nodes[0].birthDate).toBe("1980");
    expect(nodes[0].deathDate).toBe("2024");
    expect(nodes[0].image).toBe("https://example.com/jane.jpg");
    expect(nodes[0].sameAs).toEqual(["https://linkedin.com/in/jane"]);
    expect(nodes[0].url).toBe("https://example.com/de/team/jane/");
  });
});
