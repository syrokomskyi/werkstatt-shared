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
  <item>ADR-0105: remediation entries for the DIST-LEAK-01..05 rule family (serialization-leak guard).</item>
  <item>RFC-1201: remediation entry for PARITY-MD-CONSTRUCT-COUNT (inline-construct parity).</item>
  <item>RFC-1209: remediation entries for the RB-01..06 resource-budget rule family.</item>
  <item>RFC-1209: site resource budgets and public transparency surface (RFC-1209)</item>
  <item>RFC-1210: closed-loop signal ingest to bounded missions (RFC-1210)</item>
  <history>RFC-1027, RFC-1185</history>
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
    ruleId: "PARITY-MD-CONSTRUCT-COUNT",
    action:
      "Align inline markdown constructs (code spans, links, images, footnote references) between the localized block and its counterpart locale, or record an intentional difference via translation.parity.suppress.",
    docRef: "docs/authoring/preventive-measures-parity-and-templates.md",
  },
  {
    ruleId: "GEN-FILES-01",
    action:
      "Regenerate generated files by running the owning kernel command, then commit the updated output.",
    docRef: "docs/authoring/generated-files-and-templates.md",
  },
  {
    ruleId: "RAUT-01",
    action:
      "Fix the remediation block in system-state.yaml to match the autonomy schema (autonomy: off|bounded, signalSources: string[]).",
    docRef:
      "docs/rfcs/rfc-1210-closed-loop-runtime-remediation-channel-from-telemetry-signals-to-bounded-missions.md",
  },
  {
    ruleId: "RAUT-02",
    action:
      "Repair the remediationClasses catalog — every autoFixable entry must name a registered fixCommand; the catalog is closed, fix the entry or drop autoFixable.",
    docRef:
      "docs/rfcs/rfc-1210-closed-loop-runtime-remediation-channel-from-telemetry-signals-to-bounded-missions.md",
  },
  {
    ruleId: "RAUT-03",
    action:
      "Declare at least one signalSources invoker in system-state.yaml for bounded autonomy, or set remediation.autonomy: off.",
    docRef:
      "docs/rfcs/rfc-1210-closed-loop-runtime-remediation-channel-from-telemetry-signals-to-bounded-missions.md",
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
  {
    ruleId: "SHARED-CONTEXT-COLLISION-UNDECLARED",
    action:
      "Declare `inherit: <pageId>` on the consuming block to subscribe to the source block's authored props, or `inherit: false` to opt out of the collision group. Run `shared.context.migrate` inside a mission to materialize edges automatically.",
    docRef: "docs/authoring/site-composition.md",
    targetFiles: ["src/content/pages/**/*.md"],
  },
  {
    ruleId: "SHARED-CONTEXT-INHERIT-TARGET-MISSING",
    action:
      "Point `inherit` at a pageId declared in system.md pages[] whose same-language entry has a block with the same id+type — or remove the edge.",
    docRef: "docs/authoring/site-composition.md",
    targetFiles: ["src/content/pages/**/*.md"],
  },
  {
    ruleId: "SHARED-CONTEXT-INHERIT-SELF",
    action:
      "Remove the `inherit` edge — a block cannot inherit from its own page; authored props already apply.",
    docRef: "docs/authoring/site-composition.md",
    targetFiles: ["src/content/pages/**/*.md"],
  },
  {
    ruleId: "SHARED-CONTEXT-INHERIT-LANG-MISSING",
    action:
      "Create the named page's content entry for this language, or remove the inherit edge from this language's file — otherwise default-language props would silently leak into the translated page.",
    docRef: "docs/authoring/site-composition.md",
    targetFiles: ["src/content/pages/**/*.md"],
  },
  {
    ruleId: "SHARED-CONTEXT-REQUIRED-PAGE-MISSING",
    action:
      "Add the pageId to system.md pages[] and create its content entry, or remove it from sharedContext.requiredPageIds.",
    docRef: "docs/authoring/site-composition.md",
    targetFiles: ["src/content/system.md", "src/content/pages/**/*.md"],
  },
  {
    ruleId: "DIST-LEAK-01",
    action:
      "A non-serializable runtime value reached a string position in rendered output — check deep-walk helpers for plain-object guards (non-plain objects like Date must pass through).",
    docRef:
      "docs/adrs/adr-0105-deep-walks-preserve-non-plain-objects-and-dist-is-scanned-for-serialization-leaks.md",
  },
  {
    ruleId: "DIST-LEAK-02",
    action:
      "An unparseable or corrupted date reached the page — normalize date-bearing values via toIsoDateString (Date → toISOString) before they reach components.",
    docRef:
      "docs/adrs/adr-0105-deep-walks-preserve-non-plain-objects-and-dist-is-scanned-for-serialization-leaks.md",
  },
  {
    ruleId: "DIST-LEAK-03",
    action:
      "An attribute received undefined/null/NaN — guard the prop source and omit the attribute instead of serializing the sentinel.",
    docRef:
      "docs/adrs/adr-0105-deep-walks-preserve-non-plain-objects-and-dist-is-scanned-for-serialization-leaks.md",
  },
  {
    ruleId: "DIST-LEAK-04",
    action:
      "A text node rendered a bare undefined/null/NaN — coerce or suppress the value before render.",
    docRef:
      "docs/adrs/adr-0105-deep-walks-preserve-non-plain-objects-and-dist-is-scanned-for-serialization-leaks.md",
  },
  {
    ruleId: "DIST-LEAK-05",
    action:
      "A dist file could not be read and was skipped by the scan — fix permissions/encoding; a skipped file escapes a fail-closed guard.",
  },
  {
    ruleId: "RB-01",
    action:
      "Route exceeds the pageWeightKb budget — shrink media/markup on the route or declare a routeOverrides entry for it in src/content/system.md.",
    docRef: "docs/rfcs/rfc-1209-site-resource-budgets-and-public-energy-transparency-surface.md",
    targetFiles: ["src/content/system.md"],
  },
  {
    ruleId: "RB-02",
    action:
      "Route exceeds the maxJsKb budget — remove or slim scripts (including inline <script> blocks), or raise the budget for this route via routeOverrides in src/content/system.md.",
    docRef: "docs/rfcs/rfc-1209-site-resource-budgets-and-public-energy-transparency-surface.md",
    targetFiles: ["src/content/system.md"],
  },
  {
    ruleId: "RB-03",
    action:
      "Route exceeds the maxRequests budget — reduce the number of asset references or declare a routeOverrides entry in src/content/system.md.",
    docRef: "docs/rfcs/rfc-1209-site-resource-budgets-and-public-energy-transparency-surface.md",
    targetFiles: ["src/content/system.md"],
  },
  {
    ruleId: "RB-04",
    action:
      "Route references more third-party origins than maxThirdPartyOrigins allows — self-host the asset or raise the bound via routeOverrides in src/content/system.md.",
    docRef: "docs/rfcs/rfc-1209-site-resource-budgets-and-public-energy-transparency-surface.md",
    targetFiles: ["src/content/system.md"],
  },
  {
    ruleId: "RB-05",
    action:
      "The resourceBudget block in src/content/system.md is malformed — fix the frontmatter to match ResourceBudgetConfig (numeric KB ceilings, enforce: advisory|blocking).",
    docRef: "docs/rfcs/rfc-1209-site-resource-budgets-and-public-energy-transparency-surface.md",
    targetFiles: ["src/content/system.md"],
  },
  {
    ruleId: "RB-06",
    action:
      "The dist output tree is absent — run the site build before validating resource budgets.",
  },
  {
    ruleId: "AGUI-01",
    action:
      "A ui-capable capability has no committed valid artifact — rerun agent.ui.generate to emit the ui:// resource (artifacts are generated, never hand-edited).",
    docRef: "docs/rfcs/rfc-1211-generative-ui-surface-via-mcp-ui-resource-projection.md",
  },
  {
    ruleId: "AGUI-02",
    action:
      "A UI artifact references non-allowlisted externals — inline the resource or remove the reference; ui:// documents must be self-contained.",
    docRef: "docs/rfcs/rfc-1211-generative-ui-surface-via-mcp-ui-resource-projection.md",
  },
  {
    ruleId: "AGUI-03",
    action:
      "A UI artifact contains <script> markup — remove it; v1 resources are read-only and interactivity requires a superseding RFC.",
    docRef: "docs/rfcs/rfc-1211-generative-ui-surface-via-mcp-ui-resource-projection.md",
  },
  {
    ruleId: "AGUI-04",
    action:
      "interfaces.mcpUi is advertised while its precondition fails — rerun agent.manifest.generate (mcpUi requires the live MCP route and >=1 resolvable ui:// artifact).",
    docRef: "docs/rfcs/rfc-1211-generative-ui-surface-via-mcp-ui-resource-projection.md",
  },
  {
    ruleId: "AGUI-05",
    action:
      "A committed UI artifact differs from a fresh deterministic render — rerun agent.ui.generate and commit the regenerated artifact.",
    docRef: "docs/rfcs/rfc-1211-generative-ui-surface-via-mcp-ui-resource-projection.md",
  },
  {
    ruleId: "AGUI-06",
    action:
      "A UI artifact exists for a suppressed or disabled capability — rerun agent.ui.generate; it sweeps artifacts outside the active emission set.",
    docRef: "docs/rfcs/rfc-1211-generative-ui-surface-via-mcp-ui-resource-projection.md",
  },
  {
    ruleId: "AGM-01",
    action:
      "A capability's metering block fails the closed schema — fix the metering fields (unknown keys are rejected); see the metering block contract in the capability schema.",
    docRef:
      "docs/rfcs/rfc-1212-metered-agent-invocation-and-machine-readable-capability-pricing.md",
  },
  {
    ruleId: "AGM-02",
    action:
      "metering.product does not resolve to a usage-type Charge in the site's PBP pricing catalog, or the declared pricePerUnit diverges from the catalog unit-rate — align the declaration with the catalog entry.",
    docRef:
      "docs/rfcs/rfc-1212-metered-agent-invocation-and-machine-readable-capability-pricing.md",
  },
  {
    ruleId: "AGM-03",
    action:
      "A metered capability lacks requires.entitlements — metered calls must carry a verified caller identity; add the entitlement requirement or drop metering.",
    docRef:
      "docs/rfcs/rfc-1212-metered-agent-invocation-and-machine-readable-capability-pricing.md",
  },
  {
    ruleId: "AGM-04",
    action:
      "The manifest pricing projection diverges from the metering declaration — rerun agent.manifest.generate; the projection is derived, never hand-edited.",
    docRef:
      "docs/rfcs/rfc-1212-metered-agent-invocation-and-machine-readable-capability-pricing.md",
  },
  {
    ruleId: "AGM-05",
    action:
      "A usage record was emitted outside the post-dispatch boundary (preview, rejection, replay, or failed dispatch) — fix the emission call site; metering must never precede a successful dispatch.",
    docRef:
      "docs/rfcs/rfc-1212-metered-agent-invocation-and-machine-readable-capability-pricing.md",
  },
  {
    ruleId: "AGP-01",
    action:
      "A verifiablePresentation block fails the closed schema — fix the requirement fields (unknown keys are rejected); see the presentation-verdict contract.",
    docRef:
      "docs/rfcs/rfc-1213-verifier-side-verifiable-credential-readiness-for-gated-capabilities.md",
  },
  {
    ruleId: "AGP-02",
    action:
      "A verifiablePresentation requirement is declared while agent.auth is disabled — verified-agent binding needs the authorization server; enable agent.auth or remove the requirement.",
    docRef:
      "docs/rfcs/rfc-1213-verifier-side-verifiable-credential-readiness-for-gated-capabilities.md",
  },
  {
    ruleId: "AGP-03",
    action:
      'An accept[] issuer reference is neither a "@name" registry ref nor a did:/https: identifier — fix the reference shape.',
    docRef:
      "docs/rfcs/rfc-1213-verifier-side-verifiable-credential-readiness-for-gated-capabilities.md",
  },
  {
    ruleId: "AGP-04",
    action:
      "A verifiablePresentation requirement sits on an anonymous-only capability — declare requires.entitlements so a verified agent identity exists to bind to, or remove the requirement.",
    docRef:
      "docs/rfcs/rfc-1213-verifier-side-verifiable-credential-readiness-for-gated-capabilities.md",
  },
  {
    ruleId: "AGP-05",
    action:
      'An "@name" issuer reference does not resolve against src/content/agent/trusted-issuers.yaml — add the named set or fix the reference.',
    docRef:
      "docs/rfcs/rfc-1213-verifier-side-verifiable-credential-readiness-for-gated-capabilities.md",
  },
];

export const REMEDIATION_CATALOG: ReadonlyMap<string, RemediationPattern> = new Map(
  REMEDIATION_ENTRIES.map((entry) => [entry.ruleId, entry]),
);

export function lookupRemediation(ruleId: string): RemediationPattern | undefined {
  return REMEDIATION_CATALOG.get(ruleId);
}
