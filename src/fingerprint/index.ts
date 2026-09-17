/*
<MODULE_CONTRACT>
  <purpose>Barrel export for @warpgogol/werkstatt-shared/fingerprint sub-path. Re-exports canonical JSON and hashing primitives sunk from @warpgogol/werkstatt-engine per RFC-1104.</purpose>
  <non-goals>Does not re-export engine fingerprint modules that stay in engine (fingerprint.ts, path-matcher.ts, normalizers).</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1104: initial barrel — canonical-json + primitives sunk from werkstatt-engine.</item>
</CHANGE_SUMMARY>
*/

export * from "./canonical-json.ts";
export * from "./primitives.ts";
