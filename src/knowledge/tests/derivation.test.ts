/*
<MODULE_CONTRACT>
<purpose>
Unit tests for derivation covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0215: initial derivation tests.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { normalizeForHash, hashSourceValue, derivedState } from "../derivation.ts";

test("normalize: whitespace and markdown are insensitive", () => {
  expect(normalizeForHash("Hello   world")).toBe("Hello world");
  expect(normalizeForHash("**Hello** _world_")).toBe("Hello world");
  expect(hashSourceValue("Hello world")).toBe(hashSourceValue("**Hello**   world"));
});

test("hash: wording change is sensitive", () => {
  expect(hashSourceValue("Price is 70 EUR")).not.toBe(hashSourceValue("Price is 80 EUR"));
});

test("derivedState: current when hash matches", () => {
  const h = hashSourceValue("Digitales Fundament");
  expect(derivedState(h, "Digitales Fundament").state).toBe("current");
});

test("derivedState: outdated when source changed", () => {
  const h = hashSourceValue("old source");
  expect(derivedState(h, "new source").state).toBe("outdated");
});

test("derivedState: outdated when never stamped", () => {
  expect(derivedState(undefined, "any").state).toBe("outdated");
});

test("derivedState: source-missing when source value absent", () => {
  expect(derivedState("sha256:x", undefined).state).toBe("source-missing");
});
