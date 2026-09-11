/*
<MODULE_CONTRACT>
<purpose>
  Canonical remediation catalog mapping ruleId to structured remediation patterns.
  Consumed by diagnosticsResult() for auto-population and by remediation.hint.validate
  for coverage checking (RFC-1027).
</purpose>
<non-goals>
  <item>Does not own the Diagnostic schema — that lives in werkstatt-engine schemas.</item>
  <item>Does not aggregate remediation hints into KernelExecutionReport — that is the engine's job.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1027: Create REMEDIATION_CATALOG with 30+ patterns for the most common ruleIds.</item>
</CHANGE_SUMMARY>
*/

export interface RemediationPattern {
  ruleId: string;
  action: string;
  template?: string;
  docRef?: string;
  targetFiles?: string[];
}

const REMEDIATION_ENTRIES: RemediationPattern[] = [
  {
    ruleId: "SEO-RUNTIME.CANONICAL-MISMATCH",
    action:
      "Ensure the canonical URL in the rendered HTML matches the production domain without language prefix for the default locale.",
    docRef: "docs/authoring/site-composition.md",
    targetFiles: ["src/layouts/**/*.astro"],
  },
  {
    ruleId: "WORKSPACE.SURFACE.VALIDATE",
    action:
      "Fix surface validation errors by checking the surface block declarations against the schema.",
    docRef: "docs/authoring/site-composition.md",
  },
  {
    ruleId: "TEST.SIGNAL.POLICY.VALIDATE",
    action:
      "Align test signal declarations with the policy schema — check signal name, severity, and evidence path.",
    docRef: "docs/agents/domain.md",
  },
  {
    ruleId: "PUBLIC.ICONS.VALIDATE",
    action:
      "Replace invalid icon references with valid SurfaceLabels entries or remove the icon field.",
    docRef: "docs/authoring/site-composition.md",
  },
  {
    ruleId: "PARITY-SECTION-COUNT",
    action: "Add or remove sections so the locale overlay matches the base locale section count.",
    docRef: "docs/authoring/preventive-measures-parity-and-templates.md",
  },
  {
    ruleId: "GEN-FILES-01",
    action:
      "Regenerate generated files by running the owning kernel command, then commit the updated output.",
    docRef: "docs/authoring/generated-files-and-templates.md",
  },
  {
    ruleId: "DEPS-GEN-01",
    action:
      "Run pnpm exec werkstatt run deps.peer.check to regenerate the peer dependency manifest.",
    docRef: "docs/authoring/generated-files-and-templates.md",
  },
  {
    ruleId: "AGC-01",
    action:
      "Fix the agent gate configuration — ensure the gate metadata matches the declared gate catalog.",
    docRef: "docs/agents/domain.md",
  },
  {
    ruleId: "WORKPIECE-IMPORTS-01",
    action:
      "Resolve the broken import in the workpiece — check the module path and ensure the package is installed.",
  },
  {
    ruleId: "SNAP-01",
    action:
      "Regenerate the behavior snapshot by running pnpm exec werkstatt run behavior.snapshot.generate.",
  },
  {
    ruleId: "CREG-04",
    action:
      "Fix the content regression — review the content diff and update the review.yaml before closing the mission.",
    docRef: "docs/authoring/site-composition.md",
  },
  {
    ruleId: "CREG-03",
    action:
      "Fix the content regression — ensure all locale overlays are consistent with the base content.",
    docRef: "docs/authoring/preventive-measures-parity-and-templates.md",
  },
  {
    ruleId: "CREG-01",
    action:
      "Fix the content regression — the base content was changed without a review.yaml. Run content.regression.review.generate.",
    docRef: "docs/authoring/site-composition.md",
  },
  {
    ruleId: "BRK-04",
    action:
      "Fix the bordbuch entry — ensure the hash chain is intact and the entry is properly signed.",
  },
  {
    ruleId: "PROPS-01",
    action:
      "Fix the content props schema violation — check the frontmatter against the schema declaration.",
  },
  {
    ruleId: "MAINTENANCE.DEBT.BASELINE.VALIDATE",
    action:
      "Regenerate the maintenance debt baseline by running pnpm exec werkstatt run maintenance.debt.baseline.generate.",
  },
  {
    ruleId: "HDR-04",
    action: "Fix the header configuration — ensure the header block matches the surface schema.",
    docRef: "docs/authoring/site-composition.md",
  },
  {
    ruleId: "HDR-02",
    action: "Fix the header navigation — ensure all nav items have valid href and label.",
    docRef: "docs/authoring/site-composition.md",
  },
  {
    ruleId: "HDR-01",
    action:
      "Fix the header structure — ensure the header block is declared in the surface composition.",
    docRef: "docs/authoring/site-composition.md",
  },
  {
    ruleId: "GEN-EDIT-01",
    action: "Do not hand-edit generated files. Modify the source template and regenerate.",
    docRef: "docs/authoring/generated-files-and-templates.md",
  },
  {
    ruleId: "DEPS-PEER-01",
    action:
      "Add the missing peer dependency to the package.json or remove the import that requires it.",
  },
  {
    ruleId: "CW-EVID-01",
    action:
      "Fix the changelog evidence — ensure the evidence file exists and is referenced correctly.",
  },
  {
    ruleId: "CMD-MAN-03",
    action:
      "Regenerate the command manifest by running pnpm exec werkstatt run command.manifest.generate.",
  },
  {
    ruleId: "CI-LOCAL-05",
    action:
      "Fix the CI configuration — ensure the local CI workflow matches the pipeline definitions.",
  },
  {
    ruleId: "AGS-05",
    action:
      "Fix the agent gate search configuration — ensure the search manifest is generated and accessible.",
    docRef: "docs/agents/domain.md",
  },
  {
    ruleId: "AGS-02",
    action:
      "Fix the agent gate search schema — ensure the search chunk text is within the max length.",
    docRef: "docs/agents/domain.md",
  },
  {
    ruleId: "AGO-01",
    action: "Fix the agent gate output — ensure the gate output matches the declared schema.",
    docRef: "docs/agents/domain.md",
  },
  {
    ruleId: "AGK-03",
    action:
      "Fix the agent gate key — ensure the gate key is unique and matches the declared catalog.",
    docRef: "docs/agents/domain.md",
  },
  {
    ruleId: "WS-WRITE-02",
    action:
      "Fix the workspace write — ensure the write intent is declared and the path is within the workspace root.",
  },
  {
    ruleId: "SUPPRESS-VAL-04",
    action:
      "Fix the suppression validation — ensure the suppression rule matches the declared schema.",
    docRef: "docs/authoring/guide-suppression-matching.md",
  },
  {
    ruleId: "ENV-CONTRACT-02",
    action:
      "Fix the environment contract — ensure the env variable is declared in .env.example and matches the contract.",
  },
  {
    ruleId: "ENV-CONTRACT-04",
    action:
      "Fix the environment contract — ensure the env variable type matches the declared schema.",
  },
  {
    ruleId: "ENV-CONTRACT-05",
    action:
      "Fix the environment contract — ensure the env variable is documented in the .env.example file.",
  },
  {
    ruleId: "DEPLOY-SCRIPTS-03",
    action:
      "Fix the deploy script — ensure the script is executable and matches the deployment pipeline.",
  },
  {
    ruleId: "FLEET-05",
    action: "Fix the fleet configuration — ensure the fleet entry matches the declared schema.",
  },
  {
    ruleId: "TYPO-NUM-01",
    action:
      "Replace English number format (1,234.56) with German format (1.234,56) in German text.",
    docRef:
      "docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-NUM-02",
    action:
      "Replace dot-thousands format (1.234,56) with Ukrainian format using NNBSP (1\u202F234,56) in Ukrainian text.",
    docRef:
      "docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-NUM-03",
    action: "Replace regular space thousands separator with NNBSP (U+202F) in Ukrainian numbers.",
    docRef:
      "docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-ABBR-01",
    action: "Add the required trailing period to the abbreviation (e.g. Nr → Nr., usw → usw.).",
    docRef:
      "docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-ABBR-02",
    action:
      "Add the required internal space in German multi-part abbreviations (e.g. z.B. → z. B., u.a. → u. a.).",
    docRef:
      "docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-APOS-01",
    action: "Replace curly apostrophe (U+2019) with straight apostrophe (') in Ukrainian text.",
    docRef:
      "docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-APOS-02",
    action:
      "Replace modifier letter apostrophe (U+02BC) with straight apostrophe (') in Ukrainian text.",
    docRef:
      "docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-UNICODE-01",
    action: "Remove zero-width characters (U+200B, U+200C, U+200D, U+FEFF) from the source text.",
    docRef:
      "docs/rfcs/rfc-1071-extend-typography-validate-with-tier-3-advisory-rules-for-unicode-hygiene-link-text-and-sentence-length.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-UNICODE-02",
    action:
      "Remove soft hyphen (U+00AD) from the source text — it is invisible in most editors but affects rendering.",
    docRef:
      "docs/rfcs/rfc-1071-extend-typography-validate-with-tier-3-advisory-rules-for-unicode-hygiene-link-text-and-sentence-length.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-LINK-01",
    action:
      "Replace bare URL link text with descriptive link text (e.g. [Learn more](url) instead of [https://example.com](url)).",
    docRef:
      "docs/rfcs/rfc-1071-extend-typography-validate-with-tier-3-advisory-rules-for-unicode-hygiene-link-text-and-sentence-length.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-LINK-02",
    action:
      "Replace generic link text (click here, hier klicken, тут, here, hier) with a descriptive phrase that indicates the link target.",
    docRef:
      "docs/rfcs/rfc-1071-extend-typography-validate-with-tier-3-advisory-rules-for-unicode-hygiene-link-text-and-sentence-length.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-SENT-01",
    action: "Split the long sentence (more than 40 words) into shorter sentences for readability.",
    docRef:
      "docs/rfcs/rfc-1071-extend-typography-validate-with-tier-3-advisory-rules-for-unicode-hygiene-link-text-and-sentence-length.md",
    targetFiles: ["src/content/**/*.md"],
  },
];

export const REMEDIATION_CATALOG: ReadonlyMap<string, RemediationPattern> = new Map(
  REMEDIATION_ENTRIES.map((entry) => [entry.ruleId, entry]),
);

export function lookupRemediation(ruleId: string): RemediationPattern | undefined {
  return REMEDIATION_CATALOG.get(ruleId);
}
