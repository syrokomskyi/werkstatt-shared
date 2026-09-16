/*
<MODULE_CONTRACT>
<purpose>Type shim for the qrcode browser entry point (qrcode/lib/browser.js).
The qrcode package only ships types for its main entry, but the browser entry
exports the same toCanvas function. This shim re-exports all types from qrcode
so the client-side QR code script gets full type safety.</purpose>
<non-goals>
  <item>Do not change runtime resolution; this file only fills the missing package declaration.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

declare module "qrcode/lib/browser.js" {
  export * from "qrcode";
}
