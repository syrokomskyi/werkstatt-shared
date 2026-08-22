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
