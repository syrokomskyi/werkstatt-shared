/*
<MODULE_CONTRACT>
<purpose>
Unit tests for extractLinkTargets — the shared props-walking internal-link extractor
generalized for RFC-0383 surface.graph.validate. Covers route/absolute/pageId
classification, nested arrays/objects, dedup, and non-link string exclusion.
</purpose>
<non-goals>
  <item>Not a contract source of truth — substance.ts owns the authoritative extraction behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0383: initial coverage for the exported extractor + substance score parity.</item>
  <item>RFC-0383: add surface.graph.validate link-structure diagnostics (GRAPH-01..07)</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, test } from "vitest";
import { extractLinkTargets, scoreSubstance, buildTokenDocFreq } from "../substance.ts";
import type { PageEntry } from "../types.ts";

function page(props: Record<string, unknown>): PageEntry {
  return {
    kind: "page",
    cosmicStar: "Test",
    title: "t",
    description: "d",
    lang: "de",
    blocks: [{ props }],
  };
}

describe("extractLinkTargets", () => {
  test("classifies relative routes, absolute URLs, and CtaTarget pageIds", () => {
    const targets = extractLinkTargets(
      page({
        href: "/website/elektriker/",
        external: "https://example.com/x",
        cta: { kind: "internal", pageId: "website-local:a:b" },
      }),
    );
    expect(targets).toContainEqual({ kind: "route", href: "/website/elektriker/" });
    expect(targets).toContainEqual({ kind: "absolute", href: "https://example.com/x" });
    expect(targets).toContainEqual({ kind: "pageId", pageId: "website-local:a:b" });
    expect(targets.size).toBe(3);
  });

  test("walks nested arrays and objects", () => {
    const targets = extractLinkTargets(
      page({
        items: [{ link: { href: "/a" } }, ["/b", { deep: { href: "/c" } }]],
      }),
    );
    expect(targets.size).toBe(3);
    expect(targets).toContainEqual({ kind: "route", href: "/a" });
    expect(targets).toContainEqual({ kind: "route", href: "/b" });
    expect(targets).toContainEqual({ kind: "route", href: "/c" });
  });

  test("dedupes identical targets", () => {
    const targets = extractLinkTargets(page({ a: "/x", b: ["/x", { href: "/x" }] }));
    expect(targets.size).toBe(1);
  });

  test("excludes non-link strings (mailto, tel, anchors, text)", () => {
    const targets = extractLinkTargets(
      page({
        mail: "mailto:info@x.de",
        phone: "tel:+49123",
        anchor: "#top",
        text: "plain copy",
        http2: "ftp://x",
      }),
    );
    expect(targets.size).toBe(0);
  });

  test("CtaTarget nodes count their pageId and do not recurse", () => {
    const targets = extractLinkTargets(
      page({
        cta: { kind: "internal", pageId: "p:1", href: "/ignored-when-internal" },
      }),
    );
    // early-return on CtaTarget: the sibling href inside the node is NOT visited
    expect(targets.size).toBe(1);
    expect(targets).toContainEqual({ kind: "pageId", pageId: "p:1" });
  });

  test("empty blocks yield an empty set", () => {
    const p: PageEntry = {
      kind: "page",
      cosmicStar: "T",
      title: "t",
      description: "d",
      lang: "de",
      blocks: [],
    };
    expect(extractLinkTargets(p).size).toBe(0);
  });
});

describe("countLinkTargets parity (scoreSubstance unchanged)", () => {
  test("linkDiversity counts the same targets the old private walker counted", () => {
    const p = page({
      a: "/x",
      b: "/x",
      c: "https://ext.example/y",
      cta: { kind: "internal", pageId: "p:9" },
      noise: "mailto:a@b.de",
    });
    // 3 distinct targets: /x (dedup), https://ext..., p:9
    const pages = [p];
    const docFreq = buildTokenDocFreq(pages);
    const score = scoreSubstance(p, { docFreq, totalPages: 1 });
    expect(score.components.linkDiversity).toBe(3);
  });
});
