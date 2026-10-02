import { describe, it, expect } from "vitest";
import {
  matchesSharedBlock,
  resolveSharedContextProps,
  type SharedContextPageLike,
} from "../shared-context.ts";

function pageMap(
  ...pages: Array<{ pageId: string; blocks: Array<Record<string, unknown>> }>
): Map<string, SharedContextPageLike> {
  return new Map(
    pages.map((page) => [
      page.pageId,
      {
        pageId: page.pageId,
        blocks: page.blocks as SharedContextPageLike["blocks"],
      },
    ]),
  );
}

describe("resolveSharedContextProps (RFC-1185)", () => {
  it("merges source-authored props under own props via a shallow top-level merge (AC-1)", () => {
    const pages = pageMap(
      {
        pageId: "home",
        blocks: [
          {
            id: "cta",
            type: "Europa",
            props: {
              headline: "Source headline",
              cta: { label: "Source label", href: "/source" },
            },
          },
        ],
      },
      { pageId: "pricing", blocks: [] },
    );

    const resolved = resolveSharedContextProps({
      block: {
        id: "cta",
        type: "Europa",
        inherit: "home",
        props: { cta: { label: "Own label" } },
      },
      pages,
    });

    // `cta` is authored on the consuming block → wholesale replacement, no
    // nested merge of the source's `href` into it.
    expect(resolved).toEqual({
      headline: "Source headline",
      cta: { label: "Own label" },
    });
  });

  it("returns authored props untouched when no inherit edge is declared (AC-2)", () => {
    const pages = pageMap({
      pageId: "home",
      blocks: [
        {
          id: "cta",
          type: "Europa",
          props: { headline: "Source headline" },
        },
      ],
    });

    const resolved = resolveSharedContextProps({
      block: { id: "cta", type: "Europa", props: { headline: "Own" } },
      pages,
    });

    expect(resolved).toEqual({ headline: "Own" });
  });

  it("does not follow the source block's own inherit edge — single hop only (AC-3)", () => {
    const pages = pageMap(
      {
        pageId: "home",
        blocks: [
          {
            id: "cta",
            type: "Europa",
            inherit: "foundation",
            props: { headline: "Home headline" },
          },
        ],
      },
      {
        pageId: "foundation",
        blocks: [
          {
            id: "cta",
            type: "Europa",
            props: { subline: "Foundation subline" },
          },
        ],
      },
    );

    const resolved = resolveSharedContextProps({
      block: { id: "cta", type: "Europa", inherit: "home", props: {} },
      pages,
    });

    // Only the named source's *authored* props are merged — `subline` from
    // `foundation` must not leak through the source's own edge.
    expect(resolved).toEqual({ headline: "Home headline" });
  });

  it("treats inherit: false as an explicit opt-out (AC-9 semantics)", () => {
    const pages = pageMap({
      pageId: "home",
      blocks: [
        { id: "cta", type: "Europa", props: { headline: "Source" } },
      ],
    });

    const resolved = resolveSharedContextProps({
      block: { id: "cta", type: "Europa", inherit: false, props: { x: 1 } },
      pages,
    });

    expect(resolved).toEqual({ x: 1 });
  });

  it("returns authored props when the source page is missing", () => {
    const resolved = resolveSharedContextProps({
      block: { id: "cta", type: "Europa", inherit: "nowhere", props: { x: 1 } },
      pages: pageMap({ pageId: "home", blocks: [] }),
    });

    expect(resolved).toEqual({ x: 1 });
  });

  it("returns authored props when the source page has no matching block", () => {
    const pages = pageMap({
      pageId: "home",
      blocks: [
        { id: "other", type: "Europa", props: { headline: "Source" } },
      ],
    });

    const resolved = resolveSharedContextProps({
      block: { id: "cta", type: "Europa", inherit: "home", props: {} },
      pages,
    });

    expect(resolved).toEqual({});
  });

  it("does not match a source block with a different selector", () => {
    const pages = pageMap({
      pageId: "home",
      blocks: [
        { id: "cta", type: "Io", props: { headline: "Source" } },
      ],
    });

    const resolved = resolveSharedContextProps({
      block: { id: "cta", type: "Europa", inherit: "home", props: { x: 1 } },
      pages,
    });

    expect(resolved).toEqual({ x: 1 });
  });
});

describe("matchesSharedBlock", () => {
  it("requires identical ids", () => {
    expect(
      matchesSharedBlock(
        { id: "a", type: "Europa" },
        { id: "b", type: "Europa" },
      ),
    ).toBe(false);
  });

  it("requires identical selectors when both declare one", () => {
    expect(
      matchesSharedBlock(
        { id: "a", type: "Europa" },
        { id: "a", type: "Io" },
      ),
    ).toBe(false);
    expect(
      matchesSharedBlock(
        { id: "a", type: "Europa" },
        { id: "a", use: "Europa" },
      ),
    ).toBe(true);
  });

  it("matches on id alone when a selector is absent", () => {
    expect(matchesSharedBlock({ id: "a" }, { id: "a", type: "Io" })).toBe(true);
  });
});
