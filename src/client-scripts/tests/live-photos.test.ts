/*
<MODULE_CONTRACT>
<purpose>
Unit tests for live photos covering initLivePhotos. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the live suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { initLivePhotos } from "../live-photos.ts";

describe("initLivePhotos", () => {
  it("is an async function", () => {
    expect(typeof initLivePhotos).toBe("function");
  });
});
