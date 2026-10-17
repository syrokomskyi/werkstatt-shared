/*
<MODULE_CONTRACT>
<purpose>
Unit tests for twin path covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Do not inspect generated app files.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0306: Added Markdown twin path helper coverage.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { markdownTwinRelPath, markdownTwinUrlPath } from "../ids.ts";

const supportedLangs = ["de", "en"] as const;

test("markdownTwinRelPath keeps root and language roots at index.md", () => {
  expect(markdownTwinRelPath("/", { supportedLangs })).toBe("index.md");
  expect(markdownTwinRelPath("/en", { supportedLangs })).toBe("en/index.md");
  expect(markdownTwinRelPath("/en/", { supportedLangs })).toBe("en/index.md");
});

test("markdownTwinRelPath maps non-home pages to sibling md files", () => {
  expect(markdownTwinRelPath("/team/andrii-syrokomskyi", { supportedLangs })).toBe(
    "team/andrii-syrokomskyi.md",
  );
  expect(markdownTwinRelPath("/en/team/andrii", { supportedLangs })).toBe("en/team/andrii.md");
  expect(markdownTwinRelPath("/it", { supportedLangs })).toBe("it.md");
});

test("markdownTwinUrlPath returns the public URL form", () => {
  expect(markdownTwinUrlPath("/team/andrii-syrokomskyi", { supportedLangs })).toBe(
    "/team/andrii-syrokomskyi.md",
  );
});
