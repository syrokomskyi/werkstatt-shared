/*
<MODULE_CONTRACT>
<purpose>Maintains packages/observability/src/redact.ts as an authored observability authored module so agents can evolve it without rediscovering local boundaries.</purpose>
<non-goals>
  <item>Do not import node: modules — must be Workers-compatible.</item>
  <item>Do not redact at the collector level — this is a convenience for emitters.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0337: initial implementation.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    const redacted = parsed.toString();
    if (parsed.pathname === "/") return redacted.replace(/\/$/, "");
    return redacted;
  } catch {
    return url;
  }
}
