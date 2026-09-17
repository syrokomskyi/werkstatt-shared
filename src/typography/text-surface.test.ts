/*
<MODULE_CONTRACT>
<purpose>Unit tests for the text-surface extractor (RFC-1068).</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1068: initial creation.</item>
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
