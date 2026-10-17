/*
<MODULE_CONTRACT>
<purpose>
Unit tests for resolve field path covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the resolve suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { resolveFieldPath } from "../resolve-field-path.ts";

test("resolveFieldPath resolves shallow field", () => {
  const result = resolveFieldPath({ companyName: "Warpgogol" }, ["companyName"]);
  expect(result.missingField).toBe(null);
  expect(result.value).toBe("Warpgogol");
});

test("resolveFieldPath resolves nested field", () => {
  const data = { owner: { address: { street: "Main St" } } };
  const result = resolveFieldPath(data, ["owner", "address", "street"]);
  expect(result.missingField).toBe(null);
  expect(result.value).toBe("Main St");
});

test("resolveFieldPath reports the next field after a missing intermediate", () => {
  const data = { owner: { fullName: "Alice" } };
  const result = resolveFieldPath(data, ["owner", "address", "street"]);
  expect(result.missingField).toBe("street");
});

test("resolveFieldPath does not report missing leaf field on last step (matches original behavior)", () => {
  const result = resolveFieldPath({}, ["companyName"]);
  expect(result.missingField).toBe(null);
  expect(result.value).toBe(undefined);
});

test("resolveFieldPath handles null intermediate value", () => {
  const data = { owner: null };
  const result = resolveFieldPath(data, ["owner", "address"]);
  expect(result.missingField).toBe("address");
});

test("resolveFieldPath handles undefined intermediate value", () => {
  const data = { owner: undefined };
  const result = resolveFieldPath(data, ["owner", "address"]);
  expect(result.missingField).toBe("address");
});

test("resolveFieldPath handles numeric array indices", () => {
  const data = { items: [{ name: "first" }, { name: "second" }] };
  const result = resolveFieldPath(data, ["items", "1", "name"]);
  expect(result.missingField).toBe(null);
  expect(result.value).toBe("second");
});

test("resolveFieldPath reports next field after out-of-bounds array index", () => {
  const data = { items: [{ name: "first" }] };
  const result = resolveFieldPath(data, ["items", "5", "name"]);
  expect(result.missingField).toBe("name");
});
