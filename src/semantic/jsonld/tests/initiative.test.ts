import { describe, expect, it } from "vitest";
import { buildInitiativeNodes, buildInitiativesListNode } from "../initiative.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildInitiativeNodes", () => {
  it("returns empty array when no initiatives", () => {
    const page = makePage();
    const ctx = createJsonLdContext(page);
    expect(buildInitiativeNodes(ctx)).toEqual([]);
  });

  it("builds Thing/Project nodes for each initiative", () => {
    const page = makePage({
      initiatives: [
        { id: "i1", name: "Project Alpha", summary: "First project" },
        { id: "i2", name: "Project Beta", summary: "Second project" },
      ],
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildInitiativeNodes(ctx);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]["@type"]).toEqual(["Thing", "Project"]);
    expect(nodes[0].name).toBe("Project Alpha");
    expect(nodes[0].description).toBe("First project");
    expect(nodes[1].name).toBe("Project Beta");
  });
});

describe("buildInitiativesListNode", () => {
  it("returns null when no initiatives", () => {
    const page = makePage();
    const ctx = createJsonLdContext(page);
    expect(buildInitiativesListNode(ctx)).toBeNull();
  });

  it("builds ItemList with positioned initiatives", () => {
    const page = makePage({
      initiatives: [
        { id: "i1", name: "Project Alpha", summary: "First" },
        { id: "i2", name: "Project Beta", summary: "Second" },
      ],
    });
    const ctx = createJsonLdContext(page);
    const node = buildInitiativesListNode(ctx);
    expect(node).not.toBeNull();
    expect(node!["@type"]).toBe("ItemList");
    expect(node!.itemListElement).toHaveLength(2);
    expect(node as Record<string, unknown>).toMatchObject({
      itemListElement: [
        { position: 1, name: "Project Alpha" },
        { position: 2, name: "Project Beta" },
      ],
    });
  });
});
