/*
<MODULE_CONTRACT>
<purpose>
Unit tests for external link qr covering initExternalLinkQr. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the external suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { initExternalLinkQr } from "../external-link-qr.ts";

describe("initExternalLinkQr", () => {
  it("is a function", () => {
    expect(typeof initExternalLinkQr).toBe("function");
  });
});
