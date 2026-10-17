/*
<MODULE_CONTRACT>
<purpose>
Unit tests for faq covering buildFaqPageNode; buildFaqNodes. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the faq suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { buildFaqNodes, buildFaqPageNode } from "../faq.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildFaqPageNode", () => {
  it("returns null when no faqEntries", () => {
    const page = makePage();
    const ctx = createJsonLdContext(page);
    expect(buildFaqPageNode(ctx)).toBeNull();
  });

  it("returns null when faqEntries is empty", () => {
    const page = makePage({ faqEntries: [] });
    const ctx = createJsonLdContext(page);
    expect(buildFaqPageNode(ctx)).toBeNull();
  });

  it("builds FAQPage with Question nodes", () => {
    const page = makePage({
      faqEntries: [
        { id: "q1", question: "What is this?", answer: "A test." },
        { id: "q2", question: "How much?", answer: "Free." },
      ],
    });
    const ctx = createJsonLdContext(page);
    const node = buildFaqPageNode(ctx);
    expect(node).not.toBeNull();
    expect(node!["@type"]).toBe("FAQPage");
    expect(node!.mainEntity).toHaveLength(2);
    const entities = (node as Record<string, unknown[]>).mainEntity as Record<string, unknown>[];
    expect(entities[0]).toEqual({
      "@type": "Question",
      name: "What is this?",
      acceptedAnswer: { "@type": "Answer", text: "A test." },
    });
  });
});

describe("buildFaqNodes", () => {
  it("suppresses FAQPage on ratgeber depth-1 article pages", () => {
    const page = makePage({
      surfaceId: "ratgeber",
      depth: 1,
      faqEntries: [{ id: "q1", question: "Q?", answer: "A." }],
    });
    const ctx = createJsonLdContext(page);
    expect(buildFaqNodes(ctx)).toEqual([]);
  });

  it("emits FAQPage for non-ratgeber pages with FAQ entries", () => {
    const page = makePage({
      faqEntries: [{ id: "q1", question: "Q?", answer: "A." }],
    });
    const ctx = createJsonLdContext(page);
    const nodes = buildFaqNodes(ctx);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]["@type"]).toBe("FAQPage");
  });
});
