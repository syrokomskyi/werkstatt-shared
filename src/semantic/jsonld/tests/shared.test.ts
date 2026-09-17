import { describe, expect, it } from "vitest";
import { dedupeGraph } from "../shared.ts";
import type { JsonLdNode } from "../types.ts";

describe("dedupeGraph", () => {
  it("returns empty array for empty input", () => {
    expect(dedupeGraph([])).toEqual([]);
  });

  it("removes duplicate nodes by @id", () => {
    const nodes: JsonLdNode[] = [
      { "@id": "org-1", "@type": "Organization", name: "Org" },
      { "@id": "org-1", "@type": "Organization", name: "Duplicate" },
      { "@id": "org-2", "@type": "Organization", name: "Other" },
    ];
    const result = dedupeGraph(nodes);
    expect(result).toHaveLength(2);
    expect(result[0]["@id"]).toBe("org-1");
    expect(result[0].name).toBe("Org");
    expect(result[1]["@id"]).toBe("org-2");
  });

  it("preserves first occurrence of duplicates", () => {
    const nodes: JsonLdNode[] = [
      { "@id": "a", value: "first" },
      { "@id": "a", value: "second" },
    ];
    const result = dedupeGraph(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("first");
  });

  it("keeps nodes without @id", () => {
    const nodes: JsonLdNode[] = [
      { "@type": "Thing", name: "No ID" },
      { "@type": "Thing", name: "Also No ID" },
    ];
    const result = dedupeGraph(nodes);
    expect(result).toHaveLength(2);
  });
});
