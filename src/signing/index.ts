/*
<MODULE_CONTRACT>
  <purpose>Barrel export for @warpgogol/werkstatt-shared/signing sub-path. Re-exports the Ed25519 signing core (key generation, sign/verify, signing types) sunk from @warpgogol/werkstatt-engine per RFC-1104.</purpose>
  <non-goals>Does not re-export engine signing commands (signing-commands.ts stays in engine).</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1104: initial barrel — signing core sunk from werkstatt-engine.</item>
</CHANGE_SUMMARY>
*/

export * from "./types.ts";
export * from "./key.ts";
export * from "./sign.ts";
