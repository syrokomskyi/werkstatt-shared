/*
<MODULE_CONTRACT>
<purpose>Type shim for Vite `?inline` stylesheet imports — the specifier returns the compiled CSS as a string instead of emitting a standalone asset.</purpose>
<non-goals>
  <item>Do not change runtime resolution; this file only fills the missing module declaration.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>warpgogol-m000170: added — plyr.css loads via ?inline because inlineStylesheets:'always' drops the standalone .css asset the dynamic-import preload referenced (404 → branded player never mounted).</item>
</CHANGE_SUMMARY>
*/

declare module "*.css?inline" {
  const css: string;
  export default css;
}
