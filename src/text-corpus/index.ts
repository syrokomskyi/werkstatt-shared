/*
<MODULE_CONTRACT>
<purpose>
Implements text corpus index as part of the package's documented module surface.
</purpose>
<non-goals>
  <item>Not a contract source of truth — callers depend on the module's exported API, not this file's internals.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — repairs pre-existing contract debt surfaced by the test-file scaffold rollout.</item>
  <item>RFC-1372: unify terminology, voice, and translator guidance into a per-site translation contract (RFC-1372)</item>
</CHANGE_SUMMARY>
*/

export * from "./schema.ts";
export * from "./term-registry.ts";
export * from "./translation-contract.ts";
export * from "./grammar.ts";
