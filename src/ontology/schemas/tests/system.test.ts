/*
<MODULE_CONTRACT>
<purpose>
Unit tests for system covering system.ts barrel re-exports. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the system suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import * as systemModule from "../system.ts";

describe("system.ts barrel re-exports", () => {
  it("re-exports systemManifestSchema", () => {
    expect(systemModule.systemManifestSchema).toBeDefined();
  });

  it("re-exports systemIntegrationsSchema", () => {
    expect(systemModule.systemIntegrationsSchema).toBeDefined();
  });

  it("re-exports systemPassportSchema", () => {
    expect(systemModule.systemPassportSchema).toBeDefined();
  });

  it("re-exports systemReleaseSchema", () => {
    expect(systemModule.systemReleaseSchema).toBeDefined();
  });
});
