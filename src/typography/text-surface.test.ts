/*
<MODULE_CONTRACT>
<purpose>
Unit tests for text surface covering deriveFileLocale; extractTextSurface. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1068: initial creation.</item>
  <item>RFC-1324: coverage for the frontmatter `lang` override over directory locale.</item>
  <item>RFC-1442: strict i18n.companion schema, companion-locale typography checks</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { extractTextSurface, deriveFileLocale } from "./text-surface.ts";

const LANGS = ["de", "uk", "en"];

describe("deriveFileLocale", () => {
  it("derives locale from content path", () => {
    expect(deriveFileLocale("src/content/pages/de/index.md", LANGS, "de")).toBe("de");
    expect(deriveFileLocale("src/content/pages/uk/index.md", LANGS, "de")).toBe("uk");
    expect(deriveFileLocale("src/content/pages/en/index.md", LANGS, "de")).toBe("en");
  });

  it("derives locale from mission workpiece content path", () => {
    expect(
      deriveFileLocale("missions/wg-m001/workpiece/src/content/pages/de/index.md", LANGS, "de"),
    ).toBe("de");
    expect(
      deriveFileLocale(
        "missions/wg-m001/workpiece/src/content/business-profile/uk/offerings/x.md",
        LANGS,
        "de",
      ),
    ).toBe("uk");
  });

  it("falls back to default language for unknown locale", () => {
    expect(deriveFileLocale("src/content/pages/fr/index.md", LANGS, "de")).toBe("de");
  });

  it("falls back to default language for non-content paths", () => {
    expect(deriveFileLocale("src/pages/index.astro", LANGS, "de")).toBe("de");
  });
});

describe("extractTextSurface", () => {
  it("extracts frontmatter strings", () => {
    const source = `---
title: Hello World
description: A test page
---
Body text here.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    expect(result.yamlError).toBeNull();
    const fmSegments = result.segments.filter((s) => s.source === "frontmatter");
    expect(fmSegments.length).toBeGreaterThanOrEqual(2);
    expect(fmSegments.some((s) => s.text.includes("Hello World"))).toBe(true);
    expect(fmSegments.some((s) => s.text.includes("A test page"))).toBe(true);
  });

  it("extracts body lines", () => {
    const source = `---
title: Test
---
This is a body paragraph.
Second line of text.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    const bodySegments = result.segments.filter((s) => s.source === "body");
    expect(bodySegments.length).toBe(2);
    expect(bodySegments[0].text).toContain("This is a body paragraph");
    expect(bodySegments[1].text).toContain("Second line of text");
  });

  it("honors a declared frontmatter lang over the directory locale (RFC-1329 binding docs)", () => {
    const source = `---
kind: prose
lang: de
---
Deutsche Rechtstexte.
`;
    const result = extractTextSurface("src/content/prose/uk/impressum.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    expect(result.segments.every((s) => s.locale === "de")).toBe(true);
  });

  it("falls back to the directory locale when no lang is declared", () => {
    const source = `---
title: Test
---
Body text.
`;
    const result = extractTextSurface("src/content/prose/uk/note.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    expect(result.segments.every((s) => s.locale === "uk")).toBe(true);
  });

  it("skips fenced code blocks", () => {
    const source = `---
title: Test
---
Normal text.
\`\`\`js
const x = "code block";
\`\`\`
After code.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    const bodySegments = result.segments.filter((s) => s.source === "body");
    expect(bodySegments.length).toBe(2);
    expect(bodySegments.some((s) => s.text.includes("Normal text"))).toBe(true);
    expect(bodySegments.some((s) => s.text.includes("After code"))).toBe(true);
    expect(bodySegments.some((s) => s.text.includes("code block"))).toBe(false);
  });

  it("skips technical keys", () => {
    const source = `---
title: Test
slug: my-page
id: abc123
href: https://example.com
description: Real text
---
Body.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    const fmSegments = result.segments.filter((s) => s.source === "frontmatter");
    expect(fmSegments.some((s) => s.text.includes("Real text"))).toBe(true);
    expect(fmSegments.some((s) => s.text.includes("abc123"))).toBe(false);
    expect(fmSegments.some((s) => s.text.includes("my-page"))).toBe(false);
  });

  it("strips inline code from body lines", () => {
    const source = `---
title: Test
---
Use the \`npm install\` command.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    const bodySegments = result.segments.filter((s) => s.source === "body");
    expect(bodySegments.length).toBe(1);
    expect(bodySegments[0].text).toContain("Use the");
    expect(bodySegments[0].text).toContain("command");
    expect(bodySegments[0].text).not.toContain("npm install");
  });

  it("strips HTML comments from body lines", () => {
    const source = `---
title: Test
---
Text <!-- comment --> here.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    const bodySegments = result.segments.filter((s) => s.source === "body");
    expect(bodySegments[0].text).not.toContain("comment");
    expect(bodySegments[0].text).toContain("Text");
    expect(bodySegments[0].text).toContain("here");
  });

  it("strips URLs from body lines", () => {
    const source = `---
title: Test
---
Visit https://example.com for more.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    const bodySegments = result.segments.filter((s) => s.source === "body");
    expect(bodySegments[0].text).not.toContain("https://example.com");
    expect(bodySegments[0].text).toContain("Visit");
    expect(bodySegments[0].text).toContain("for more");
  });

  it("detects YAML parse errors", () => {
    const source = `---
title: Test
foo: [unclosed
---
Body.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    expect(result.yamlError).not.toBeNull();
    expect(result.yamlError!.message).toBeTruthy();
  });

  it("marks table rows correctly", () => {
    const source = `---
title: Test
---
| Col1 | Col2 |
|------|------|
| a    | b    |
Normal text.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    const bodySegments = result.segments.filter((s) => s.source === "body");
    const tableRows = bodySegments.filter((s) => s.isTableRow);
    const normalLines = bodySegments.filter((s) => !s.isTableRow);
    expect(tableRows.length).toBe(3);
    expect(normalLines.length).toBe(1);
    expect(normalLines[0].text).toContain("Normal text");
  });

  it("handles files without frontmatter", () => {
    const source = "Just body text.\nSecond line.\n";
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    expect(result.yamlError).toBeNull();
    const bodySegments = result.segments.filter((s) => s.source === "body");
    expect(bodySegments.length).toBe(2);
  });

  it("skips identifier-like values in frontmatter", () => {
    const source = `---
title: Test
path: src/foo/bar.ts
description: Real text
---
Body.
`;
    const result = extractTextSurface("src/content/pages/de/test.md", source, {
      languages: LANGS,
      defaultLanguage: "de",
    });

    const fmSegments = result.segments.filter((s) => s.source === "frontmatter");
    expect(fmSegments.some((s) => s.text.includes("Real text"))).toBe(true);
    expect(fmSegments.some((s) => s.text.includes("src/foo/bar.ts"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RFC-1442: companion subtrees under the companion locale (AC-4, AC-5)
// ---------------------------------------------------------------------------

describe("extractTextSurface — companion language (RFC-1442)", () => {
  const COMPANION_PAGE = `---
title: Главная
blocks:
  - id: hero
    type: hero
    companion:
      props:
        subheading: "Hochwertige Produkte für Gesundheit"
    props:
      heading: "Качественные товары"
---
Body text.
`;

  it("companion subtrees are extracted under the companion locale when declared and skipped when undeclared", () => {
    const file = "src/content/pages/ru/home.md";
    const options = { languages: ["ru", "uz"], defaultLanguage: "ru" };

    // Declared companion language → companion.props strings scan under "de".
    const declared = extractTextSurface(file, COMPANION_PAGE, {
      ...options,
      companionLanguage: "de",
    });
    const companionSeg = declared.segments.find((s) =>
      s.path.endsWith("companion.props.subheading"),
    );
    expect(companionSeg).toBeDefined();
    expect(companionSeg!.locale).toBe("de");
    expect(companionSeg!.text).toContain("Hochwertige Produkte");

    // The routed props in the same file keep the file locale.
    const routedSeg = declared.segments.find((s) => s.path.endsWith("props.heading"));
    expect(routedSeg).toBeDefined();
    expect(routedSeg!.locale).toBe("ru");

    // No companion declaration → the subtree stays technical (RFC-1436).
    const undeclared = extractTextSurface(file, COMPANION_PAGE, options);
    expect(
      undeclared.segments.some((s) => s.path.includes("companion.props")),
    ).toBe(false);
  });

  it("companion marker and technical keys inside companion subtrees never produce segments", () => {
    const source = `---
title: Test
companion: true
blocks:
  - id: hero
    type: hero
    companion: true
  - id: second
    type: hero
    companion:
      props:
        subheading: "Deutscher Text"
        href: "https://example.com/x"
---
`;
    const result = extractTextSurface("src/content/site/ru/labels.md", source, {
      languages: ["ru"],
      defaultLanguage: "ru",
      companionLanguage: "de",
    });
    const paths = result.segments.map((s) => s.path);
    // `companion: true` (top-level and block-level) is a marker, not text.
    expect(paths).not.toContain("$.companion");
    expect(paths).not.toContain("$.blocks[0].companion");
    // Technical keys inside the companion subtree stay technical.
    expect(paths).not.toContain("$.blocks[1].companion.props.href");
    // The real companion string is present under the companion locale.
    const seg = result.segments.find((s) => s.path === "$.blocks[1].companion.props.subheading");
    expect(seg).toBeDefined();
    expect(seg!.locale).toBe("de");
    // Boolean/marker values never leak into segment text.
    expect(result.segments.every((s) => s.text !== "true")).toBe(true);
  });

  it("files under the companion directory resolve to the companion locale without a lang marker", () => {
    const source = `---
title: Hinweis
---
Deutscher Fließtext.
`;
    const result = extractTextSurface("src/content/prose/de/note.md", source, {
      languages: ["ru", "uz"],
      defaultLanguage: "ru",
      companionLanguage: "de",
    });
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.segments.every((s) => s.locale === "de")).toBe(true);
  });
});

describe("extractTextSurface — attribution switches", () => {
  it("does not treat labels attribution enum values as text", () => {
    const source = `---
brandLabel: "DP7 Handels"
attribution:
  credits: byIntent
  proseAuthorship: shown
---
`;
    const result = extractTextSurface("src/content/site/de/labels.md", source, {
      languages: ["de"],
      defaultLanguage: "de",
    });
    const texts = result.segments.map((s) => s.text);
    expect(texts).toContain("DP7 Handels");
    expect(texts).not.toContain("byIntent");
    expect(texts).not.toContain("shown");
  });
});
