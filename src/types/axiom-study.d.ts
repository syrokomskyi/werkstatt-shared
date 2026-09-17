/*
<MODULE_CONTRACT>
<purpose>axiom-study.d.ts — ambient module declaration for the external @syrokomskyi/axiom-study package types.</purpose>
<non-goals>
  <item>Do not implement runtime code — this file only declares types for an external package.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: sweep — tail packages clean

Sweep batch 3: rewrote ~95 purposes across werkstatt-knowledge, werkstatt-shared, godot-game, phaser-game, lifecycle-core, projektarchiv-*, portal-*, billing-*, typescript (CONTRACT-02/PURPOSE-02). Real KEY_DECISIONS on 5 godot utils, non-goals on 5 CONTRACT-03 files, headers on 4 headerless files, CS-07 history literal fix on 2 files. Policy: vitest.config.ts + test-fixtures testPatterns, worker-configuration.d.ts excludedPath. All non-site/engine packages now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

declare module "@syrokomskyi/axiom-study" {
  export interface Finding {
    findingId: string;
    semanticFingerprint: { algorithm: "sha256"; digest: string; size: number; mediaType: string };
    methodologyId: string;
    ruleId: string;
    affectedSubjectId: string;
    title: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    evidence: Array<{
      evidenceRef: {
        artifactId: string;
        rootDigest: { algorithm: "sha256"; digest: string; size: number; mediaType: string };
        schema: string;
      };
      selector: string;
      evidenceClass: string;
    }>;
    uncertainty: unknown[];
    extension: Record<string, unknown>;
  }
}
