/*
<MODULE_CONTRACT>
<purpose>
Unit tests for the RFC-1289 inline-markdown contract (renderInlineMarkdown,
inlineMarkdownToPlain) covering link/bold/italic projections. Guards the
DIST-LEAK-07 regression: plain-text surfaces must never carry […](…) residue.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>warpgogol-m000202: initial coverage for the shared inline-markdown contract.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, test } from "vitest";
import {
  inlineMarkdownToPlain,
  renderInlineMarkdown,
} from "../inline-markdown.ts";

describe("renderInlineMarkdown", () => {
  test("renders a link as a safe external anchor", () => {
    expect(renderInlineMarkdown("see [docs](https://x.test/a) now")).toBe(
      'see <a href="https://x.test/a" target="_blank" rel="noopener noreferrer">docs</a> now'
    );
  });

  test("escapes HTML before linking", () => {
    expect(renderInlineMarkdown("<b>[x](https://x.test)</b>")).toContain("&lt;b&gt;");
  });
});

describe("inlineMarkdownToPlain", () => {
  test("projects [text](url) to its label", () => {
    expect(
      inlineMarkdownToPlain(
        "Programmierer — [Berufserfahrung: LinkedIn-Profil](https://linkedin.com/in/syrokomskyi)."
      )
    ).toBe("Programmierer — Berufserfahrung: LinkedIn-Profil.");
  });

  test("projects bold and italic markers away", () => {
    expect(inlineMarkdownToPlain("**bold** and *italics*")).toBe("bold and italics");
  });

  test("leaves plain text unchanged", () => {
    expect(inlineMarkdownToPlain("nothing to strip.")).toBe("nothing to strip.");
  });
});
