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
  <item>Add type declaration for qrcode/lib/browser.js deep import used by external-link-qr.ts.</item>
</CHANGE_SUMMARY>
*/

declare module "qrcode/lib/browser.js" {
  export * from "qrcode";
}
