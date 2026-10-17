/*
<MODULE_CONTRACT>
  <purpose>
Unit tests for redirects covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0595: initial extractRedirectTarget tests.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { extractRedirectTarget, parseRedirectRules } from "../redirects.ts";

test("extractRedirectTarget: extracts url from standard meta-refresh tag", () => {
  const html = `<html><head><meta http-equiv="refresh" content="0;url=/de/agb"></head><body></body></html>`;
  expect(extractRedirectTarget(html)).toBe("/de/agb");
});

test("extractRedirectTarget: extracts url with single quotes", () => {
  const html = `<html><head><meta http-equiv='refresh' content='0;url=/en/page'></head></html>`;
  expect(extractRedirectTarget(html)).toBe("/en/page");
});

test("extractRedirectTarget: extracts absolute URL", () => {
  const html = `<meta http-equiv="refresh" content="0;url=https://example.com/target">`;
  expect(extractRedirectTarget(html)).toBe("https://example.com/target");
});

test("extractRedirectTarget: handles delay before url", () => {
  const html = `<meta http-equiv="refresh" content="5;url=/delayed">`;
  expect(extractRedirectTarget(html)).toBe("/delayed");
});

test("extractRedirectTarget: returns null when no meta-refresh tag", () => {
  const html = `<html><head><title>Normal page</title></head><body>content</body></html>`;
  expect(extractRedirectTarget(html)).toBeNull();
});

test("extractRedirectTarget: returns null for malformed content attribute", () => {
  const html = `<meta http-equiv="refresh" content="just text no url">`;
  expect(extractRedirectTarget(html)).toBeNull();
});

test("extractRedirectTarget: returns null for empty html", () => {
  expect(extractRedirectTarget("")).toBeNull();
});

test("parseRedirectRules: still works correctly alongside extractRedirectTarget", () => {
  const rules = parseRedirectRules("/old /new 301\n/de/* / 308");
  expect(rules).toHaveLength(2);
  expect(rules[0].from).toBe("/old");
  expect(rules[1].from).toBe("/de/*");
});

test("extractRedirectTarget: returns first hop only (multi-hop scenario)", () => {
  const html = `<meta http-equiv="refresh" content="0;url=/intermediate">`;
  expect(extractRedirectTarget(html)).toBe("/intermediate");
});

test("extractRedirectTarget: handles reversed attribute order (content before http-equiv)", () => {
  const html = `<meta content="0;url=/target" http-equiv="refresh">`;
  expect(extractRedirectTarget(html)).toBe("/target");
});
