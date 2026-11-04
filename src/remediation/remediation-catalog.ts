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
  <item>RFC-1507: scoped gates always run ratchet scans; cold e2e as own gate</item>
  <item>RFC-1508: implement RFC-1508 — system profile, system map schemas and system.map.validate</item>
  <item>RFC-1509: implement RFC-1509 — system task queue, dispatch briefs and task reports</item>
  <item>RFC-1510: implement RFC-1510 — product outbox for dependency-contract requests</item>
  <item>RFC-1511: scenarios, version sets and system.versionset.record</item>
  <history>ADR-0105, RFC-1027, RFC-1185, RFC-1201, RFC-1209, RFC-1210, RFC-1365, RFC-1368, RFC-1369, RFC-1420, RFC-1460, RFC-1461, RFC-1463, RFC-1466, RFC-1486, RFC-1487, RFC-1488, RFC-1490, RFC-1491, RFC-1492, RFC-1493, RFC-1494, RFC-1496, RFC-1498, RFC-1502, RFC-1503, RFC-1506, warpgogol-m000196</history>
</CHANGE_SUMMARY>
*/

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as yamlParse } from "yaml";

export interface RemediationPattern {
  ruleId: string;
  /**
   * RFC-1461: the remediation contract — a one-line mechanical promise of what
   * the remediation does (e.g. "regenerate X", "align Y with the schema").
   * Required on new entries (REMEDIATION-01); legacy entries ratchet in via
   * REMEDIATION-03 warnings until declared.
   */
  contract?: string;
  action: string;
  template?: string;
  docRef?: string;
  targetFiles?: string[];
}

/**
 * RFC-1461: `diagnostic.explain` result contract — a read-only ruleId →
 * catalog-entry lookup. `coverage: "covered"` carries the catalog entry;
 * `coverage: "uncovered"` carries the nextSteps to add one.
 */
export interface DiagnosticExplainResult {
  command: "diagnostic.explain";
  rule: string;
  coverage: "covered" | "uncovered";
  entry?: RemediationPattern;
  nextSteps?: string[];
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
    ruleId: "COMP-HYG-05",
    action:
      "Replace the uniform scrim with a directional fade — declare kind: fade with edge on the background effects stack. Dark scrims (--ds-color-hero-overlay, --ds-color-overlay, --ds-color-overlay-strong, dark literals) belong on surfaceTone: dark; light surfaces use the veil (--ds-color-hero-veil) via kind: fade.",
    docRef:
      "docs/rfcs/rfc-1420-gate-hero-background-scrims-against-surface-tone-contrast.md",
    targetFiles: ["src/content/pages/**/*.md"],
  },
  {
    ruleId: "GEN-FILES-01",
    action:
      "Regenerate generated files by running the owning kernel command — or run `generated.files.validate --repair` to invoke every invocable owner in one sweep — then commit the updated output.",
    docRef: "docs/authoring/generated-files-and-templates.md",
  },
  {
    ruleId: "INTAKE-34",
    action:
      "Align the declared mediaType (or the filename) with the asset's actual bytes — the sniffed signature is authoritative; regenerate the asset only when the payload itself is wrong.",
    docRef:
      "docs/rfcs/rfc-1368-verify-declared-asset-media-types-against-magic-bytes-during-intake-validation.md",
    targetFiles: ["onboarding/<id>/.input/intake/intake.json"],
  },
  {
    ruleId: "RAUT-01",
    action: "Apply the remediation described for this ruleId in docs/rfcs/rfc-1210-closed-loop-runtime-remediation-channel-from-telemetry-signals-to-bounded-missions.md.",
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
      "Run pnpm exec werkstatt run deps.peer-check to regenerate the peer dependency manifest.",
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
      "Regenerate the maintenance debt baseline by running pnpm exec werkstatt run maintenance.debt.baseline.write.",
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
    contract: "The generated knowledge-file set has drifted from the populated/disabled domain set.",
    action: "Rerun agent.knowledge.generate, or remove the stale file.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-knowledge.ts",
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
    action: "Apply the remediation described for this ruleId in docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md.",
    docRef:
      "docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md",
    targetFiles: ["src/content/**/*.md"],
  },
  {
    ruleId: "TYPO-ABBR-02",
    action: "Apply the remediation described for this ruleId in docs/rfcs/rfc-1070-extend-typography-validate-with-tier-2-locale-rules-for-numbers-abbreviations-and-apostrophes.md.",
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
    action: "Apply the remediation described for this ruleId in docs/rfcs/rfc-1071-extend-typography-validate-with-tier-3-advisory-rules-for-unicode-hygiene-link-text-and-sentence-length.md.",
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
    action: "Apply the remediation described for this ruleId in docs/adrs/adr-0105-deep-walks-preserve-non-plain-objects-and-dist-is-scanned-for-serialization-leaks.md.",
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
    action: "Malformed resourceBudget block in src/content/system.md: …",
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
    action: "Run agent.ui.generate to emit the ui:// resource.",
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
    action: "interfaces.mcpUi is advertised while interfaces.mcp is absent — a partial agent surface must not claim MCP-UI.",
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
  {
    ruleId: "LAYOUT-RHYTHM-01",
    action:
      "Set `density: normal` (or `spacious`) on the block that directly follows the hero — a compact follower collapses the post-hero gap below the site-wide section rhythm.",
    docRef: "docs/authoring/block-declarative-pages.md",
    targetFiles: ["src/content/pages/**/*.md"],
  },
  {
    ruleId: "LAYOUT-RHYTHM-02",
    action:
      "`density: flush` directly after a hero merges the two sections visually — keep it only when the seam-free join is deliberate.",
    docRef: "docs/authoring/block-declarative-pages.md",
    targetFiles: ["src/content/pages/**/*.md"],
  },
  {
    ruleId: "RUNTIME-CONSOLE-01",
    action:
      "Fix the console error the route emits at cold load — when the message is a blocked third-party runtime fetch (net::ERR_BLOCKED_BY_CLIENT), serve the resource same-origin (vendor the asset / configure the library's asset URL) instead of relying on a third-party CDN.",
    docRef: "docs/authoring/block-declarative-pages.md",
    targetFiles: [
      "packages/werkstatt-site/src/domain/ui/**",
      "packages/werkstatt-shared/src/client-scripts/**",
    ],
  },
  {
    ruleId: "RUNTIME-CONSOLE-02",
    action:
      "Fix the uncaught page error (TypeError/ReferenceError at cold load) — trace the throwing chunk, guard the failing init, or remove the dead code path; an uncaught error can silently disable the feature that threw.",
    docRef: "docs/authoring/block-declarative-pages.md",
    targetFiles: [
      "packages/werkstatt-site/src/domain/ui/**",
      "packages/werkstatt-shared/src/client-scripts/**",
    ],
  },
  {
    ruleId: "CONF-01",
    action:
      "Fix the contractProducers[] entry in forge.yaml — id, emit.argv, consumer.root, and consumer.validator.argv are required; emit.argv and consumer.validator.argv must carry a {bundle} placeholder so legs can locate the forge-provided bundle dir.",
    docRef:
      "docs/rfcs/rfc-1365-require-golden-conformance-runs-against-authoritative-consumers-for-declared-contract-producers.md",
    targetFiles: ["forge.yaml"],
  },
  {
    ruleId: "CONF-02",
    action:
      "Wire the declared test to real conformance coverage — the test file must exist and reference @warpgogol/forge/conformance (helper import) or forge.conformance.run (shelled command); a bare producer-id mention is not wiring.",
    docRef:
      "docs/rfcs/rfc-1365-require-golden-conformance-runs-against-authoritative-consumers-for-declared-contract-producers.md",
    targetFiles: ["forge.yaml"],
  },
  {
    ruleId: "CONF-03",
    action:
      "Fix the script path inside the reported emit.argv/mirror.argv — producer-side paths resolve from the repo root; flag-value tokens and bare binary names are skipped, argv with no path-looking element passes vacuously. consumer.validator.argv is intentionally not linted — consumer-side failures surface as consumer-leg transport failures at run time.",
    docRef:
      "docs/rfcs/rfc-1365-require-golden-conformance-runs-against-authoritative-consumers-for-declared-contract-producers.md",
    targetFiles: ["forge.yaml"],
  },
  {
    ruleId: "CONF-04",
    action:
      "consumer.root is absent on this machine — runs self-skip here (explicit skip verdict). Where the consumer checkout is guaranteed, enforce --require-consumer or FORGE_CONFORMANCE_REQUIRE=1 so the guard cannot silently degrade.",
    docRef:
      "docs/rfcs/rfc-1365-require-golden-conformance-runs-against-authoritative-consumers-for-declared-contract-producers.md",
    targetFiles: ["forge.yaml"],
  },
  {
    ruleId: "CONF-05",
    action:
      "Rename or remove the duplicate producer id — contractProducers[] ids must be unique; forge.conformance.run --producer selects by id.",
    docRef:
      "docs/rfcs/rfc-1365-require-golden-conformance-runs-against-authoritative-consumers-for-declared-contract-producers.md",
    targetFiles: ["forge.yaml"],
  },
  {
    ruleId: "CONF-06",
    action:
      "Declare mirror.argv for the producer — the same-input mirror leg detects stricter-than-consumer drift before the consumer validator runs; omitting it leaves that drift class unarmed.",
    docRef:
      "docs/rfcs/rfc-1365-require-golden-conformance-runs-against-authoritative-consumers-for-declared-contract-producers.md",
    targetFiles: ["forge.yaml"],
  },
  // --- Fixed branch model (RFC-1486) — flow.check rules -------------------
  {
    ruleId: "FLOW-01",
    contract: "A local branch name matches neither the protected set nor the auto/<kind>-<YYMMDD>-<NN>-<slug> grammar.",
    action:
      "Integrate the branch's work through a conforming auto branch, then delete the stray name — git branch -d <name> when fully merged, git branch -D <name> to drop it.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-02",
    contract: "The repository has no develop branch — the fixed model requires it as the integration target.",
    action:
      "Create develop by adopting the model — run flow.install, which creates develop at the tip of main (or fast-forwards it) as part of adoption.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-03",
    contract: "The guard is not installed: core.hooksPath differs from hooks, the managed block is missing from hooks/pre-commit, or hooks/flow-guard.sh differs from the shipped asset.",
    action:
      "Re-run flow.install — it restores core.hooksPath, the managed pre-commit block, and the byte-exact guard in one idempotent pass.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
    targetFiles: ["hooks/pre-commit", "hooks/flow-guard.sh"],
  },
  {
    ruleId: "FLOW-04",
    contract: "main has commits that are not in develop — a back-merge is owed (warning).",
    action:
      "Back-merge main into develop through the release flow — the owed commits reach develop as a merge, never a direct commit.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-05",
    contract: "forge.generated.yaml exists but fails the forge/generated@1 schema — an invalid marker is an error, never an exemption.",
    action:
      "Fix the marker to carry schema: forge/generated@1 plus non-empty generator and source strings — or delete it if the repository is governed, not generated.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
    targetFiles: ["forge.generated.yaml"],
  },
  // --- Guard refusals (hooks/flow-guard.sh, RFC-1486) ----------------------
  {
    ruleId: "FLOW-GUARD-01",
    contract: "A commit was attempted directly on a protected integration branch (develop or main).",
    action:
      "Move the work onto a conforming auto branch — create auto/<kind>-<YYMMDD>-<NN>-<slug>, restage the change there and commit again.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-GUARD-02",
    contract: "A commit was attempted on a branch name outside the auto/<kind>-<YYMMDD>-<NN>-<slug> grammar.",
    action:
      "Rename the branch to a conforming auto name — git branch -m <old> auto/<kind>-<YYMMDD>-<NN>-<slug> — then commit again.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-GUARD-03",
    contract: "A commit was attempted on a detached HEAD outside a rebase or cherry-pick.",
    action:
      "Attach HEAD to a conforming auto branch — git switch -c auto/<kind>-<YYMMDD>-<NN>-<slug> — then commit again.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-GUARD-04",
    contract: "FORGE_FLOW_OP carried a value outside the closed vocabulary (backmerge, install).",
    action:
      "Unset FORGE_FLOW_OP and commit again — only Forge flow commands set it; a hand-set value is treated as a bypass attempt.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  // --- Adoption refusals (flow.install, RFC-1486) --------------------------
  {
    ruleId: "FLOW-ADOPT-01",
    contract: "develop carries commits that are not in main — adoption cannot level a diverged develop.",
    action:
      "Move develop's extra commits through a conforming auto branch first (rebase them onto main), then re-run flow.install.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-ADOPT-02",
    contract: "core.hooksPath is already set to a value other than hooks — adoption never hijacks a foreign hooks directory.",
    action:
      "Repoint core.hooksPath to hooks and move the existing hooks under hooks/ — or unset it — then re-run flow.install.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-ADOPT-03",
    contract: "The primary worktree has tracked modifications — adoption requires a clean primary checkout.",
    action:
      "Commit or stash the named tracked changes in the primary worktree, then re-run flow.install.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-ADOPT-04",
    contract: "develop is checked out in a linked worktree that has tracked modifications — it cannot be fast-forwarded safely.",
    action:
      "Commit or stash the tracked changes in the worktree carrying develop, then re-run flow.install.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-ADOPT-05",
    contract: "The repository is exempt (generated marker) or ungoverned (no forge.yaml) — only governed repositories are adopted.",
    action:
      "Run flow.install inside a governed repository — one with forge.yaml and no forge.generated.yaml marker.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
    targetFiles: ["forge.generated.yaml"],
  },
  {
    ruleId: "FLOW-ADOPT-06",
    contract: "The repository has commits but no main branch — the fixed model's release line is named main.",
    action:
      "Rename the default branch to main first — git branch -m <old> main — then re-run flow.install.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-ADOPT-08",
    contract: "The primary worktree is not in an adoptable position — either it sits on a branch other than main or develop, or it is on main while develop is already checked out in a linked worktree.",
    action:
      "On a foreign branch: switch the primary to main first (git switch main) and re-run flow.install. With develop checked out elsewhere: run flow.install from that worktree, or detach it first.",
    docRef:
      "docs/rfcs/rfc-1486-forge-flow-fixed-branch-model-with-guard-hooks-and-repository-adoption.md",
  },
  {
    ruleId: "FLOW-ADOPT-07",
    contract: "A release line cannot be baselined — the version file is lower than the last tag (never tag backwards), is unparsable, or the commit introducing it is not an ancestor of main.",
    action:
      "Raise the version file above the last tag or fix the wrong tag manually; land the version-introduction commit on main first; then re-run flow.install.",
    docRef:
      "docs/rfcs/rfc-1488-forge-flow-release-lines-and-versions-derived-from-release-tags.md",
  },
  {
    ruleId: "FLOW-08",
    contract: "A release line's version file differs from its last tag — a version file is only written at a release cut, so a divergence is an unbaselined line or a between-releases edit.",
    action:
      "When the file is higher, run flow.install to create the baseline tag; when lower or the tag is right, restore the version file to the tag's value.",
    docRef:
      "docs/rfcs/rfc-1488-forge-flow-release-lines-and-versions-derived-from-release-tags.md",
    targetFiles: ["package.json"],
  },
  {
    ruleId: "FLOW-09",
    contract: "An extract.config.yaml declares versionBump — repo-extract would rewrite the version during export, outside the release flow.",
    action:
      "Remove versionBump from the extract.config.yaml — versions are cut by the release flow only.",
    docRef:
      "docs/rfcs/rfc-1488-forge-flow-release-lines-and-versions-derived-from-release-tags.md",
    targetFiles: ["extract.config.yaml"],
  },
  {
    ruleId: "FLOW-VER-01",
    contract: "A release line has no reachable annotated baseline tag — without it no derived version exists.",
    action:
      "Run flow.install to create the baseline tag at the commit that introduced the current version.",
    docRef:
      "docs/rfcs/rfc-1488-forge-flow-release-lines-and-versions-derived-from-release-tags.md",
  },
  {
    ruleId: "FLOW-VER-02",
    contract: "Two package directories share one basename — their tag prefixes would collide.",
    action:
      "Rename one of the directories, or exclude it from the workspace globs in pnpm-workspace.yaml.",
    docRef:
      "docs/rfcs/rfc-1488-forge-flow-release-lines-and-versions-derived-from-release-tags.md",
    targetFiles: ["pnpm-workspace.yaml"],
  },
  {
    ruleId: "FLOW-VER-03",
    contract: "An X-RFC commit trailer names an RFC that cannot be read under docs/rfcs — its versionBump cannot level the line, so it counts as patch.",
    action:
      "Fix the trailer to name a real RFC id, or restore the missing RFC file under docs/rfcs.",
    docRef:
      "docs/rfcs/rfc-1488-forge-flow-release-lines-and-versions-derived-from-release-tags.md",
    targetFiles: ["docs/rfcs"],
  },
  {
    ruleId: "FLOW-VER-04",
    contract: "flow.version --line names a release line that does not exist.",
    action:
      "Pick one of the listed line ids — repo or an extract.config.yaml package basename.",
    docRef:
      "docs/rfcs/rfc-1488-forge-flow-release-lines-and-versions-derived-from-release-tags.md",
  },
  {
    ruleId: "FLOW-06",
    contract: "An unregistered auto/* branch's last commit is older than the 72-hour staleness threshold.",
    action:
      "Decide the branch's fate: register its session with flow.open, integrate it with flow.integrate, or delete it — stale auto branches are never left to rot.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-07",
    contract: "The shared flow registry disagrees with git state — a schema-invalid registry file, a registered branch or worktree missing, or an auto/* worktree without a registry entry.",
    action:
      "Inspect with flow.status; repair or remove .git/forge/registry.yaml when the schema is invalid, or reconcile stale entries with flow.discard.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-OPEN-01",
    contract: "flow.open was called with an invalid --kind/--slug, or git worktree add failed.",
    action:
      "Pass --kind session (or --kind task) and a lowercase-hyphenated slug of 3–48 characters; on a git failure inspect the stderr — a stale ref or lock may need cleanup.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-OPEN-02",
    contract: "flow.open found no local develop branch to branch from.",
    action: "Adopt the fixed branch model with flow.install first.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-OPEN-03",
    contract: "The sibling worktree path flow.open computed already exists on disk.",
    action: "Remove the stale directory or pick a different --slug.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-OPEN-04",
    contract: "No free daily sequence NN remains, or a raced branch-name collision outlasted the retry budget.",
    action:
      "Discard stale auto branches with flow.discard; on a racing collision simply re-run — the allocator picks the next free NN.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-OPEN-05",
    contract: "flow.open --kind task was called without --owner <task-id>.",
    action: "Pass the queue task id via --owner, or open a session branch instead.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-OPEN-06",
    contract: "flow.open ran in a repository that is not governed by the fixed branch model.",
    action: "Adopt the fixed branch model with flow.install; a malformed forge.generated.yaml marker must be fixed or removed first.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-OPEN-07",
    contract: "The primary checkout's hooks/worktree-setup.sh failed inside the new worktree — the branch, worktree, and registry entry are kept.",
    action: "Fix hooks/worktree-setup.sh in the primary checkout, then work in the opened worktree or discard it with flow.discard.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-01",
    contract: "flow.integrate found tracked modifications inside the branch worktree.",
    action: "Commit or revert the tracked changes inside the session worktree, then re-run.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-02",
    contract: "Rebasing the registered branch onto develop produced conflicts — the rebase was aborted and the branch is left intact.",
    action: "Resolve the rebase inside the session worktree (git rebase develop), commit, and re-run flow.integrate.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-03",
    contract: "flow.integrate found the primary worktree dirty or not on develop before the fast-forward.",
    action: "Switch the primary checkout to develop and commit or revert its tracked changes, then re-run — the branch stays rebased.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-04",
    contract: "Post-integration cleanup failed — the teardown hook refused, or git worktree remove / branch -d failed after develop already moved.",
    action: "Resolve what the diagnostic names (teardown demand, dirty files, locks) and re-run flow.integrate — the rerun resumes cleanup without moving develop again.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-05",
    contract: "The primary checkout's hooks/integration-gate.sh refused the integration — develop is unchanged.",
    action: "Fix what the gate demands inside the session worktree, then re-run flow.integrate.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-06",
    contract: "flow.integrate could not resolve a registered session/task branch — no --branch on a detached HEAD, or the branch is not in the registry.",
    action: "Pass --branch auto/<kind>-<YYMMDD>-<NN>-<slug> explicitly; check flow.status for live registered entries.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-07",
    contract: "develop moved between the rebase and the fast-forward despite the integration lock, or git merge --ff-only failed.",
    action: "Re-run flow.integrate — it rebases onto the new develop tip and retries the fast-forward.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-08",
    contract: "The integration lock is held by another running integration.",
    action: "Wait for the running integration to finish — locks older than two hours are broken automatically with a warning.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-09",
    contract: "A port entry's tip is not the fixed-message back-merge commit — expected 'release <tags> → develop' with second parent port.mainSha.",
    action:
      "Commit the resolved merge inside the port worktree with git commit --no-edit (the subject stays fixed), or reopen the port with flow.backmerge --redo.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-INT-10",
    contract: "develop moved since a back-merge port branch opened — the port would merge a stale main context.",
    action: "Run flow.backmerge --redo to discard the stale port and reopen it on the new develop tip.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-01",
    contract: "flow.cut ran in a repository that is not adopted into the fixed branch model (governed + guard installed + develop), or a release-internal git step failed.",
    action: "Adopt the model with flow.install; if the diagnostic names a failed git step, inspect that step's stderr.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-02",
    contract: "main carries a release not yet back-merged into develop — a cut must not reorder the owed port.",
    action: "Run flow.backmerge first, then re-run flow.cut.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-03",
    contract: "--lines named a release line the repository does not declare.",
    action: "Pass only ids from flow.version --json (package dirs carrying extract.config.yaml).",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-04",
    contract: "Nothing to release — the line has no pending commits or no baseline tag.",
    action: "Drop the line from --lines, land work touching its paths first, or create the baseline tag with flow.install.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-05",
    contract: "The computed level is major — major cuts are operator-only.",
    action: "Re-run with ALLOW_MAJOR_BUMP=1 in the environment.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-06",
    contract: "The release's target tag already exists.",
    action: "Pick a different version, or delete the stray tag if it was never published.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-07",
    contract: "The primary worktree is dirty or not on develop, the fix worktree is dirty, or another worktree holds main.",
    action: "Switch the primary to develop, commit or revert its changes, and ensure no worktree checks out main.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-08",
    contract: "hooks/release-fingerprints.sh failed or its stdout was not a flat YAML mapping of string keys to string values.",
    action: "Fix the fingerprint hook to emit only 'key: value' string pairs, then re-run — main has not moved.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-09",
    contract: "--lines was passed to a fix release — a fix derives its lines from the commits it carries.",
    action: "Drop --lines; the fix's touched package lines are computed from git diff baseSha..fixTip.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-10",
    contract: "A fix commit's X-RFC trailer demands minor or major — a fix releases a patch only.",
    action: "Integrate the change on develop and run an ordinary flow.cut instead.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-11",
    contract: "A version-file write failed verification — the top-level version field could not be replaced exactly once.",
    action: "Fix the version file so the top-level \"version\" field is the release version; the release branch was removed.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-CUT-12",
    contract: "hooks/release-prepare.sh exited non-zero — version-hashed derived artifacts could not be regenerated into the release commit.",
    action: "Fix the release-prepare hook (run it by hand in a worktree to reproduce) and re-run flow.cut; the release branch was removed.",
    docRef:
      "docs/rfcs/rfc-1502-forge-flow-release-preparation-hook-and-extract-verification-before-tagging.md",
  },
  {
    ruleId: "FLOW-CUT-13",
    contract: "Pre-tag extract verification failed for a named package line — repo-extract at the release commit or extract-verify on the scratch did not pass.",
    action: "Reproduce with repo-extract --config <dir>/extract.config.yaml --ref <sha> --dest <scratch> --no-push plus hooks/extract-verify.sh, fix the failure, and re-run flow.cut; develop, main and the tags are untouched.",
    docRef:
      "docs/rfcs/rfc-1502-forge-flow-release-preparation-hook-and-extract-verification-before-tagging.md",
  },
  {
    ruleId: "FLOW-CUT-14",
    contract: "release-prepare left untracked files — only tracked modifications join the release commit.",
    action: "Have the hook write its artifacts to tracked paths, or gitignore the leftovers; the listed files were excluded from the release commit.",
    docRef:
      "docs/rfcs/rfc-1502-forge-flow-release-preparation-hook-and-extract-verification-before-tagging.md",
  },
  {
    ruleId: "FLOW-FIX-01",
    contract: "flow.fix ran in a repository that is not adopted into the fixed branch model.",
    action: "Run flow.install first.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-FIX-02",
    contract: "main moved past the repository line's last-tag commit — the fix must start at the release baseline.",
    action: "Cut a release first (flow.cut), then open the fix.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-FIX-03",
    contract: "flow.fix was called with a --slug that fails the auto-branch grammar.",
    action: "Pass a lowercase-hyphenated slug of 3–48 characters: ^[a-z0-9]+(-[a-z0-9]+)*$.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-FIX-04",
    contract: "main is not an ancestor of develop — a back-merge port is owed, and two fixes must never stack two port branches.",
    action: "Finish the pending back-merge first with flow.backmerge.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-BM-01",
    contract: "flow.backmerge found the primary worktree dirty or not on develop, or main ahead without release tags to port.",
    action: "Switch the primary to develop and commit or revert its changes; for a tagless main inspect refs/heads/main — only releases should advance it.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-BM-02",
    contract: "A port entry for the same mainSha already exists — a second port must never race the first.",
    action: "Finish the existing port with flow.integrate, or re-run with --redo to reopen it.",
    docRef:
      "docs/rfcs/rfc-1490-forge-flow-release-cut-release-fix-and-back-merge-on-the-fixed-branch-model.md",
  },
  {
    ruleId: "FLOW-DIS-01",
    contract: "flow.discard was asked to remove a held branch — held entries are never discarded.",
    action: "Release the hold first; the wave-2 outbound RFC defines flow.hold/flow.unhold.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-DIS-02",
    contract: "flow.discard removal failed — the teardown hook refused, or git worktree remove / branch -D errored.",
    action: "Resolve what the diagnostic names and re-run — the branch and registry entry are kept until every removal step succeeds.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-DIS-03",
    contract: "flow.discard found tracked modifications inside the worktree and --dirty was not passed.",
    action: "Commit or integrate the changes first, or re-run with --dirty to acknowledge discarding them.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-DIS-04",
    contract: "flow.discard lacks a target — missing --reason, no resolvable branch, or the branch is not registered.",
    action: "Re-run with --reason \"<operator's words>\" and --branch naming a registered auto/* entry — check flow.status for live entries.",
    docRef:
      "docs/rfcs/rfc-1487-forge-flow-per-session-worktrees-beside-the-repository-with-a-local-branch-registry.md",
  },
  {
    ruleId: "FLOW-INT-11",
    contract: "flow.integrate was pointed at a held branch — held entries have no worktree and replay back via flow.unhold only.",
    action: "Run flow.unhold --branch <held branch> to return it to the normal integrate path.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-10",
    contract: "A package release line has no valid forge.generated.yaml (forge/generated@1, generator repo-extract) in its directory.",
    action: "Re-run flow.install to restore the marker — a line without one must not be published.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-GUARD-05",
    contract: "A plain git push ran in an adopted repository — pushes go through flow.push only (outbound by operator command).",
    action: "Run pnpm exec forge flow.digest, review the risk digest, then let the operator run flow.push --digest <id>.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-HOLD-01",
    contract: "flow.hold lacks a live target — --item names nothing in a freshly computed digest (or the arguments are missing).",
    action: "Run flow.digest and quote a current item id; both --item and --reason are required.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-HOLD-02",
    contract: "An unpushed release tag points at or above the item's base — the work is already released locally.",
    action: "Push first (flow.push), or delete the tag if it was created in error.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-HOLD-03",
    contract: "A registered open entry has its baseSha on the tail above the held item — a later integrate would bring the held commits back.",
    action: "Integrate or discard that branch first, then re-run flow.hold.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-HOLD-04",
    contract: "The primary worktree is dirty or not on develop — hold replay resets the primary checkout.",
    action: "Commit or stash the primary checkout and switch it to develop, then re-run flow.hold.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-HOLD-05",
    contract: "The item is a release, back-merge or unattributed run — only integration items can be held.",
    action: "Discard or discard-resolve non-integration work instead of holding it.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-HOLD-06",
    contract: "A merge commit lies above the item on the unpushed tail — cherry-pick replay cannot reorder merges.",
    action: "Resolve the merge so the tail above the item is linear, then re-run flow.hold.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-HOLD-07",
    contract: "A hold replay step failed — worktree creation, cherry-pick conflict, branch write or the primary reset; nothing changed.",
    action: "Inspect the named git step; on a cherry-pick conflict reorder the work first, then re-run flow.hold.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-HOLD-08",
    contract: "flow.unhold targets a branch that is not a registered held entry.",
    action: "Check flow.status for held entries and pass --branch naming one.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-11",
    contract: "A .github/workflows file cannot be parsed, or its on.push.tags pattern uses a glob Forge does not evaluate — tag triggers are skipped, never guessed.",
    action: "Fix the workflow YAML; keep tag patterns to the evaluated subset (* within a segment, ** across segments, ? one char) — character classes and negations match nothing.",
    docRef:
      "docs/rfcs/rfc-1498-forge-flow-adoption-hardening-for-stray-auto-branches-marker-sources-and-pre-program-tags.md",
  },
  {
    ruleId: "FLOW-PUSH-01",
    contract: "The repository has no 'origin' remote — the outbound flow reads and writes origin only.",
    action: "Add an 'origin' remote first.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-PUSH-02",
    contract: "The quoted digest id is stale — the recomputed digestId differs, or --digest is missing.",
    action: "Run flow.digest, review the new state, and re-run flow.push --digest <new id>.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-PUSH-03",
    contract: "An origin branch is not an ancestor of the local develop/main — someone pushed elsewhere.",
    action: "Fetch, inspect the divergence and reconcile before pushing.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-PUSH-04",
    contract: "git push --atomic failed — no ref was updated.",
    action: "Inspect the push stderr in the diagnostic, fix the transport or ref problem, and re-run flow.push.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-PUSH-05",
    contract: "A package-tag publication failed — extract, verify hook, or the destination push; other tags still publish.",
    action: "Fix the named cause and re-run flow.push — journal-scoped retries publish exactly the pushed-but-unpublished remainder. A pending tag that can never publish is dropped by flow.publication.retire --tag <tag> --reason <why> (RFC-1503).",
    docRef:
      "docs/rfcs/rfc-1503-forge-flow-pending-publications-are-superseded-retired-and-never-published-out-of-order.md",
  },
  {
    ruleId: "FLOW-RETIRE-01",
    contract: "flow.publication.retire targets a tag that is not pending — only pushed-but-unpublished tags can be retired.",
    action: "Check flow.digest pendingPublications (and supersededPublications) for the tag to retire.",
    docRef:
      "docs/rfcs/rfc-1503-forge-flow-pending-publications-are-superseded-retired-and-never-published-out-of-order.md",
  },
  {
    ruleId: "FLOW-RETIRE-02",
    contract: "flow.publication.retire requires a non-empty --reason — the journal records it verbatim.",
    action: "Pass a short reason naming why the tag can never publish.",
    docRef:
      "docs/rfcs/rfc-1503-forge-flow-pending-publications-are-superseded-retired-and-never-published-out-of-order.md",
  },
  {
    ruleId: "FLOW-PUSH-06",
    contract: "A package line about to publish has no valid forge.generated.yaml in its directory.",
    action: "Re-run flow.install to restore the marker, or remove the line's tags.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "FLOW-PUSH-07",
    contract: "node_modules/.bin/repo-extract is missing while package tags wait to publish.",
    action: "Install the workspace dependencies so repo-extract is linked.",
    docRef:
      "docs/rfcs/rfc-1491-forge-flow-outbound-only-by-operator-command-with-risk-digest-hold-and-push.md",
  },
  {
    ruleId: "A11Y-CONTRAST-01",
    contract: "A resolved same-block color/background pair measures below the WCAG contrast threshold.",
    action: "Darken the foreground toward the text color or lighten the background — the established convention is color-mix() toward var(--ds-text-*) tokens.",
    docRef: "packages/werkstatt-site/src/checks/a11y-contrast-lint.ts",
  },
  {
    ruleId: "A11Y-CONTRAST-02",
    contract: "A same-block color/background pair could not be resolved into sRGB — the pairing is unmeasured.",
    action: "Resolve the var()/color-mix() chain so the pairing is measurable, or declare the pairing intentional.",
    docRef: "packages/werkstatt-site/src/checks/a11y-contrast-lint.ts",
  },
  {
    ruleId: "A11Y-LIN-01",
    contract: "Element with aria-label='…' does not include visible text '…' in its accessible name.",
    action: "Either include the visible text in aria-label (e.g. 'Situation beschreiben — Anfrage senden') or remove aria-label and let the visible text be the accessible name.",
    docRef: "packages/werkstatt-site/src/checks/a11y-label-in-name.ts",
  },
  {
    ruleId: "A11Y-LIN-COMP-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/a11y-label-in-name-component.ts.",
    docRef: "packages/werkstatt-site/src/checks/a11y-label-in-name-component.ts",
  },
  {
    ruleId: "ACCESS-01",
    contract: "access protection probe inconclusive for …: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/sternsystem/sternsystem-validate.ts.",
    docRef: "packages/werkstatt-engine/src/sternsystem/sternsystem-validate.ts",
  },
  {
    ruleId: "ACCESS-02",
    contract: "accessPinSuspended.at is unparseable (\"…\", by …) — age unknown; run: pnpm exec werkstatt run leitstand.access.resume --site …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/sternsystem/sternsystem-validate.ts.",
    docRef: "packages/werkstatt-engine/src/sternsystem/sternsystem-validate.ts",
  },
  {
    ruleId: "ACCESS-PROTECTION-01",
    contract: "Validate RFC-0899 access protection middleware: browser-fetched public assets (manifest.webmanifest) are exempted from Basic Auth on dev/alt subdomains.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/access-protection-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/access-protection-validate.ts",
  },
  {
    ruleId: "AGC-02",
    contract: "api-catalog linkset entries diverge from the current manifest, or a capability declares an unsatisfiable integration.source.",
    action: "Rerun agent.api-catalog.generate, or fix the capability's integration.source declaration.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-api-catalog.ts",
  },
  {
    ruleId: "AGC-03",
    contract: "agent.enabled is false but api-catalog still exists on disk, or a capability's humanEquivalent parity is violated.",
    action: "Rerun agent.api-catalog.generate to remove the stale artifact, or align the capability's humanEquivalent with its sideEffect.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-api-catalog.ts",
  },
  {
    ruleId: "AGENT-CONTRACT-01",
    contract: "External contract check: replays the golden journey (discovery → knowledge → MCP → action → health) and probes every advertised interfaces.* endpoint for drift (RFC-1413) against a live deployed origin.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/agent/agent-contract-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-contract-check.ts",
  },
  {
    ruleId: "AGENT-PAGE-01",
    contract: "Page advertises endpoint \"…\" absent from agent-surface.generated.yaml.",
    action: "Remove the authored endpoint or declare it in the manifest (facts render from the manifest, not prose).",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-page-validate.ts",
  },
  {
    ruleId: "AGENT-PAGE-02",
    contract: "Page names capability \"…\" absent from the closed capability catalog.",
    action: "Remove the id from authored content or add the capability record.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-page-validate.ts",
  },
  {
    ruleId: "AGENT-PAGE-03",
    contract: "Authored claim denies side effects for \"…\", but the catalog declares sideEffect: \"write\".",
    action: "Fix the prose or suppress with <!-- agent-page-allow: AGENT-PAGE-03 -->.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-page-validate.ts",
  },
  {
    ruleId: "AGENT-PAGE-04",
    contract: "Page uses agent-surface-overview but src/agent-surface.generated.yaml is missing — the component fails the build closed.",
    action: "Run `werkstatt run agent.manifest.generate` (and agent.routes.generate for the JSON bridges).",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-page-validate.ts",
  },
  {
    ruleId: "AGENT-PAGE-05",
    contract: "Page uses agent-surface-overview but agent.enabled is false — the page advertises a machine surface that does not exist.",
    action: "Remove the section or enable agent.enabled in src/content/system.md.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-page-validate.ts",
  },
  {
    ruleId: "AGK-01",
    contract: "Leaks a non-public business value: \"…\".",
    action: "Remove the value from the domain projector input — non-public domains never reach agent outputs.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGK-02",
    contract: "Knowledge file is not valid JSON.",
    action: "Rerun agent.knowledge.generate.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGK-04",
    contract: "Knowledge file data has drifted from what the projectors currently produce.",
    action: "Rerun agent.knowledge.generate; never hand-edit generated knowledge files.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGK-05",
    contract: "Freshness ledger covers this domain but the file was generated before it applied.",
    action: "Rerun agent.knowledge.generate.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-knowledge.ts",
  },
  {
    ruleId: "AGK-06",
    contract: "Empty string value found at data.….",
    action: "Omit empty fields — do not serialize empty strings in public knowledge.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGK-07",
    contract: "Empty skeleton object/array at data.….",
    action: "Omit empty containers unless the schema explicitly allows them.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGK-08",
    contract: "Required freshness metadata is missing.",
    action: "Provide a source-backed lastVerified date via CKL ledger or authored verification.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-knowledge.ts",
  },
  {
    ruleId: "AGK-09",
    contract: "statusUrl \"…\" does not resolve to a generated static file or runtime-owned declaration.",
    action: "Point statusUrl to a generated artifact (e.g. cosmic-passport.json) or remove it.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGK-10",
    action: "Rerun agent.knowledge.generate to emit a properly versioned schema tag.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGK-11",
    contract: "agent.enabled is false but entity documents still exist on disk.",
    action: "Rerun agent.knowledge.generate to remove stale artifacts.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-knowledge.ts",
  },
  {
    ruleId: "AGS-01",
    action: "Remove the domain from the knowledge projection; non-public domains never reach agent outputs.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGS-03",
    contract: "Knowledge file on disk is not referenced by the Agent Surface Manifest.",
    action: "Rerun agent.manifest.generate, or remove the orphaned file.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGS-04",
    contract: "Manifest advertises action(s) but agent.actions is not a resolved entitlement.",
    action: "Rerun entitlements.resolve then agent.manifest.generate.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGS-06",
    contract: "agent.enabled is false but agent surface artifacts still exist on disk.",
    action: "Rerun agent.manifest.generate to remove stale artifacts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGS-07",
    contract: "Manifest advertises an MCP endpoint but the generated route does not exist.",
    action: "Rerun agent.routes.generate.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "AGS-09",
    contract: "Manifest proof is invalid against the committed public key.",
    action: "Rerun agent.surface.sign with the correct PASSPORT_SIGNING_KEY.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-manifest.ts",
  },
  {
    ruleId: "AGS-DISCOVERY-01",
    contract: "Advertised endpoint … has no generated artifact or route.",
    action: "Remove the advertisement or rerun the generator that owns this endpoint.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-manifest.ts",
  },
  {
    ruleId: "AGS-OAUTH-01",
    contract: "agent.auth.enabled is true but the manifest advertises no interfaces.oauth — the authorization server cannot be discovered.",
    action: "Ensure SIGNING_PRIVATE_KEY is configured at generation time, then rerun agent.manifest.generate.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-manifest.ts",
  },
  {
    ruleId: "AGS-RECEIPT-01",
    contract: "Write capability \"…\" output schema does not declare the ActionReceipt fields: ….",
    action: "Declare the ActionReceipt fields on this capability's output schema.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-manifest.ts",
  },
  {
    ruleId: "AI.VALIDATE",
    action: "Run ai.generate and ensure the ai.txt policy contains the required directives.",
    docRef: "packages/werkstatt-site/src/checks/ai.ts",
  },
  {
    ruleId: "ANALYTICS-MATOMO-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/analytics-matomo.ts.",
    docRef: "packages/werkstatt-site/src/checks/analytics-matomo.ts",
  },
  {
    ruleId: "API-PROBE-01",
    contract: "A malformed-body POST returns contract JSON with a 4xx status.",
    action: "Fix the probe handler so malformed bodies produce a contract-shaped 4xx response.",
    docRef: "packages/werkstatt-site/src/checks/api-probe-check.ts",
  },
  {
    ruleId: "API-PROBE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/api-probe-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/api-probe-check.ts",
  },
  {
    ruleId: "API-PROBE-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/api-probe-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/api-probe-check.ts",
  },
  {
    ruleId: "API-PROBE-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/api-probe-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/api-probe-check.ts",
  },
  {
    ruleId: "ARCHETYPE-PARITY-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/archetype/registry-build.ts.",
    docRef: "packages/werkstatt-site/src/checks/archetype/registry-build.ts",
  },
  {
    ruleId: "ARD-01",
    contract: "… does not exist.",
    action: "Run agent.ard-catalog.generate.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-ard-catalog.ts",
  },
  {
    ruleId: "ARD-02",
    contract: "… entries diverge from the current manifest.",
    action: "Rerun agent.ard-catalog.generate.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-ard-catalog.ts",
  },
  {
    ruleId: "ARD-03",
    contract: "agent.enabled is false but … still exists on disk.",
    action: "Rerun agent.ard-catalog.generate to remove the stale artifact.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-ard-catalog.ts",
  },
  {
    ruleId: "ARG-COMPLIANCE-02",
    contract: "… declares flags: {} but handler reads input.flags[\"…\"] — add the flag to the schema.",
    action: "Add \"…\" to the flags schema for … in its command registration.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "ASSET.REFERENCE.VALIDATE",
    action: "Add the referenced asset to the content-local assets folder, or update the authored token to a resolvable bare filename.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "ASTRO-01",
    contract: "Run `astro check` in the site workspace — type-checks .astro frontmatter that tsc --noEmit never sees (missing await on Promises, prop type errors). Blocks the pipeline on diagnostics of severity error or higher.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/astro-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/astro-check.ts",
  },
  {
    ruleId: "AUTO-01",
    contract: "Agent approval exists below L2 or exceeds the current scope level.",
    action: "Raise the approval scope level or remove the below-L2 approval.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-governance.ts",
  },
  {
    ruleId: "AUTO-02",
    contract: "The persisted autonomy state maps a key whose level … exceeds its ceiling ….",
    action: "Lower the autonomy level below the declared ceiling or raise the ceiling for the key.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-governance.ts",
  },
  {
    ruleId: "AUTO-03",
    contract: "… claims … without sufficient calibration evidence.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts",
  },
  {
    ruleId: "AUTO-05",
    contract: "… autonomy state is malformed.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts",
  },
  {
    ruleId: "BARREL-01",
    contract: "…: root barrel has … export line(s), exceeding the …-line threshold.",
    action: "Split the barrel into domain subpath entry points (RFC-0264) and shrink the root barrel to a thin re-export layer.",
    docRef: "packages/werkstatt-site/src/checks/barrel-size-lint.ts",
  },
  {
    ruleId: "BARREL-02",
    contract: "…: \"…\" reappeared in the root barrel — its domain (…) already completed its RFC-0264 migration wave.",
    action: "Remove the re-export from the root barrel — import \"…\" from its subpath instead.",
    docRef: "packages/werkstatt-site/src/checks/barrel-size-lint.ts",
  },
  {
    ruleId: "BB-PARITY-01",
    action: "Import appendAndCommitBordbuch from bordbuch-commit-helper.ts and replace the append+commit pattern with a single helper call.",
    docRef: "packages/werkstatt-site/src/checks/bordbuch-commit-parity-lint.ts",
  },
  {
    ruleId: "BIOME-CONTRAST-HERO-01",
    contract: "…: presentation.hero.textBackdrop=… yields …:1.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/biome.ts.",
    docRef: "packages/werkstatt-site/src/checks/biome.ts",
  },
  {
    ruleId: "BIOME-ID-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/biome.ts.",
    docRef: "packages/werkstatt-site/src/checks/biome.ts",
  },
  {
    ruleId: "BIOME-PRES-01",
    contract: "…: presentation.… declared but the bound manifest … is unreadable.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/biome.ts.",
    docRef: "packages/werkstatt-site/src/checks/biome.ts",
  },
  {
    ruleId: "BOOK-01",
    contract: "booking.yaml is not parseable YAML: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/booking/config-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/booking/config-validate.ts",
  },
  {
    ruleId: "BOOK-02",
    contract: "window … (weekday …): end … not after start …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/booking/config-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/booking/config-validate.ts",
  },
  {
    ruleId: "BOOK-04",
    contract: "booking-requested event descriptor missing from the growth catalog.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/booking/config-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/booking/config-validate.ts",
  },
  {
    ruleId: "BRANCH-PROT-01",
    contract: "Policy is malformed — expected protectedBranch.name, requiredCheck.name, and requiredWorkflowSteps[].",
    action: "Ensure docs/policies/github-branch-protection.yaml has all required fields.",
    docRef: "packages/werkstatt-site/src/checks/github-branch-protection.ts",
  },
  {
    ruleId: "BRANCH-PROT-02",
    contract: "CI workflow is malformed — expected a jobs mapping.",
    action: "Fix .github/workflows/ci.yml so it has valid jobs.",
    docRef: "packages/werkstatt-site/src/checks/github-branch-protection.ts",
  },
  {
    ruleId: "BRANCH-PROT-03",
    contract: "Required check name \"…\" does not match any job name in …. Found job names: ….",
    action: "Update the job's \"name:\" field in ci.yml to match \"…\", or update the policy.",
    docRef: "packages/werkstatt-site/src/checks/github-branch-protection.ts",
  },
  {
    ruleId: "BRANCH-PROT-04",
    contract: "Required workflow step \"…\" is not present as a run: command in ….",
    action: "Add \"…\" as a run: step in the CI workflow.",
    docRef: "packages/werkstatt-site/src/checks/github-branch-protection.ts",
  },
  {
    ruleId: "CACHE-WRITE-01",
    contract: "Command \"…\" declares cacheWrites entry \"…\" that does not reduce to a concrete prefix.",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-engine/src/runtime/validate-declarations.ts.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "CAM-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/authority-model-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/authority-model-validate.ts",
  },
  {
    ruleId: "CAM-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/authority-model-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/authority-model-validate.ts",
  },
  {
    ruleId: "CAM-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/authority-model-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/authority-model-validate.ts",
  },
  {
    ruleId: "CAM-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/authority-model-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/authority-model-validate.ts",
  },
  {
    ruleId: "CAM-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/authority-model-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/authority-model-validate.ts",
  },
  {
    ruleId: "CANON-HTML-01",
    contract: "Canonical href … does not match any expected canonicalPageUrl output.",
    action: "Ensure pageUrl in resolve-route.ts uses canonicalPageUrl with trailingSlash: always.",
    docRef: "packages/werkstatt-site/src/checks/canonical-html-parity.ts",
  },
  {
    ruleId: "CANON-HTML-02",
    contract: "og:url … does not match any expected canonicalPageUrl output.",
    action: "Ensure og:url is derived from the same canonicalPageUrl output as the canonical tag.",
    docRef: "packages/werkstatt-site/src/checks/canonical-html-parity.ts",
  },
  {
    ruleId: "CANON-HTML-03",
    contract: "Canonical href … diverges from og:url …",
    action: "Ensure both canonical and og:url are derived from the same canonicalPageUrl output.",
    docRef: "packages/werkstatt-site/src/checks/canonical-html-parity.ts",
  },
  {
    ruleId: "CAPGAP-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "CAPGAP-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/capability-gap-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/capability-gap-validate.ts",
  },
  {
    ruleId: "CAPGAP-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/capability-gap-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/capability-gap-validate.ts",
  },
  {
    ruleId: "CASCADE-LAYER-01",
    contract: "Top-level style rule is not inside a declared @layer — component CSS must declare its cascade layer (wrap the file in @layer components { … }; unlayered author styles beat every layered rule regardless of specificity)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/css-layer-lint.ts.",
    docRef: "packages/werkstatt-site/src/checks/css-layer-lint.ts",
  },
  {
    ruleId: "CASCADE-LAYER-02",
    contract: "File mixes layered and unlayered top-level rules — a partial wrap is the exact inversion pattern RFC-1280 removes; move every rule into a declared @layer.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/css-layer-lint.ts.",
    docRef: "packages/werkstatt-site/src/checks/css-layer-lint.ts",
  },
  {
    ruleId: "CASCADE-LAYER-03",
    contract: "Undeclared cascade layer \"…\" — the platform stack declares: …",
    action: "Declare the layer in the platform cascade stack or remove its use in the stylesheet.",
    docRef: "packages/werkstatt-site/src/checks/css-layer-lint.ts",
  },
  {
    ruleId: "CF-IMPORT-01",
    contract: "Static import from \"…\" — this module is only available in the Cloudflare Workers runtime and causes ERR_UNSUPPORTED_ESM_URL_SCHEME during Astro build.",
    action: "Replace `import { env } from \"cloudflare:workers\"` with `const { env } = await import(\"cloudflare:workers\")` inside a try/catch. See access-protection.ts for the canonical pattern.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "CFPERM-01",
    contract: "Drift-guard the marked cloudflare-permissions sections in .env.example and docs/engineering/workshop-setup.md against the CLOUDFLARE_PERMISSIONS registry (RFC-1326). Emits CFPERM-01.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/leitstand/cloudflare-permissions.ts.",
    docRef: "packages/werkstatt-engine/src/leitstand/cloudflare-permissions.ts",
  },
  {
    ruleId: "CHAT-META-01",
    contract: "adapter \"…\" requiredOptions mismatch: adapter source has …, CHAT_ADAPTER_METADATA has …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/chat-metadata-drift.ts.",
    docRef: "packages/werkstatt-site/src/checks/chat-metadata-drift.ts",
  },
  {
    ruleId: "CHAT-META-02",
    contract: "adapter \"…\" vendorOrigins mismatch: adapter source has …, CHAT_ADAPTER_METADATA has …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/chat-metadata-drift.ts.",
    docRef: "packages/werkstatt-site/src/checks/chat-metadata-drift.ts",
  },
  {
    ruleId: "CHECK-FIX-01",
    contract: "… has no covering test file under packages/werkstatt-site/src/checks/tests/.",
    action: "Add a test file importing … with at least one failing fixture and one passing fixture.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "CHECK-FIX-02",
    contract: "…: covering test \"…\" lacks a … fixture.",
    action: "Add a … fixture case to packages/werkstatt-site/src/checks/tests/….",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "CHECK-FIX-03",
    action: "Register the command with execute: <importedFunctionName> from a dedicated module so fixture coverage can be resolved statically.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "CHROME-COPY-01",
    contract: "chrome copy \"…\" …: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/chrome-copy.ts.",
    docRef: "packages/werkstatt-site/src/checks/chrome-copy.ts",
  },
  {
    ruleId: "CHROME-COPY-02",
    contract: "chrome copy \"…\" …: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/chrome-copy.ts.",
    docRef: "packages/werkstatt-site/src/checks/chrome-copy.ts",
  },
  {
    ruleId: "CI-LOCAL-03",
    contract: "Workflow pins pnpm …, but root packageManager is ….",
    action: "Remove the hardcoded pnpm version and use Corepack, or pin the same pnpm major.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/governance.ts",
  },
  {
    ruleId: "CI-LOCAL-04",
    contract: "Workflow uses pnpm/action-setup without a pinned version or Corepack.",
    action: "Use Corepack or pin pnpm/action-setup to the root packageManager major.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/governance.ts",
  },
  {
    ruleId: "CI.LOCAL.VALIDATE",
    contract: "General PR CI workflow is missing.",
    action: "Add .github/workflows/ci.yml with the autonomous package quality gate commands.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "CJ-BIND-01",
    contract: "project … bound to … Sternsystemen: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/access/binding-report.ts.",
    docRef: "packages/werkstatt-journal/src/access/binding-report.ts",
  },
  {
    ruleId: "CJ-BIND-02",
    contract: "Sternsystem … bound to … active projects: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/access/binding-report.ts.",
    docRef: "packages/werkstatt-journal/src/access/binding-report.ts",
  },
  {
    ruleId: "CJ-BIND-03",
    contract: "grant … scope references project … outside client …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/access/binding-report.ts.",
    docRef: "packages/werkstatt-journal/src/access/binding-report.ts",
  },
  {
    ruleId: "CJ-CAT-01",
    contract: "catalog must be …, got …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/catalog.ts.",
    docRef: "packages/werkstatt-journal/src/validators/catalog.ts",
  },
  {
    ruleId: "CJ-CAT-02",
    contract: "entry is not an object.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/catalog.ts.",
    docRef: "packages/werkstatt-journal/src/validators/catalog.ts",
  },
  {
    ruleId: "CJ-CAT-03",
    contract: "A journal catalog entry fails the CJ catalog schema — the emitted message is the zod issue text.",
    action: "Fix the catalog entry field named in the zod issue.",
    docRef: "packages/werkstatt-journal/src/validators/catalog.ts",
  },
  {
    ruleId: "CJ-CAT-04",
    contract: "identity splice: … carries a different tenantId/clientId/projectId than chain head …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/catalog.ts.",
    docRef: "packages/werkstatt-journal/src/validators/catalog.ts",
  },
  {
    ruleId: "CJ-CHAIN-01",
    contract: "Verify a journal chain export end to end — schema, recomputed hashes, previousHash linkage.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/chain.ts.",
    docRef: "packages/werkstatt-journal/src/validators/chain.ts",
  },
  {
    ruleId: "CJ-CHAIN-02",
    contract: "Verify a journal chain export end to end — schema, recomputed hashes, previousHash linkage.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/chain.ts.",
    docRef: "packages/werkstatt-journal/src/validators/chain.ts",
  },
  {
    ruleId: "CJ-CHAIN-03",
    contract: "Verify a journal chain export end to end — schema, recomputed hashes, previousHash linkage.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/chain.ts.",
    docRef: "packages/werkstatt-journal/src/validators/chain.ts",
  },
  {
    ruleId: "CJ-CHAIN-04",
    contract: "Verify a journal chain export end to end — schema, recomputed hashes, previousHash linkage.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/chain.ts.",
    docRef: "packages/werkstatt-journal/src/validators/chain.ts",
  },
  {
    ruleId: "CJ-CHAIN-06",
    contract: "Verify a journal chain export end to end — schema, recomputed hashes, previousHash linkage.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/chain.ts.",
    docRef: "packages/werkstatt-journal/src/validators/chain.ts",
  },
  {
    ruleId: "CJ-DID-01",
    contract: "The published did.json is a JSON object whose id is a host-form did:web and whose @context leads with the DID v1 context (RFC-1268/D11).",
    action: "Regenerate did.json with `did.document.emit` and republish it at the did:web document path.",
    docRef: "packages/werkstatt-journal/src/evidence/did.ts",
  },
  {
    ruleId: "CJ-DID-02",
    contract: "The keyring's current key is published in did.json — receipts signed by it must be verifiable.",
    action: "Republish did.json via `did.document.emit` so the current ring key appears as a verificationMethod.",
    docRef: "packages/werkstatt-journal/src/evidence/did.ts",
  },
  {
    ruleId: "CJ-DID-03",
    contract: "Every historical ring key is published in did.json — receipts signed by rotated keys must stay verifiable.",
    action: "Republish did.json via `did.document.emit` so every historical ring key appears as a verificationMethod.",
    docRef: "packages/werkstatt-journal/src/evidence/did.ts",
  },
  {
    ruleId: "CJ-DID-04",
    contract: "Every verificationMethod is anchored to the did, typed Ed25519VerificationKey2020, and controller-bound to the did.",
    action: "Republish did.json via `did.document.emit` — verificationMethod entries are built from the ring with the did as controller.",
    docRef: "packages/werkstatt-journal/src/evidence/did.ts",
  },
  {
    ruleId: "CJ-DID-05",
    contract: "did.json publishes only keys present in this keyring, and assertionMethod references every published verificationMethod id (foreign keys warn, not fail — a rotated-ahead site may publish keys this ring predates).",
    action: "Reconcile the keyring with the published did.json — add the foreign key to receipt-keys.v1.json if it is a legitimate rotation, or republish via `did.document.emit`.",
    docRef: "packages/werkstatt-journal/src/evidence/did.ts",
  },
  {
    ruleId: "CJ-MAT-01",
    contract: "… requires actor \"studio\", got …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/materialanfrage.ts.",
    docRef: "packages/werkstatt-journal/src/validators/materialanfrage.ts",
  },
  {
    ruleId: "CJ-MAT-02",
    contract: "… requires actor \"studio\", got …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/materialanfrage.ts.",
    docRef: "packages/werkstatt-journal/src/validators/materialanfrage.ts",
  },
  {
    ruleId: "CJ-MAT-03",
    contract: "item.revision_requested payload present but feedbackText missing/empty.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/materialanfrage.ts.",
    docRef: "packages/werkstatt-journal/src/validators/materialanfrage.ts",
  },
  {
    ruleId: "CJ-MAT-04",
    contract: "… requires actor \"studio\", got …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/materialanfrage.ts.",
    docRef: "packages/werkstatt-journal/src/validators/materialanfrage.ts",
  },
  {
    ruleId: "CJ-MAT-05",
    contract: "… requires actor \"studio\", got …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/materialanfrage.ts.",
    docRef: "packages/werkstatt-journal/src/validators/materialanfrage.ts",
  },
  {
    ruleId: "CJ-PII-01",
    contract: "payload-class key on skeleton: \"………\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/skeleton-pii.ts.",
    docRef: "packages/werkstatt-journal/src/validators/skeleton-pii.ts",
  },
  {
    ruleId: "CJ-PII-02",
    contract: "non-technical key on …: \"…\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/skeleton-pii.ts.",
    docRef: "packages/werkstatt-journal/src/validators/skeleton-pii.ts",
  },
  {
    ruleId: "CJ-PII-03",
    contract: "payload-class key on skeleton: \"………\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-journal/src/validators/skeleton-pii.ts.",
    docRef: "packages/werkstatt-journal/src/validators/skeleton-pii.ts",
  },
  {
    ruleId: "CKL-CLAIM-01",
    contract: "Claim sidecar is not valid YAML: …",
    action: "Fix the YAML syntax so the sidecar parses.",
    docRef: "packages/werkstatt-site/src/checks/content-claims.ts",
  },
  {
    ruleId: "CKL-CLAIM-02",
    action: "Place the sidecar next to its <record>.md, or remove the orphan sidecar.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "CKL-CLAIM-03",
    contract: "Field \"…\" is external-provenance but has no sourceRef.",
    action: "Bind a source descriptor (RFC-0214) via sourceRef, or use provenance: asserted.",
    docRef: "packages/werkstatt-site/src/checks/content-claims.ts",
  },
  {
    ruleId: "CKL-DERIV-01",
    contract: "Derived claim \"…\" is outdated: source … changed since it was stamped.",
    action: "Update the derivative, then: content.derived.stamp --subject …",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "CKL-DERIV-02",
    contract: "Derived claim \"…\" has no derivedFrom.",
    action: "Set derivedFrom to the source subject (collection/[lang/]file#field).",
    docRef: "packages/werkstatt-site/src/checks/content-derived.ts",
  },
  {
    ruleId: "CKL-FRESH-01",
    contract: "Claim … is due for review (cadence lapsed; due …)…",
    action: "Re-verify the value and advance asOf (RFC-0218 edit transaction); comparative-commercial claims record verify-noop, verify-update, or withdraw in the claim ledger.",
    docRef: "packages/werkstatt-site/src/checks/content-freshness.ts",
  },
  {
    ruleId: "CKL-FRESH-02",
    contract: "Claim … expires soon (validUntil …).",
    action: "Re-verify and extend validUntil with a new asOf, before it expires.",
    docRef: "packages/werkstatt-site/src/checks/content-freshness.ts",
  },
  {
    ruleId: "CKL-FRESH-05",
    contract: "Claim \"…\" carries a validity window but has no sourced value.",
    action: "Source the value (RFC-0136) before it can carry a validity window.",
    docRef: "packages/werkstatt-site/src/checks/content-freshness.ts",
  },
  {
    ruleId: "CKL-SRC-01",
    contract: "Source descriptor invalid: …",
    action: "Make the descriptor match the source descriptor schema (RFC-0214).",
    docRef: "packages/werkstatt-site/src/checks/content-source-binding.ts",
  },
  {
    ruleId: "CKL-SRC-02",
    contract: "Claim \"…\" sourceRef \"…\" does not resolve to any descriptor.",
    action: "Add …/<id>.yaml, or fix the sourceRef.",
    docRef: "packages/werkstatt-site/src/checks/content-source-binding.ts",
  },
  {
    ruleId: "CKL-SRC-03",
    contract: "Source … observed \"…\" but site asserts \"…\" (…)",
    action: "Re-verify and update the value (RFC-0218 edit transaction), or record verify-noop.",
    docRef: "packages/werkstatt-site/src/checks/content-source-binding.ts",
  },
  {
    ruleId: "CKL-SRC-04",
    contract: "Source … was unreachable at last check (…).",
    action: "Transient; the monitor retries next cadence. Check the endpoint if persistent.",
    docRef: "packages/werkstatt-site/src/checks/content-source-binding.ts",
  },
  {
    ruleId: "CLAIM-CONFIG-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-pbp.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-pbp.ts",
  },
  {
    ruleId: "CLAIM-CONFIG-02",
    contract: "configClaims declares \"…\" (…) but no business-profile/<lang>/….md exists in any locale",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/lib/pbp-config-claims.ts.",
    docRef: "packages/werkstatt-site/src/checks/lib/pbp-config-claims.ts",
  },
  {
    ruleId: "CMD-DECL-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "CMD-DECL-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "CMD-DECL-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "CMD-MAN-01",
    contract: "docs/command-manifest.generated.yaml is missing.",
    action: "Run: pnpm exec werkstatt run command.manifest.generate.",
    docRef: "packages/werkstatt-engine/src/kernel/command-manifest.ts",
  },
  {
    ruleId: "CMD-MAN-02",
    contract: "Command \"…\" declares mutatesState: true but no writes.",
    action: "Declare the writes: [] glob(s) this command produces, or set mutatesState: false if it does not mutate the filesystem.",
    docRef: "packages/werkstatt-engine/src/kernel/command-manifest.ts",
  },
  {
    ruleId: "CMD-MAN-04",
    contract: "Command \"…\" is registered by … providers.",
    action: "Align the command declarations across providers, or rename one of the commands.",
    docRef: "packages/werkstatt-site/src/checks/command-manifest-validate.ts",
  },
  {
    ruleId: "CMD-MAN-05",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/command-manifest-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/command-manifest-validate.ts",
  },
  {
    ruleId: "CMD-OUTPUT-01",
    contract: "Return path missing explicit exitCode in …:…",
    action: "Add exitCode: 0 (success) or exitCode: 1 (failure) to the return object.",
    docRef: "packages/werkstatt-engine/src/plugin/commands-validate.ts",
  },
  {
    ruleId: "CMD-OUTPUT-02",
    contract: "Return path missing summary in …:…",
    action: "Add summary: \"[<cmd>] <description>\" to the return object, prefixed with the command name.",
    docRef: "packages/werkstatt-engine/src/plugin/commands-validate.ts",
  },
  {
    ruleId: "CMD-OUTPUT-03",
    contract: "Failure return path (exitCode: 1) has no nextSteps in …:…",
    action: "Add nextSteps: [{ action: \"...\", kind: \"required\" }] to the return object.",
    docRef: "packages/werkstatt-engine/src/plugin/commands-validate.ts",
  },
  {
    ruleId: "CMD-SCAN-01",
    contract: "File could not be read and was skipped: …",
    action: "Fix the unreadable file (permissions/encoding) or remove it from the scanned set.",
    docRef: "packages/werkstatt-engine/src/plugin/commands-validate.ts",
  },
  {
    ruleId: "CMDGEN-04",
    contract: "File appears to contain a command definition that was not extracted in …",
    action: "Conform the definition to the extraction pattern (literal name field, registerCommand/moduleLoaders shape) or move it out of the scanned surface.",
    docRef: "packages/werkstatt-engine/src/plugin/commands-validate.ts",
  },
  {
    ruleId: "CMDGEN-05",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/commands-generate.ts.",
    docRef: "packages/werkstatt-site/src/checks/commands-generate.ts",
  },
  {
    ruleId: "CMDGEN-06",
    contract: "definition \"…\" declares a non-literal name field (…) — the generated table would key off the source text, not the resolved value",
    action: "Replace the non-literal name field with a string literal at the declaration site.",
    docRef: "packages/werkstatt-site/src/checks/commands-generate.ts",
  },
  {
    ruleId: "CMP-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/comparative-claims.ts.",
    docRef: "packages/werkstatt-site/src/checks/comparative-claims.ts",
  },
  {
    ruleId: "COMP-01",
    contract: "RFC-1021: enforces site composition purity. COMP-01 bans .astro files in src/components/.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-composition.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-composition.ts",
  },
  {
    ruleId: "COMP-02",
    contract: "RFC-1021: enforces site composition purity. COMP-01 bans .astro files in src/components/.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-composition.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-composition.ts",
  },
  {
    ruleId: "COMP-ARTDIR-01",
    contract: "pages/…: supported locale '…' has no composed home page — the approved artDirection.firstFold cannot be proven there",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-ASSET-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-CASE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/heading-case.ts.",
    docRef: "packages/werkstatt-site/src/checks/heading-case.ts",
  },
  {
    ruleId: "COMP-CASE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/heading-case.ts.",
    docRef: "packages/werkstatt-site/src/checks/heading-case.ts",
  },
  {
    ruleId: "COMP-COVER-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-COVER-02",
    contract: "content-scope ruling … names … (ceiling …) but no composed block.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-COVER-03",
    contract: "product-line entity … (ceiling …) is resolved by no block on a primary-navigation page.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-DATA-01",
    contract: "Every id configured in `site/{lang}/labels.md` chrome blocks (`footer.contactIds`, `footer.navIds`, `header.navIds`, `footer.legalIds`, `footer.trustIds`, `footer.transparencyIds`) resolves to at least one renderable datum (ADR-0114).",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/chrome-data.ts.",
    docRef: "packages/werkstatt-site/src/checks/chrome-data.ts",
  },
  {
    ruleId: "COMP-FAQ-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-HYG-01",
    contract: "…: COMP-HYG-01 block declares backgroundImage=\"…\" without an effects entry targeting \"background\" — the scrim is a deliberate authoring choice.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-block.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-block.ts",
  },
  {
    ruleId: "COMP-HYG-02",
    contract: "…: COMP-HYG-02 header.motto is string-identical to a hero block's tagline declared in … — duplicate first-viewport copy.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-block.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-block.ts",
  },
  {
    ruleId: "COMP-HYG-03",
    contract: "No i18n.supported locales declared — site-layout label coverage has nothing to audit.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/labels-site-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/labels-site-validate.ts",
  },
  {
    ruleId: "COMP-I18N-01",
    contract: "Locale \"…\" declares no lang-switcher header control, but the site serves … locales — visitors have no way to switch language. Add `- id: lang-switcher / type: lang-switcher` to headerControls in site/…/labels.md.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/chrome-data.ts.",
    docRef: "packages/werkstatt-site/src/checks/chrome-data.ts",
  },
  {
    ruleId: "COMP-INTAKE-01",
    contract: "intake bundle at … carries no visual.artDirection — a pre-AMD-012 system is re-registered from a re-emitted bundle, not patched in place.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-LEDGER-01",
    contract: "onboarding decision ledger at … exists but is unparseable — …; repair missions/…/onboarding.decisions.yaml (an absent file is legal; an unreadable one skips every check whose verdict depends on ledger content — waiver lookups conservatively see an empty ledger)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-LEGAL-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-QUESTIONS-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "COMP-RECIPE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-SLOT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "COMP-SLOT-02",
    contract: "pages/…: supported locale '…' has no composed home page — the first-fold slot '…' cannot be proven on the home first block",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/composition-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMP-VISUAL-01",
    contract: "An onboarding-scoped mission carries a visual-review report — run `werkstatt run onboarding.visual.review --mission <id>` before the decision window opens (RFC-1359).",
    action: "Run `pnpm exec werkstatt run onboarding.visual.review --mission <id>` and commit the report, or answer a visual-review/art-direction-deviation waiver entry citing every residual VR-id.",
    docRef: "packages/werkstatt-site/src/onboarding/composition-validate.ts",
  },
  {
    ruleId: "COMPANION-01",
    contract: "Validate that content pages are mirrored across all language directories.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/module.ts.",
    docRef: "packages/werkstatt-site/src/checks/module.ts",
  },
  {
    ruleId: "COMPANION-02",
    contract: "Validate that content pages are mirrored across all language directories.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/module.ts.",
    docRef: "packages/werkstatt-site/src/checks/module.ts",
  },
  {
    ruleId: "COMPANION-03",
    contract: "Validate that content pages are mirrored across all language directories.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/module.ts.",
    docRef: "packages/werkstatt-site/src/checks/module.ts",
  },
  {
    ruleId: "COMPANION-04",
    contract: "Validate that content pages are mirrored across all language directories.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/module.ts.",
    docRef: "packages/werkstatt-site/src/checks/module.ts",
  },
  {
    ruleId: "COMPANION-05",
    contract: "Validate that content pages are mirrored across all language directories.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/module.ts.",
    docRef: "packages/werkstatt-site/src/checks/module.ts",
  },
  {
    ruleId: "COMPASS-CS-08",
    contract: "… — file left untouched.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/compass/handlers/compass-header-scaffold.ts.",
    docRef: "packages/forge/os/compass/handlers/compass-header-scaffold.ts",
  },
  {
    ruleId: "COMPASS-DOC-00",
    contract: "file is not well-formed XML: …",
    action: "Fix the malformed XML reported by the parser.",
    docRef: "packages/forge/os/compass/handlers/compass-docs-validate.ts",
  },
  {
    ruleId: "COMPASS-DOC-01",
    contract: "<path> references '…' — does not exist under the workspace root.",
    action: "Repoint to the live path or remove the stale reference.",
    docRef: "packages/forge/os/compass/handlers/compass-docs-validate.ts",
  },
  {
    ruleId: "COMPASS-DOC-02",
    contract: "id '…' names workspace path '…' — does not exist.",
    action: "Repoint to the live package or remove the stale entry.",
    docRef: "packages/forge/os/compass/handlers/compass-docs-validate.ts",
  },
  {
    ruleId: "COMPASS-DOC-03",
    contract: "link target '…' resolves to no declared node and no file.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/compass/handlers/compass-docs-validate.ts.",
    docRef: "packages/forge/os/compass/handlers/compass-docs-validate.ts",
  },
  {
    ruleId: "COMPASS-INVARIANT-01",
    contract: "Unfilled … sentinel in Compass block.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/compass/handlers/compass-inventory-handler.ts.",
    docRef: "packages/forge/os/compass/handlers/compass-inventory-handler.ts",
  },
  {
    ruleId: "COMPASS-INVARIANT-03",
    contract: "vacuous invariant statement: \"…\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/compass/handlers/invariant-bindings.ts.",
    docRef: "packages/forge/os/compass/handlers/invariant-bindings.ts",
  },
  {
    ruleId: "COMPASS-INVARIANT-04",
    contract: "malformed invariant id \"…\" — expected INV-<scope>-<NN> (kebab scope, 2-3 digit tail)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/compass/handlers/invariant-bindings.ts.",
    docRef: "packages/forge/os/compass/handlers/invariant-bindings.ts",
  },
  {
    ruleId: "COMPASS-INVARIANT-05",
    contract: "invariant id … was previously retired — ids are never reused.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/compass/handlers/invariant-bindings.ts.",
    docRef: "packages/forge/os/compass/handlers/invariant-bindings.ts",
  },
  {
    ruleId: "COMPASS-INVARIANT-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/compass/handlers/invariant-bindings.ts.",
    docRef: "packages/forge/os/compass/handlers/invariant-bindings.ts",
  },
  {
    ruleId: "CONTENT-FORMAT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/checks/page-content.ts.",
    docRef: "packages/werkstatt-site/src/checks/checks/page-content.ts",
  },
  {
    ruleId: "CONTENT.ASSET.CONTRACT.VALIDATE",
    contract: "Validate RFC-0248 content asset resolver/validator parity, bare-filename token syntax, multi-domain lookup, and default-language fallback.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-asset-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-asset-contract.ts",
  },
  {
    ruleId: "CONTENT.SURFACE.VALIDATE",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-surface.ts",
  },
  {
    ruleId: "CONTRACT-00",
    contract: "… is missing — the site has no translation contract.",
    action: "Run translation.contract.scaffold to draft it, then review --approve.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "CONTRACT-01",
    contract: "The translation contract file is invalid — a term is duplicated, lists its canonical as forbidden, or fails the schema.",
    action: "Repair the contract — invalid evidence must never pass silently; curate the draft, then run translation.contract.review --approve.",
    docRef: "packages/werkstatt-site/src/checks/translation-contract.ts",
  },
  {
    ruleId: "CONTRACT-02",
    contract: "translation contract lifecycle is \"…\" — enforcement requires \"approved\".",
    action: "Curate the draft, then run translation.contract.review --approve.",
    docRef: "packages/werkstatt-site/src/checks/translation-contract.ts",
  },
  {
    ruleId: "CONTRACT-03",
    contract: "published locale \"…\" has no note.locales coverage.",
    action: "Add note.locales.… guidance ({} is a legal empty override) or unpublish the locale.",
    docRef: "packages/werkstatt-site/src/checks/translation-contract.ts",
  },
  {
    ruleId: "CONTRACT-04",
    contract: "modules.….terms \"…\" overrides … canonical.",
    action: "Rename the module term id or align the … canonical.",
    docRef: "packages/werkstatt-site/src/checks/translation-contract.ts",
  },
  {
    ruleId: "CORPUS-01",
    action: "run text.corpus.generate --site <id>.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/validate.ts",
  },
  {
    ruleId: "COSMIC-LIT-01",
    contract: "Cosmic-catalog name \"…\" (…) appears as a string literal — dispatch code must derive cosmic-name-keyed behavior from the archetype registry.",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "COVERAGE-01",
    contract: "docs/command-manifest.generated.yaml is missing — the command universe cannot be enumerated.",
    action: "Run: pnpm exec werkstatt run command.manifest.generate.",
    docRef: "packages/werkstatt-site/src/checks/ecosystem/command-coverage-validate.ts",
  },
  {
    ruleId: "COVERAGE-02",
    contract: "Command \"…\" declares coverage \"…\" but is mechanically reachable — the declaration is stale.",
    action: "Remove the coverage/coverageNote fields from the command definition (RFC-1243).",
    docRef: "packages/werkstatt-site/src/checks/ecosystem/command-coverage-validate.ts",
  },
  {
    ruleId: "COVERAGE-03",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/ecosystem/command-coverage-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/ecosystem/command-coverage-validate.ts",
  },
  {
    ruleId: "CRC-01",
    contract: "Every registered kernel command declares `reads` (non-empty) or `cacheable: false` (RFC-0390).",
    action: "Add `reads: [...]` with the file globs this command reads, or declare `cacheable: false` if the command depends on external state.",
    docRef: "packages/werkstatt-site/src/checks/command-reads-validate.ts",
  },
  {
    ruleId: "CRC-02",
    action: "Fix the glob pattern to be valid picomatch syntax.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "CRC-03",
    contract: "A cacheable command's `modulePath` resolves inside the bounded src/os module roots — otherwise the module hash falls back to a constant and the result cache never invalidates on module code changes (RFC-1193).",
    action: "Move the module under a `src/` or `os/` directory, or fix `modulePath` to point at the real module file.",
    docRef: "packages/werkstatt-site/src/checks/command-reads-validate.ts",
  },
  {
    ruleId: "CRC-04",
    contract: "A cacheable command declares `modulePath` — without it the module hash falls back to a constant (`unpatched`) and the result cache never invalidates on module code changes (RFC-1193).",
    action: "Add `modulePath` pointing at this command's module file.",
    docRef: "packages/werkstatt-site/src/checks/command-reads-validate.ts",
  },
  {
    ruleId: "CRC-05",
    contract: "Every declared modulePaths entry resolves to an existing path under dirname(modulePath) inside workspaceRoot (RFC-1194).",
    action: "Fix each path relative to the module file's directory, or remove dead entries.",
    docRef: "packages/werkstatt-site/src/checks/command-reads-validate.ts",
  },
  {
    ruleId: "CRC-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/command-reads-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/command-reads-validate.ts",
  },
  {
    ruleId: "CREG-02",
    contract: "Route '…' exists in current snapshot but not in golden.",
    action: "New route detected. Run: pnpm exec werkstatt run content.regression.review.generate --site <systemId>.",
    docRef: "packages/werkstatt-site/src/checks/content-regression.ts",
  },
  {
    ruleId: "CREG-06",
    contract: "Failed to update golden baseline during --auto-accept: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-regression.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-regression.ts",
  },
  {
    ruleId: "CREG-07",
    contract:
      "The site's systems-cache/{id}/system-config.yaml resolves and parses — the legacy systems/registry.yaml indirection is removed (RFC-1216).",
    action:
      "The system is not registered or its config is malformed — register it: `werkstatt run sternsystem.register --id <id> --cosmicStar <star> --mirrors \"../systems-cache/<id>:non-bare,...\"`.",
    docRef: "packages/werkstatt-site/src/checks/content-regression.ts",
  },
  {
    ruleId: "CSP-SINK-01",
    action: "First-party: refactor to createElement/textContent (never allowlisted). Third-party: wrap the sink via ttSafeTransform (minted tt* arg) or record a blessed / accepted-debt / failsafe entry in src/csp-sinks.allowlist.yaml with a note.",
    docRef: "packages/werkstatt-site/src/checks/csp-sinks.ts",
  },
  {
    ruleId: "CSP-SINK-02",
    contract: "A stale allowlist entry's filePattern matches no emitted file, or an entry lacks the required shape — allowlists decay toward empty.",
    action: "Remove or update the stale allowlist entry so the allowlist decays toward empty.",
    docRef: "packages/werkstatt-site/src/checks/csp-sinks.ts",
  },
  {
    ruleId: "CSP-TT-01",
    contract: "Emitted _headers carries Trusted Types directives while … enforcement-unsafe sink finding(s) exist — enforcement would throw TypeErrors in production.",
    action: "Re-run csp.hashes.generate (it withholds/strips TT directives on a dirty corpus) or remove the hand-edited directives.",
    docRef: "packages/werkstatt-site/src/checks/csp-sinks.ts",
  },
  {
    ruleId: "DATE-FMT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/date-format.ts.",
    docRef: "packages/werkstatt-site/src/checks/date-format.ts",
  },
  {
    ruleId: "DEDUP-01",
    contract: "Local re-declaration of reserved shared helper '…'.",
    action: "Import { … } from \"…\" instead of re-declaring it.",
    docRef: "packages/werkstatt-site/src/checks/dedup-helper-lint.ts",
  },
  {
    ruleId: "default-not-in-supported",
    contract: "i18n.default \"…\" not in supported: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/i18n-config-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/i18n-config-validate.ts",
  },
  {
    ruleId: "DELEG-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/authority/handlers/delegation-validate.ts.",
    docRef: "packages/forge/os/authority/handlers/delegation-validate.ts",
  },
  {
    ruleId: "DELEG-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/authority/handlers/delegation-validate.ts.",
    docRef: "packages/forge/os/authority/handlers/delegation-validate.ts",
  },
  {
    ruleId: "DELEG-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/authority/handlers/delegation-validate.ts.",
    docRef: "packages/forge/os/authority/handlers/delegation-validate.ts",
  },
  {
    ruleId: "DELEG-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/authority/handlers/delegation-validate.ts.",
    docRef: "packages/forge/os/authority/handlers/delegation-validate.ts",
  },
  {
    ruleId: "DELEG-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/authority/handlers/delegation-validate.ts.",
    docRef: "packages/forge/os/authority/handlers/delegation-validate.ts",
  },
  {
    ruleId: "DELEG-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/authority/handlers/delegation-validate.ts.",
    docRef: "packages/forge/os/authority/handlers/delegation-validate.ts",
  },
  {
    ruleId: "DELEG-07",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/authority/handlers/delegation-validate.ts.",
    docRef: "packages/forge/os/authority/handlers/delegation-validate.ts",
  },
  {
    ruleId: "DELEG-08",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/authority/handlers/delegation-validate.ts.",
    docRef: "packages/forge/os/authority/handlers/delegation-validate.ts",
  },
  {
    ruleId: "DEM-01",
    contract: "Demand signal fails schema: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "DEM-02",
    contract: "Demand signal query must be normalized lowercase: \"…\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "DEM-04",
    contract: "Duplicate demand query \"…\" for the same axis binding.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/surface-demand.ts.",
    docRef: "packages/werkstatt-site/src/checks/surface-demand.ts",
  },
  {
    ruleId: "DEM-05",
    contract: "Demand signal \"…\" is stale beyond 365 days.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "DEMANDS.HIERARCHY.VALIDATE",
    contract: "invalid-level: \"…\" (lang=…) — demand records must be at 1, 2, or 3 path segments below demands/{lang}/.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "DEP-01",
    contract: "RFC-0686: validate dependsOn fields in all standard pipelines — checks for missing references, forward references, duplicate command names, and circular dependencies.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/pipeline/pipeline-dependencies-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/pipeline/pipeline-dependencies-validate.ts",
  },
  {
    ruleId: "DEPLOY-SCRIPTS-01",
    contract: "Cannot read package.json for ….",
    action: "Ensure …/package.json exists and is valid JSON.",
    docRef: "packages/werkstatt-site/src/checks/env/env-contract.ts",
  },
  {
    ruleId: "DEPLOY-SCRIPTS-02",
    contract: "Missing required deploy script \"…\" in …/package.json (RFC-0388 Rule 6).",
    action: "Add \"…\" to the scripts section. See packages/werkstatt-site/src/onboarding/templates/package.template.json for the canonical shape.",
    docRef: "packages/werkstatt-site/src/checks/env/env-contract.ts",
  },
  {
    ruleId: "DEPS-VERSION-01",
    contract: "External dependency '…@…' does not resolve on npm: …",
    action: "Check the published versions: pnpm view … versions. Then update the version in packages/werkstatt-site/src/onboarding/workpiece-dependencies.ts.",
    docRef: "packages/werkstatt-site/src/checks/workpiece-deps-validate.ts",
  },
  {
    ruleId: "DIST-ASSET-01",
    contract: "missing asset: \"…\" → … (referenced from …, …)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/dist-asset-integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/dist-asset-integrity.ts",
  },
  {
    ruleId: "DIST-ASSET-02",
    contract: "asset-integrity.allowlist.yaml patterns[…] (\"…\") requires a reason.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/dist-asset-integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/dist-asset-integrity.ts",
  },
  {
    ruleId: "DIST-ASSET-03",
    contract: "dist absent for … — nothing to validate (run build first)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/dist-asset-integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/dist-asset-integrity.ts",
  },
  {
    ruleId: "DIST-ASSET-04",
    contract: "[allowlisted] … → … (…)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/dist-asset-integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/dist-asset-integrity.ts",
  },
  {
    ruleId: "DIST-LEAK-06",
    action: "Resolve markers in the component/projection that renders this field (see RFC-1288); never ship authoring syntax.",
    docRef: "packages/werkstatt-site/src/checks/dist-serialization-leakage.ts",
  },
  {
    ruleId: "DIST-LEAK-07",
    action: "Resolve markers in the component/projection that renders this field (see RFC-1288); never ship authoring syntax.",
    docRef: "packages/werkstatt-site/src/checks/dist-serialization-leakage.ts",
  },
  {
    ruleId: "DIST-LEAK-08",
    action: "Resolve markers in the component/projection that renders this field (see RFC-1288); never ship authoring syntax.",
    docRef: "packages/werkstatt-site/src/checks/dist-serialization-leakage.ts",
  },
  {
    ruleId: "DIST-LEAK-09",
    action: "Resolve markers in the component/projection that renders this field (see RFC-1288); never ship authoring syntax.",
    docRef: "packages/werkstatt-site/src/checks/dist-serialization-leakage.ts",
  },
  {
    ruleId: "DIST-LEAK-10",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/dist-serialization-leakage.ts.",
    docRef: "packages/werkstatt-site/src/checks/dist-serialization-leakage.ts",
  },
  {
    ruleId: "DOC-CMD-01",
    contract: "Implements command.docs.lint (RFC-1313) — documented shell-shaped kernel invocations must parse against the live command registry.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/command-docs-lint.ts.",
    docRef: "packages/werkstatt-site/src/checks/command-docs-lint.ts",
  },
  {
    ruleId: "DOC-CMD-02",
    contract: "Implements command.docs.lint (RFC-1313) — documented shell-shaped kernel invocations must parse against the live command registry.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/command-docs-lint.ts.",
    docRef: "packages/werkstatt-site/src/checks/command-docs-lint.ts",
  },
  {
    ruleId: "DOC-CMD-04",
    contract: "Implements command.docs.lint (RFC-1313) — documented shell-shaped kernel invocations must parse against the live command registry.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/command-docs-lint.ts.",
    docRef: "packages/werkstatt-site/src/checks/command-docs-lint.ts",
  },
  {
    ruleId: "DRIFT-01",
    contract: "Committed file \"…\" differs from generator \"…\" output.",
    action: "Re-run: pnpm exec werkstatt run … --site …",
    docRef: "packages/werkstatt-site/src/checks/generated-drift-validate.ts",
  },
  {
    ruleId: "DRIFT-02",
    contract: "Generator \"…\" does not support dryRun mode or did not render a declared key in dryRun output; cannot verify determinism.",
    action: "Add dryRun support to the generator, or declare the rendered key it actually produces.",
    docRef: "packages/werkstatt-site/src/checks/generated-drift-validate.ts",
  },
  {
    ruleId: "DRIFT-03",
    contract: "Invalid --target value \"…\". Expected \"workpiece\", \"cache-clone\", or \"workspace\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/generated-drift-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/generated-drift-validate.ts",
  },
  {
    ruleId: "DRIFT-04",
    contract: "Generated artifact \"…\" owned by \"…\" is missing on disk or not committed.",
    action: "Re-run: pnpm exec werkstatt run …",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "DRIFT-05",
    contract: "Generator \"…\" modified \"…\" during dryRun — migrate its write path to context.io.",
    action: "Route the generator's write through context.io and return renderedFiles under dryRun.",
    docRef: "packages/werkstatt-site/src/checks/generated-drift-validate.ts",
  },
  {
    ruleId: "DSL-01",
    contract: "Could not read checks/src/: …",
    action: "Ensure packages/werkstatt-site/src/checks/ exists and is readable.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "DSL-02",
    contract: "ruleId \"…\" is not registered in diagnostics/rules.ts.",
    action: "Add the ruleId to DIAGNOSTIC_RULES in packages/werkstatt-site/src/checks/diagnostics/rules.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "DSL-03",
    contract: "Empty ruleId literal in a migrated check.",
    action: "Provide a non-empty, registered ruleId from diagnostics/rules.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostic-shape-lint.ts",
  },
  {
    ruleId: "DSL-04",
    contract: "resultFromViolations/failResult (string shim) used outside the shrink-only baseline.",
    action: "Migrate … to diagnosticsResult with registered, fine-grained ruleIds and locators, or (if this is a pre-existing module) run diagnostic.shape.lint --write-baseline after confirming the migration queue accepted it.",
    docRef: "packages/werkstatt-site/src/checks/diagnostic-shape-lint.ts",
  },
  {
    ruleId: "duplicate-hreflang",
    contract: "Duplicate hreflang values in i18n.supported.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/content/i18n-config.ts.",
    docRef: "packages/werkstatt-site/src/content/i18n-config.ts",
  },
  {
    ruleId: "duplicate-tag",
    contract: "Duplicate tag values in i18n.supported.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/content/i18n-config.ts.",
    docRef: "packages/werkstatt-site/src/content/i18n-config.ts",
  },
  {
    ruleId: "EFF-CONTRACT-01",
    contract: "… — […] effects[…]…: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/effects-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/effects-contract.ts",
  },
  {
    ruleId: "EFF-PARITY-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "EFF-PARITY-02",
    contract: "Every effectsParity: strict section instance carries the sibling-majority effect signature — a divergent instance is a parity violation.",
    action: "Align the section instance's effect props with the sibling-majority signature.",
    docRef: "packages/werkstatt-site/src/checks/effects-contract.ts",
  },
  {
    ruleId: "ENV-CONTRACT-01",
    contract: "The site's .env.example exists and is produced by env.example.generate — a missing or drifted example is a contract violation.",
    action: "Run: pnpm exec werkstatt run env.example.generate --site.",
    docRef: "packages/werkstatt-site/src/checks/env/env-contract.ts",
  },
  {
    ruleId: "ENV-CONTRACT-03",
    contract: "README contains an env-variable table or listing. Replace with a reference to .env.example (RFC-0388 Rule 2).",
    action: "Replace the table with: See [.env.example](./.env.example) for all required and optional environment variables.",
    docRef: "packages/werkstatt-site/src/checks/env/env-contract.ts",
  },
  {
    ruleId: "ENV-CONTRACT-06",
    contract: "Variable \"…\" is commented out. All variables in .env.example must be uncommented — use a comment line above for documentation, not a # prefix on the KEY= line (RFC-0388 Rule 3).",
    action: "Uncomment the line: remove the \"# \" prefix from …=.",
    docRef: "packages/werkstatt-site/src/checks/env/env-contract.ts",
  },
  {
    ruleId: "ENV-INPUT-01",
    contract: "Command \"…\" reads process.env.… (reachable from execute()) without declaring it in envInputs.",
    action: "Add the env var name to the command's envInputs declaration.",
    docRef: "packages/werkstatt-site/src/checks/command-manifest-validate.ts",
  },
  {
    ruleId: "ENV-INPUT-02",
    contract: "Command \"…\" env scan is incomplete (…) — undeclared env reads may escape detection.",
    action: "Reduce reachability depth in \"…\" (extract helpers to direct imports) or declare envInputs explicitly; see RFC-1303.",
    docRef: "packages/werkstatt-site/src/checks/command-manifest-validate.ts",
  },
  {
    ruleId: "ESC-01",
    contract: "… escalation budget is exhausted.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/pseo/pseo-governance.ts.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-governance.ts",
  },
  {
    ruleId: "ESC-02",
    contract: "… was resolved without feedback.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts",
  },
  {
    ruleId: "ESC-03",
    contract: "… human-minutes per 1000 pages is not yet near zero — the escalation budget target is unmet.",
    action: "Reduce human-minutes per 1000 pages toward the near-zero target.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-governance.ts",
  },
  {
    ruleId: "ESC-05",
    contract: "Escalation is malformed or carries an unsafe payload.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts",
  },
  {
    ruleId: "EXEC-EXITCODE-01",
    contract: "io.exec exit code unobserved (…: …) — a failed subprocess masquerades as success.",
    action: "Check result.exitCode, or wrap the call in execOrThrow from @warpgogol/werkstatt-shared/kernel (allowExitCodes for signal semantics). Signal-semantics sites go in SIGNAL_SEMANTICS_ALLOWLIST with a justification (RFC-1159, DNA-106).",
    docRef: "packages/werkstatt-site/src/checks/exec-exitcode-lint.ts",
  },
  {
    ruleId: "EXPORTS-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/package-exports.ts.",
    docRef: "packages/werkstatt-site/src/checks/package-exports.ts",
  },
  {
    ruleId: "FAB-01",
    action: "Do not hand-write files a platform command owns — fix the owning command. Writes are allowed only inside `// FAB-SEAM-BEGIN: intake-staging|compose` regions and only to that seam's declared base variable.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "FAC-01",
    contract: "Fleet agent catalog not found. Run fleet.agent.catalog.generate first.",
    action: "Run: pnpm exec werkstatt run fleet.agent.catalog.generate.",
    docRef: "packages/werkstatt-site/src/checks/fleet-agent-catalog.ts",
  },
  {
    ruleId: "FAC-02",
    contract: "Fleet sites file is malformed: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/fleet-agent-catalog.ts.",
    docRef: "packages/werkstatt-site/src/checks/fleet-agent-catalog.ts",
  },
  {
    ruleId: "FAC-03",
    contract: "Duplicate baseUrl \"…\" across sites: ….",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/fleet-agent-catalog.ts.",
    docRef: "packages/werkstatt-site/src/checks/fleet-agent-catalog.ts",
  },
  {
    ruleId: "FAC-04",
    contract: "Site \"…\" surface is unsigned while at least one fleet site is signed — posture drift.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/fleet-agent-catalog.ts.",
    docRef: "packages/werkstatt-site/src/checks/fleet-agent-catalog.ts",
  },
  {
    ruleId: "FACT-PARITY-01",
    contract: "Canonical price '…' is missing from all rendered surfaces.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/semantic-fact-parity.ts.",
    docRef: "packages/werkstatt-site/src/checks/semantic-fact-parity.ts",
  },
  {
    ruleId: "FACT-PARITY-02",
    contract: "Canonical fact type '…' is absent from all rendered surfaces.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/semantic-fact-parity.ts.",
    docRef: "packages/werkstatt-site/src/checks/semantic-fact-parity.ts",
  },
  {
    ruleId: "FAMILY-Q-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/family.ts.",
    docRef: "packages/werkstatt-site/src/checks/family.ts",
  },
  {
    ruleId: "FONTS-SCRIPT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/fonts.ts.",
    docRef: "packages/werkstatt-site/src/checks/fonts.ts",
  },
  {
    ruleId: "FONTS-SCRIPT-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/fonts.ts.",
    docRef: "packages/werkstatt-site/src/checks/fonts.ts",
  },
  {
    ruleId: "FORM-INFRA-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/form-submit-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/form-submit-check.ts",
  },
  {
    ruleId: "FORM-SUBMIT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/form-submit-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/form-submit-check.ts",
  },
  {
    ruleId: "FORM-SUBMIT-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/form-submit-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/form-submit-check.ts",
  },
  {
    ruleId: "FORM-SUBMIT-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/form-submit-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/form-submit-check.ts",
  },
  {
    ruleId: "FORM-SUBMIT-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/form-submit-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/form-submit-check.ts",
  },
  {
    ruleId: "FORM-SUBMIT-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/form-submit-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/form-submit-check.ts",
  },
  {
    ruleId: "FP-FIXTURE-01",
    contract: "The normalizer must strip comments and formatting whitespace.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/fingerprint-commands.ts.",
    docRef: "packages/werkstatt-site/src/checks/fingerprint-commands.ts",
  },
  {
    ruleId: "FP-FIXTURE-02",
    contract: "Meaningful change did not alter semantic hash.",
    action: "The normalizer must detect this change type.",
    docRef: "packages/werkstatt-site/src/checks/fingerprint-commands.ts",
  },
  {
    ruleId: "FP-FIXTURE-03",
    contract: "Binary byte changes did not alter byte hash.",
    action: "byteHash must produce different hashes for different bytes.",
    docRef: "packages/werkstatt-site/src/checks/fingerprint-commands.ts",
  },
  {
    ruleId: "FP-FIXTURE-04",
    contract: "Fixture files required by the fingerprint check failed to read.",
    action: "Ensure fixture files exist in packages/werkstatt-engine/src/fingerprint/tests/fixtures/.",
    docRef: "packages/werkstatt-site/src/checks/fingerprint-commands.ts",
  },
  {
    ruleId: "FP-USAGE-01",
    contract: "Direct hash usage detected (…). Use @warpgogol/fingerprint instead, or add an allowlist entry with a reason.",
    action: "Import byteHash/stableJsonHash/fingerprintFile from @warpgogol/werkstatt-engine/fingerprint, or add an entry to packages/werkstatt-engine/src/fingerprint/allowlist.json with a reason.",
    docRef: "packages/werkstatt-site/src/checks/fingerprint-commands.ts",
  },
  {
    ruleId: "FRESHNESS-01",
    contract: "Evidence source '…' technical assessment is stale: observed … days ago, max age is … days.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/semantic-freshness.ts.",
    docRef: "packages/werkstatt-site/src/checks/semantic-freshness.ts",
  },
  {
    ruleId: "FRESHNESS-02",
    contract: "Evidence source '…' item '…' is stale: retrieved … days ago, default max age is … days.",
    action: "Refresh the stale evidence item or raise its declared maxAgeDays.",
    docRef: "packages/werkstatt-site/src/checks/semantic-freshness.ts",
  },
  {
    ruleId: "FRESHNESS-03",
    contract: "Claim '…' (verification level …) is backed by stale evidence source '…'.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/semantic-freshness.ts.",
    docRef: "packages/werkstatt-site/src/checks/semantic-freshness.ts",
  },
  {
    ruleId: "FRICTION-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/friction/types.ts.",
    docRef: "packages/forge/os/friction/types.ts",
  },
  {
    ruleId: "FRICTION-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/friction/types.ts.",
    docRef: "packages/forge/os/friction/types.ts",
  },
  {
    ruleId: "FRICTION-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/friction/types.ts.",
    docRef: "packages/forge/os/friction/types.ts",
  },
  {
    ruleId: "FRICTION-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/friction/types.ts.",
    docRef: "packages/forge/os/friction/types.ts",
  },
  {
    ruleId: "FRICTION-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/friction/types.ts.",
    docRef: "packages/forge/os/friction/types.ts",
  },
  {
    ruleId: "FRICTION-06",
    contract: "Entry … is addressed on a docs-only measure yet its signature recurred … times — the documented rule did not bind.",
    action: "Flip the entry to status: escalated and name the mechanical obligation in its measure.",
    docRef: "packages/forge/os/friction/handlers/friction-validate.ts",
  },
  {
    ruleId: "FRICTION-07",
    contract: "Entry … is addressed but carries no measureKind — classification debt.",
    action: "Declare the measure's class via measureKind from the closed enum.",
    docRef: "packages/forge/os/friction/handlers/friction-validate.ts",
  },
  {
    ruleId: "FRICTION-08",
    contract: "Entry … is escalated but its measure names no mechanical obligation (RFC/ADR id, docs/queues item, repo path, or backticked command token).",
    action: "Amend the entry's measure to name the mechanism that will land — an RFC/ADR id, queue item, repo path, or backticked command token.",
    docRef: "packages/forge/os/friction/handlers/friction-validate.ts",
  },
  {
    ruleId: "GATE-03",
    contract: "Page \"…\" has parentPageId \"…\" which is gated from production. Remove the parent reference or ungate the parent page.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/deployment-gate.ts.",
    docRef: "packages/werkstatt-site/src/checks/deployment-gate.ts",
  },
  {
    ruleId: "GATE-CAT-01",
    contract: "… is missing.",
    action: "Run gate.catalog.generate.",
    docRef: "packages/werkstatt-site/src/checks/gate-catalog.ts",
  },
  {
    ruleId: "GATE-CAT-02",
    contract: "… drifted from live command registrations.",
    action: "Run gate.catalog.generate.",
    docRef: "packages/werkstatt-site/src/checks/gate-catalog.ts",
  },
  {
    ruleId: "GATE-CAT-03",
    contract: "Command `…` appears in validation pipeline(s) […] but lacks gate metadata.",
    action: "Add gate metadata to the command definition (RFC-0518).",
    docRef: "packages/werkstatt-site/src/checks/gate-catalog.ts",
  },
  {
    ruleId: "GEN-DRIFT-01",
    contract: "GEN-DRIFT-01: command \"…\" has … call targeting \"…\" but no matching generates declaration.",
    action: "Add a generates entry to \"…\" covering \"…\", or remove the write call if it is unintended.",
    docRef: "packages/werkstatt-site/src/checks/ownership-drift-validate.ts",
  },
  {
    ruleId: "GENERATES-MISSING",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/command-manifest-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/command-manifest-validate.ts",
  },
  {
    ruleId: "GENERATES-PATH-COLLISION",
    contract: "A non-glob generated path is claimed by exactly one command — generated file ownership must be unique.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/runtime/validate-declarations.ts.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "GENERATOR-EXEMPT-MISSING",
    contract: "A command with a .generate suffix and empty generates[] must be listed in GENERATOR_OWNERSHIP_EXEMPT with a reason.",
    action: "Add the command to GENERATOR_OWNERSHIP_EXEMPT with a reason, or declare its actual generates entries.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "GENERATOR-EXEMPT-STALE",
    contract: "Every GENERATOR_OWNERSHIP_EXEMPT entry names a registered command — no stale exemptions.",
    action: "Remove the stale entry or rename it to the command's current registered name.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "GITATTR-01",
    contract: ".gitattributes is missing.",
    action: "Run: pnpm exec werkstatt run gitattributes.generate.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "GRAM-01",
    action: "Suggested: … — fix the content source of this segment.",
    docRef: "packages/werkstatt-shared/src/kernel/diagnostic-cap.ts",
  },
  {
    ruleId: "GRAM-03",
    contract: "LANGUAGETOOL_URL is configured but .author/grammar.yaml is missing — a configured server with no config is a setup error.",
    action: "Create .author/grammar.yaml (werkstatt/grammar-config@1) — RFC-1292.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/grammar.ts",
  },
  {
    ruleId: "GRAM-04",
    contract: "LanguageTool unreachable or failed: …",
    action: "Check the local server (docs/runbooks/languagetool.md) or unset LANGUAGETOOL_URL.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/grammar.ts",
  },
  {
    ruleId: "HANDOVER-01",
    contract: "pending handover — missions blocked; run sternsystem.handover.complete or sternsystem.handover.cancel.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/sternsystem/sternsystem-validate.ts.",
    docRef: "packages/werkstatt-engine/src/sternsystem/sternsystem-validate.ts",
  },
  {
    ruleId: "HDR-03",
    contract: "Markdown twin pattern /*.md must set Content-Type: text/markdown; charset=utf-8.",
    action: "Add the /*.md section with text/markdown content type to _headers.",
    docRef: "packages/werkstatt-site/src/checks/public-surface/security.ts",
  },
  {
    ruleId: "HDR-07",
    contract: "_headers /* block must contain Link header pointing to /.well-known/agent.json when agent.enabled !== false.",
    action: "Rerun public.infrastructure.generate.",
    docRef: "packages/werkstatt-site/src/checks/public-surface/security.ts",
  },
  {
    ruleId: "HDR-08",
    contract: "_headers path pattern \"…\" contains … wildcards — Cloudflare allows at most one per rule and skips the rule entirely.",
    action: "Replace extra wildcards with named placeholders (e.g. /:lang/…) so the pattern keeps a single `*`.",
    docRef: "packages/werkstatt-site/src/checks/public-surface/security.ts",
  },
  {
    ruleId: "HDR-COV-01",
    contract: "Path pattern … matches no files in dist/client/.",
    action: "Remove orphan path pattern or add files matching it.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "HDR-COV-02",
    contract: "File … has no matching _headers path pattern — will be served without explicit Cache-Control.",
    action: "Add a path pattern for *… files to public/_headers with appropriate Cache-Control.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "HDRI-01",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/hdri-firewall.ts.",
    docRef: "packages/werkstatt-site/src/checks/hdri-firewall.ts",
  },
  {
    ruleId: "HDRI-02",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/hdri-firewall.ts.",
    docRef: "packages/werkstatt-site/src/checks/hdri-firewall.ts",
  },
  {
    ruleId: "HOST-01",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "I18N-DEFAULT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-pbp.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-pbp.ts",
  },
  {
    ruleId: "ICON-REF-01",
    contract: "Icon '…' (…/…) does not exist in generated icon components.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/icon-references.ts.",
    docRef: "packages/werkstatt-site/src/checks/icon-references.ts",
  },
  {
    ruleId: "ICON-REF-03",
    contract: "Malformed VendorIconConfig — missing field(s): ….",
    action: "Add the missing field(s) (vendor, collection, name) to the icon config at …:…. A valid icon config looks like: { vendor: lordicon, collection: doodle-outline, name: FlagHover }.",
    docRef: "packages/werkstatt-site/src/checks/icon-references.ts",
  },
  {
    ruleId: "IDEMP-01",
    contract: "A mutating lifecycle/provisioning command declares `idempotency` (RFC-1327).",
    action: "Add `idempotency: \"rerun-safe\" | \"resume-only\" | \"not-idempotent\"` to the command's declaration.",
    docRef: "packages/werkstatt-site/src/checks/command/idempotency-validate.ts",
  },
  {
    ruleId: "IDEMP-02",
    action: "Add a run-twice test using expectRerunSafe from @warpgogol/werkstatt-engine testing/run-twice.ts, or downgrade the declaration.",
    docRef: "packages/werkstatt-site/src/checks/command/idempotency-validate.ts",
  },
  {
    ruleId: "IDEMP-03",
    action: "Add `idempotencyNote` describing what a second run repeats or breaks.",
    docRef: "packages/werkstatt-site/src/checks/command/idempotency-validate.ts",
  },
  {
    ruleId: "IMG-BASENAME-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/image-variants.ts.",
    docRef: "packages/werkstatt-site/src/checks/image-variants.ts",
  },
  {
    ruleId: "IMG-VARIANT-SRC-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/image-variants.ts.",
    docRef: "packages/werkstatt-site/src/checks/image-variants.ts",
  },
  {
    ruleId: "IMG-VARIANT-SRC-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/image-variants.ts.",
    docRef: "packages/werkstatt-site/src/checks/image-variants.ts",
  },
  {
    ruleId: "IMPORT-RESOLVE-01",
    contract: "Package '…' is not a workspace package under packages/ or services/.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/package-imports-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/package-imports-validate.ts",
  },
  {
    ruleId: "IMPORT-RESOLVE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "INTAKE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-07",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-08",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-09",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-10",
    contract: "intake.schema.generated.yaml is absent from the installed @warpgogol/werkstatt-shared package — run `onboarding.intake.schema.export` first",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-11",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-12",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-13",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-14",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-15",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-16",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-17",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-18",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-19",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-20",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-21",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-22",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-23",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-24",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-25",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-26",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-27",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-28",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-29",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-30",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-31",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-32",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "INTAKE-33",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/intake/intake-validate.ts.",
    docRef: "packages/werkstatt-engine/src/intake/intake-validate.ts",
  },
  {
    ruleId: "invalid-i18n-config",
    contract: "Duplicate tag values in i18n.supported.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/content/i18n-config.ts.",
    docRef: "packages/werkstatt-site/src/content/i18n-config.ts",
  },
  {
    ruleId: "JRN-01",
    contract: "operations/…: op-started '…' (…) has empty missionId — cache-clone journal ops must be mission-attributed (ADR-0088)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/sternsystem/sternsystem-validate.ts.",
    docRef: "packages/werkstatt-engine/src/sternsystem/sternsystem-validate.ts",
  },
  {
    ruleId: "JSONLD-PRESENCE-01",
    action: "Keep a single semantic @graph doc per page — merge secondary graph docs into the main emission.",
    docRef: "packages/werkstatt-site/src/checks/jsonld-presence.ts",
  },
  {
    ruleId: "JSONLD-PRESENCE-02",
    contract: "Rendered page embeds no semantic JSON-LD graph; expected ….",
    action: "The build captured a graph for this route but the HTML lacks one — check StructuredData emission in the layout.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "JSONLD-PRESENCE-03",
    contract: "Embedded JSON-LD @graph diverges from the build-captured model for ….",
    action: "The captured graph and the embedded graph were produced by the same buildJsonLd call — divergence means the HTML was transformed post-emit or the files are stale; rebuild the site.",
    docRef: "packages/werkstatt-site/src/checks/jsonld-presence.ts",
  },
  {
    ruleId: "JSONLD-PRESENCE-04",
    contract: "Every indexable page emits a semantic @graph doc — a page with no graph must be intentionally non-indexable.",
    action: "If this page is intentionally non-indexable, ensure it emits no graph; otherwise investigate why the build capture lacks it.",
    docRef: "packages/werkstatt-site/src/checks/jsonld-presence.ts",
  },
  {
    ruleId: "KEL-00",
    contract: "Could not read site-kernel-checks/src/: …",
    action: "Ensure packages/os/site-kernel-checks/src/ exists and is readable.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "KEL-01",
    contract: "Flat result shape detected — `return { command, status, violations }` bypasses kernel exit-code propagation.",
    action: "Wrap the return using passResult / failResult / resultFromViolations — or diagnosticsResult. Add `// envelope-ok` to suppress an intentional exception.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "KERNEL-FLAG-04",
    contract: "… reads input.flags.…, which is not declared in its flags schema.",
    action: "Add \"…\" to the flags schema for … in its registerCommand() call, or stop reading it.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "KERNEL-FLAG-05",
    action: "Declare a flags schema for … (RFC-0260), then regenerate the baseline with --write-baseline.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "KERNEL-FLAG-06",
    contract: "… declares --… as required but the description does not mention \"…\".",
    action: "Add \"…\" to the description of … in its registerCommand() call.",
    docRef: "packages/werkstatt-site/src/checks/kernel-flags-lint.ts",
  },
  {
    ruleId: "KERNEL-FLAG-07",
    contract: "… calls …(), which reads input.flags.…, but \"…\" is not declared in its flags schema.",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "KERNEL-FLAG-08",
    contract: "… resolves to … flag-reading definitions with divergent signatures; call site skipped — add a FLAG_READING_HELPERS override to pin one.",
    action: "Add an override entry for … in FLAG_READING_HELPERS, or rename the local function.",
    docRef: "packages/werkstatt-site/src/checks/kernel-flags-lint.ts",
  },
  {
    ruleId: "KERNEL-FLAG-09",
    contract: "… declares an \"all\" flag but acceptsAllFlag is not true — --all is consumed as the kernel site selector and rejected by the gate, so the flag is unreachable via werkstatt run.",
    action: "Set acceptsAllFlag: true on the command or remove the \"all\" flag declaration.",
    docRef: "packages/werkstatt-site/src/checks/kernel-flags-lint.ts",
  },
  {
    ruleId: "KERNEL-FLAG-10",
    contract: "A handler resolves dry-run via `context.dryRun` — `consumeCommonFlags` strips `--dry-run` from input.flags before dispatch, so reading `flags[\"dry-run\"]` alone never sees it (RFC-1237).",
    action: "Resolve dry-run as `context.dryRun === true || input.flags[\"dry-run\"] === true` — consumeCommonFlags strips --dry-run into context.dryRun before dispatch (RFC-1237).",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "LABELS-HEADING-01",
    contract: "No site/ directory at …; nothing to check.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/labels-heading-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/labels-heading-validate.ts",
  },
  {
    ruleId: "LABELS-SCHEMA-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/labels-schema-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/labels-schema-validate.ts",
  },
  {
    ruleId: "LABELS-SCHEMA-02",
    contract: "Cannot load system.md under …; required-block checks skipped.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "LABELS-SCHEMA-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "LABELS-SCHEMA-04",
    contract: "footer: \"backgroundImage\" is deprecated — author footer.background.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "LABELS-SCHEMA-REPAIR-01",
    contract: "… repaired … — …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/labels-schema-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/labels-schema-validate.ts",
  },
  {
    ruleId: "LAYER-ORDER-01",
    contract: "Blocking post-build gate (RFC-1434/DNA-117): every emitted CSS cascade unit (stylesheet or <style>) must declare the canonical @layer order before any layered rule targeting a declared layer.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/lib/css-layer-order.ts.",
    docRef: "packages/werkstatt-site/src/checks/lib/css-layer-order.ts",
  },
  {
    ruleId: "LAYER-ORDER-03",
    contract: "Blocking post-build gate (RFC-1434/DNA-117): every emitted CSS cascade unit (stylesheet or <style>) must declare the canonical @layer order before any layered rule targeting a declared layer.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/lib/css-layer-order.ts.",
    docRef: "packages/werkstatt-site/src/checks/lib/css-layer-order.ts",
  },
  {
    ruleId: "LEAK-ID-01",
    contract: "…: internal identifier rendered as visible text — …",
    action: "Replace the identifier with visitor-facing copy in the source file — never edit dist output.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/leaks.ts",
  },
  {
    ruleId: "LEGAL-CITE-01",
    contract: "obsolete statute citation \"…\" — the current statute is \"…\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LEGAL-FOOTER-01",
    contract: "footer.legal.identityPanel is enabled (locale(s) […]) but the resolved legal identity fields would suppress the panel at render (absent or NEED_THIS_* placeholder).",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LEGAL-FOOTER-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LEGAL-FOOTER-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LEGAL-JUR-01",
    contract: "legalJurisdiction \"…\" requires ….md for supported locale \"…\" — run legal.scaffold.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LEGAL-JUR-02",
    contract: "legalJurisdiction \"…\" requires identity.legal.… populated.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LEGAL-JUR-03",
    contract: "legalJurisdiction \"…\" binds legal documents to \"…\" — fix translation.binding or legalJurisdiction.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LEGAL-JUR-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LEGAL-STALE-01",
    contract: "Implements legal.translation.validate — enforces the RFC-0174 binding-language policy for legal documents.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/legal-translation.ts.",
    docRef: "packages/werkstatt-site/src/checks/legal-translation.ts",
  },
  {
    ruleId: "LINK-01",
    contract: "Anchor \"…\" not found on page \"…\" for lang \"…\". Add an id to a block on this page, or add a matching prose heading.",
    action: "Anchor \"…\" not found on page \"…\". Add \"id: …\" to the target block on this page, or add a matching heading in the prose file, or fix the anchor text.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "LINK-02",
    contract: "Same-page anchor must not carry path prefix. Use \"…\" instead of \"…\".",
    action: "Same-page anchor must not carry a path or language prefix. Use \"…\" instead of \"…\".",
    docRef: "packages/werkstatt-site/src/checks/content-links.ts",
  },
  {
    ruleId: "LINK-03",
    contract: "Internal path \"…\" does not resolve to a known route.",
    action: "Internal path \"…\" does not resolve to a known route. Check the route map in system.md or remove the link.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "LIVE-01",
    contract: "…: live release … ≠ recorded … — an out-of-band deploy or rollback happened.",
    action: "Reconcile the release record with live state — re-run the ship/deploy path or record the out-of-band change in the journal.",
    docRef: "packages/werkstatt-engine/src/sternsystem/live-drift.ts",
  },
  {
    ruleId: "LIVE-02",
    contract: "…: live release probe inconclusive for … — …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/sternsystem/live-drift.ts.",
    docRef: "packages/werkstatt-engine/src/sternsystem/live-drift.ts",
  },
  {
    ruleId: "LOCALFACT-01",
    contract: "External local fact lacks … — record the page-level source URL and a verbatim excerpt.",
    action: "Copy the exact sentence(s) stating the fact into `excerpt` and set `sourceUrl` to that page, or drop the fact.",
    docRef: "packages/werkstatt-site/src/checks/lib/local-facts.ts",
  },
  {
    ruleId: "LOCALFACT-02",
    contract: "sourceUrl host … is outside descriptor endpoint host ….",
    action: "Point sourceUrl at the descriptor's endpoint host (a subdomain is allowed), or register a descriptor for that source.",
    docRef: "packages/werkstatt-site/src/checks/lib/local-facts.ts",
  },
  {
    ruleId: "LOCALFACT-03",
    contract: "Number(s) … in the fact text do not occur in the recorded excerpt.",
    action: "Quote the source passage that contains the number verbatim, or correct the fact text — never loosen the check.",
    docRef: "packages/werkstatt-site/src/checks/lib/local-facts.ts",
  },
  {
    ruleId: "LP-01",
    action: "Add a period, question mark, or exclamation mark at the end of the text, or start with a lowercase letter if it is not a full sentence.",
    docRef: "packages/werkstatt-site/src/checks/list-punctuation.ts",
  },
  {
    ruleId: "LP-02",
    contract: "List item starts with a lowercase letter but ends with punctuation.",
    action: "Remove the trailing punctuation, or start with an uppercase letter and end with a period if it is a full sentence.",
    docRef: "packages/werkstatt-site/src/checks/list-punctuation.ts",
  },
  {
    ruleId: "LP-03",
    contract: "List item does not end with sentence-ending punctuation (. ? !) but another item in the same list does. All items in this list should end with sentence-ending punctuation.",
    action: "Add a period, question mark, or exclamation mark at the end of the text to match the punctuation style of the other items in this list.",
    docRef: "packages/werkstatt-site/src/checks/list-punctuation.ts",
  },
  {
    ruleId: "MATERIAL.CREDITS.ATTRIBUTION-POLICY-LANG-SKEW",
    action: "Keep the site attribution policy block aligned across localized site labels.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "MATERIAL.CREDITS.INTERNAL-PATH-LEAK",
    contract: "Implements material.credits.public-text.validate — read-only public-text hygiene gate for the generated prose/{lang}/credits.md page.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/material-credits-public-text.ts.",
    docRef: "packages/werkstatt-site/src/checks/material-credits-public-text.ts",
  },
  {
    ruleId: "MATERIAL.CREDITS.MISSING-PROSE-CREDIT",
    contract: "Prose \"…\" has no authorship credit sidecar.",
    action: "Add a sibling material credit sidecar for the prose record, or document why this prose is generated/owned elsewhere before suppressing the warning.",
    docRef: "packages/werkstatt-site/src/checks/material-credits.ts",
  },
  {
    ruleId: "MATERIAL.CREDITS.NEEDS-REVIEW-STATUS",
    contract: "Credit record \"…\" needs review.",
    action: "Review the credit record and update status to active once verified.",
    docRef: "packages/werkstatt-site/src/checks/material-credits.ts",
  },
  {
    ruleId: "MATERIAL.CREDITS.ORPHANED-STATUS",
    contract: "Credit record \"…\" is orphaned.",
    action: "Review whether this credit is still needed or should be removed.",
    docRef: "packages/werkstatt-site/src/checks/material-credits.ts",
  },
  {
    ruleId: "MATERIAL.CREDITS.PAGE-HIDDEN-REFERENCED",
    contract: "Credit record \"…\" is hidden from the credits page while its asset is referenced editorially.",
    action: "Unhide the credit on the credits page, remove the editorial reference, or mark it intentionally hidden — a placeholder credit needs no action.",
    docRef: "packages/werkstatt-site/src/checks/material-credits.ts",
  },
  {
    ruleId: "MATERIAL.CREDITS.RAW-ENUM-LEAK",
    contract: "Implements material.credits.public-text.validate — read-only public-text hygiene gate for the generated prose/{lang}/credits.md page.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/material-credits-public-text.ts.",
    docRef: "packages/werkstatt-site/src/checks/material-credits-public-text.ts",
  },
  {
    ruleId: "MATERIAL.METADATA.TOOLCHAIN-MISSING",
    contract: "Embedded metadata validation skipped because exiftool is not available.",
    action: "Install exiftool when embedded material metadata validation is required.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-01",
    contract: "Maintenance debt queue YAML is malformed at ….",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-02",
    contract: "Maintenance debt queue id \"…\" is duplicated.",
    action: "Queue ids must be unique across docs/maintenance-debt/queues/*.yaml.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-03",
    contract: "Queue \"…\" references unknown source command \"…\".",
    action: "Use a live Site OS command name or remove it from sourceCommands.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-04",
    contract: "Active queue \"…\" has no matching current debt.",
    action: "Mark the queue complete, pause it with rationale, or update its selectors.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-06",
    contract: "Queue \"…\" pins stale debt item \"…\".",
    action: "Remove the item key or regenerate/update the queue after confirming the debt is gone.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-07",
    contract: "Queue \"…\" enables batchPolicy.push.",
    action: "Set batchPolicy.push to false; agents must not push queue batches.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-08",
    contract: "Queue \"…\" has no acceptance commands.",
    action: "Add the validation commands agents must run after each batch.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-09",
    contract: "A queue marked complete carries no open items — current debt must be cleared first.",
    action: "Reopen the queue or clear the matching current debt before marking it complete.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-10",
    contract: "Queue \"…\" selects rule \"…\" from command \"…\" outside its sourceCommands.",
    action: "Add \"…\" to sourceCommands or remove \"…\" from selectors.ruleIds.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MDQ-12",
    contract: "Maintenance debt queue \"…\" does not exist.",
    action: "Create the queue YAML or choose one of the active queue ids.",
    docRef: "packages/werkstatt-site/src/checks/maintenance/maintenance-debt-queue.ts",
  },
  {
    ruleId: "MEDIA-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-block.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-block.ts",
  },
  {
    ruleId: "META-01",
    contract: "Missing copyright metadata in embedded IPTC/XMP fields.",
    action: "Run material.metadata.write to embed organizational copyright fallback. If it fails, check system.md organization block — loadSemanticSiteModel may be failing.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts",
  },
  {
    ruleId: "META-02",
    contract: "Credit record has a creator party but no Creator field is embedded.",
    action: "Run material.metadata.write to embed creator metadata from credit sidecar.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts",
  },
  {
    ruleId: "META-03",
    contract: "Embedded copyright \"…\" does not match credit notice \"…\".",
    action: "Run material.metadata.write to sync embedded metadata with credit sidecar.",
    docRef: "packages/werkstatt-site/src/checks/material-metadata.ts",
  },
  {
    ruleId: "META-04",
    contract: "Credit record has a license URL but no WebStatement field is embedded.",
    action: "Run material.metadata.write to embed license URL as WebStatement.",
    docRef: "packages/werkstatt-site/src/checks/material-metadata.ts",
  },
  {
    ruleId: "METH-VAL-01",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/methodologies-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/methodologies-validate.ts",
  },
  {
    ruleId: "METH-VAL-02",
    contract: "Config schema validation failed: …",
    action: "Ensure instruments[], methodologies[], and gate sections are present with valid values.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "METH-VAL-03",
    contract: "Unknown methodology id '…'. Available: ….",
    action: "Fix methodology.id against the declared KNOWN_METHODOLOGY_IDS set.",
    docRef: "packages/werkstatt-site/src/checks/methodologies-validate.ts",
  },
  {
    ruleId: "METH-VAL-04",
    contract: "Unknown instrument type '…' for instrument '…'. Available: ….",
    action: "Fix the instrument type or reference against the declared KNOWN_INSTRUMENT_TYPES vocabulary.",
    docRef: "packages/werkstatt-site/src/checks/methodologies-validate.ts",
  },
  {
    ruleId: "METH-VAL-05",
    contract: "Methodology '…' declares 'sampling' but instrument '…' has type '…' — only performance-vitals instruments consume sampling. The field is forwarded harmlessly and ignored.",
    action: "Remove 'sampling' from methodology '…', or move it to a performance-vitals methodology.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "MIRROR-01",
    contract: "Localized page is missing block[…] (type=\"…\", id=\"…\") that exists in default-language twin.",
    action: "Add a block with type=\"…\" at index … in the localized page.",
    docRef: "packages/werkstatt-site/src/checks/page-blocks-mirror.ts",
  },
  {
    ruleId: "MIRROR-02",
    contract: "Localized block[…] (type=\"…\") is missing prop \"…\" that exists in default-language twin.",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "MIRROR-03",
    contract: "Localized block[…] (type=\"…\") labels object is missing key \"…\" that exists in default twin.",
    action: "Add \"…\" to block[…].props.labels in the localized page.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "MIRROR-CONFIG",
    contract: "Compare each localized page with its default-language twin block-by-block.",
    action: "Ensure the site has a valid astro.config with appDirectory defined.",
    docRef: "packages/werkstatt-site/src/checks/page-blocks-mirror.ts",
  },
  {
    ruleId: "MIRROR-MISSING",
    contract: "…: missing in […] (exists in: …)",
    action: "Create src/content/pages/…/….md (copy structure from src/content/pages/…/….md). Add …: route in system.md pages[].routes.",
    docRef: "packages/werkstatt-site/src/checks/checks/mirroring.ts",
  },
  {
    ruleId: "missing-frontmatter",
    contract: "No YAML frontmatter found in …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/content/i18n-config.ts.",
    docRef: "packages/werkstatt-site/src/content/i18n-config.ts",
  },
  {
    ruleId: "missing-i18n-section",
    contract: "No i18n section in …. Add per RFC-0038.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/i18n-config-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/i18n-config-validate.ts",
  },
  {
    ruleId: "missing-system-md",
    contract: "Required src/content/system.md not found. This is the canonical system manifest.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-surface.ts",
  },
  {
    ruleId: "MOBILE-GEO-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/mobile-layout-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/mobile-layout-check.ts",
  },
  {
    ruleId: "MOBILE-GEO-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/mobile-layout-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/mobile-layout-check.ts",
  },
  {
    ruleId: "MOBILE-GEO-03",
    contract: "CLS score … exceeds threshold … in ….",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/mobile-layout-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/mobile-layout-check.ts",
  },
  {
    ruleId: "MOBILE-GEO-04",
    contract: "RFC-0838: Playwright mobile layout stability checks — horizontal overflow, rotation stability, CLS, section-flow sibling gaps, spacing stacks.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/mobile-layout-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/mobile-layout-check.ts",
  },
  {
    ruleId: "MOBILE-GEO-05",
    contract: "Playwright not available. Run `npx playwright install chromium` to enable mobile layout checks.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/mobile-layout-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/mobile-layout-check.ts",
  },
  {
    ruleId: "MOBILE-GEO-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/mobile-layout-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/mobile-layout-check.ts",
  },
  {
    ruleId: "MOBILE-GEO-07",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/mobile-layout-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/mobile-layout-check.ts",
  },
  {
    ruleId: "MOCK-01",
    contract: "Implements test.mock.lint (RFC-1314) — a `vi.mock(<path>, factory)` whose factory returns a bare object literal replaces the WHOLE module, silently dropping sibling exports that indirect importers need.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-mock-lint.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-mock-lint.ts",
  },
  {
    ruleId: "MODULE-PATH-MISSING",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/runtime/validate-declarations.ts.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "MP-01",
    contract: "Manifest planet \"…\" for page \"…\" not found in page content blocks. The star map graph no longer uses manifest planets, but this entry is stale and should be removed or the content block added.",
    action: "Remove the planet from system.md planets[] if the block was deleted, or add the corresponding block to the page content if it should exist.",
    docRef: "packages/werkstatt-site/src/checks/manifest-planets.ts",
  },
  {
    ruleId: "MP-03",
    contract: "Manifest planet \"…\" for page \"…\" is auto-injected by the render pipeline (RFC-1422) — the pin is stale and the block must never be authored.",
    action: "Remove the planet from system.md planets[]; do not add a corresponding block — the pipeline injects it at render.",
    docRef: "packages/werkstatt-site/src/checks/manifest-planets.ts",
  },
  {
    ruleId: "MUTATES-STATE-DECLARED",
    contract: "Command `…` does not declare `mutatesState` (RFC-1173). Add `mutatesState: false` for read-only commands or `mutatesState: true` for mutating ones.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/runtime/validate-declarations.ts.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "MUTATES-STATE-WRITES-MISMATCH",
    contract: "Command `…` declares … but `mutatesState: false` (RFC-1173). Declared outputs imply mutation — `false` marks the step safe to run tainted under collect-errors. Either set `mutatesState: true` or remove the declared outputs if they are stale.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/runtime/validate-declarations.ts.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "NA-EVIDENCE-01",
    contract: "manifest records evidence '…' as bundled but evidence/…/integrity.txt is missing.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/notausgang/notausgang-commands.ts.",
    docRef: "packages/werkstatt-engine/src/notausgang/notausgang-commands.ts",
  },
  {
    ruleId: "NA-EVIDENCE-02",
    contract: "malformed integrity.txt line: '…'.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/notausgang/notausgang-commands.ts.",
    docRef: "packages/werkstatt-engine/src/notausgang/notausgang-commands.ts",
  },
  {
    ruleId: "NA-FEATURES-01",
    contract: "feature-notes.md not found — export must be re-generated (RFC-1120)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/notausgang/notausgang-commands.ts.",
    docRef: "packages/werkstatt-engine/src/notausgang/notausgang-commands.ts",
  },
  {
    ruleId: "NA-MANIFEST-02",
    contract: "notausgang-manifest.json '…' does not match the YAML twin.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/notausgang/notausgang-commands.ts.",
    docRef: "packages/werkstatt-engine/src/notausgang/notausgang-commands.ts",
  },
  {
    ruleId: "NA-VERIFIER-01",
    contract: "… not found — export must be re-generated (RFC-1120)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-engine/src/notausgang/notausgang-commands.ts.",
    docRef: "packages/werkstatt-engine/src/notausgang/notausgang-commands.ts",
  },
  {
    ruleId: "NACHWEIS-LABELS-01",
    contract: "nachweis-list block #… cardLabels is missing dimensionStatusLabels.",
    action: "Add to cardLabels: dimensionStatusLabels — unavailable: \"Nicht verfügbar\", notApplicable: \"Nicht anwendbar\", notChecked: \"Nicht geprüft\".",
    docRef: "packages/werkstatt-site/src/checks/nachweis-card-labels-validate.ts",
  },
  {
    ruleId: "NACHWEIS-PROPS-01",
    contract: "resolveNachweisEvidenceProps does not assign a required component prop.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "NLWEB-01",
    contract: "NLWeb route missing — the SSR + search entitlement chain is active but src/pages/ask.ts was not emitted.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/agent/nlweb.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/nlweb.ts",
  },
  {
    ruleId: "NLWEB-02",
    contract: "In-process probe returned a non-conformant NLWeb response shape (missing _meta.response_type/query_id, results array, or answer).",
    action: "Inspect runNlwebAsk in packages/werkstatt-engine/src/agent-gate/nlweb-ask.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/nlweb.ts",
  },
  {
    ruleId: "NLWEB-03",
    contract: "Two identical in-process /ask requests produced different response bytes — determinism (ADR-0097) broken.",
    action: "Remove timestamps/randomness from the answer assembly in nlweb-ask.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/nlweb.ts",
  },
  {
    ruleId: "NLWEB-04",
    contract: "No-answer contract violated — below-threshold retrieval must return total_results: 0, empty results, and the localized no-answer sentence.",
    action: "See the no-answer branch of runNlwebAsk in nlweb-ask.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/nlweb.ts",
  },
  {
    ruleId: "ONDEC-01",
    contract: "Validate missions/<missionId>/onboarding.decisions.yaml against werkstatt:onboarding-decisions/v1 plus ONDEC-02…11 discipline rules (08…11 gated on rulesVersion 2) (RFC-1317, RFC-1343). Required flags: `--mission`.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/onboarding-decision-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/onboarding-decision-validate.ts",
  },
  {
    ruleId: "ONDEC-02",
    contract: "Validate missions/<missionId>/onboarding.decisions.yaml against werkstatt:onboarding-decisions/v1 plus ONDEC-02…11 discipline rules (08…11 gated on rulesVersion 2) (RFC-1317, RFC-1343). Required flags: `--mission`.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "ONDEC-03",
    contract: "Validate missions/<missionId>/onboarding.decisions.yaml against werkstatt:onboarding-decisions/v1 plus ONDEC-02…11 discipline rules (08…11 gated on rulesVersion 2) (RFC-1317, RFC-1343). Required flags: `--mission`.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "ONDEC-04",
    contract: "Validate missions/<missionId>/onboarding.decisions.yaml against werkstatt:onboarding-decisions/v1 plus ONDEC-02…11 discipline rules (08…11 gated on rulesVersion 2) (RFC-1317, RFC-1343). Required flags: `--mission`.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "ONDEC-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "ONDEC-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/onboarding-decision-rules.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/onboarding-decision-rules.ts",
  },
  {
    ruleId: "ONDEC-07",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/onboarding-decision-validate.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/onboarding-decision-validate.ts",
  },
  {
    ruleId: "ONDEC-08",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/onboarding-decision-rules.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/onboarding-decision-rules.ts",
  },
  {
    ruleId: "ONDEC-09",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "ONDEC-10",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "ONDEC-11",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "ONDEC-12",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "OS-01",
    contract: "Missing registry data file: src/content/data/…/open-source-registry.json.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/open-source-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/open-source-validate.ts",
  },
  {
    ruleId: "OS-02",
    contract: "Failed to parse registry JSON: src/content/data/…/open-source-registry.json.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/open-source-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/open-source-validate.ts",
  },
  {
    ruleId: "OS-03",
    contract: "Duplicate component in … registry: … appears … times.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/open-source-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/open-source-validate.ts",
  },
  {
    ruleId: "OS-04",
    contract: "Summary componentsTotal (…) does not match public component count (…) in …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/open-source-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/open-source-validate.ts",
  },
  {
    ruleId: "OS-05",
    contract: "Summary directDependencies (…) does not match direct count (…) in …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/open-source-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/open-source-validate.ts",
  },
  {
    ruleId: "OS-06",
    contract: "Missing download artifact: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/open-source-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/open-source-validate.ts",
  },
  {
    ruleId: "OS-07",
    contract: "SBOM component count (…) does not match registry componentsTotal (…)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/open-source-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/open-source-validate.ts",
  },
  {
    ruleId: "OS-08",
    contract: "Failed to load i18n configuration from system.md.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/open-source-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/open-source-validate.ts",
  },
  {
    ruleId: "OWN-01",
    contract: "Every file on disk under the site's public/ directory is covered by a `generates` ownership entry — uncovered files are registry drift (RFC-0612).",
    action: "Add this path to the `generates` array of the command that produces it, remove it (git rm …), or if it is an authored static asset, add the directory to STATIC_ASSET_EXEMPT_DIRS in generated-stale-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/ownership-sync-validate.ts",
  },
  {
    ruleId: "OWN-02",
    action: "Remove stale entry or fix generator \"…\" — no file matches \"…\".",
    docRef: "packages/werkstatt-site/src/checks/ownership-sync-validate.ts",
  },
  {
    ruleId: "OWN-DUP-01",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/ownership-sync-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/ownership-sync-validate.ts",
  },
  {
    ruleId: "PAGE-ANSWERS-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-block.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-block.ts",
  },
  {
    ruleId: "PAGE-BLOCK-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-block.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-block.ts",
  },
  {
    ruleId: "PAGE-EVAL-01",
    contract: "page.evaluate/page.evaluateHandle with a function-serializing first argument crashes browser-side on the esbuild __name helper — serialize via evaluateInPageSource* or serializePageSource.",
    action: "Import evaluateInPageSource/evaluateInPageSourceArgs/serializePageSource from ./playwright-utils.ts and pass the serialized source instead of the function literal.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "PAGE-HERO-ACCENT-01",
    contract: "…: PAGE-HERO-ACCENT-01 headingAccent \"…\" is not a substring of the resolved H1 — the accent must match one heading text unit exactly (resolved H1 units: …)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/hero-accent-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/hero-accent-validate.ts",
  },
  {
    ruleId: "PAGE-HERO-SLOT-01",
    contract: "…: PAGE-HERO-SLOT-01 layout \"split-editorial\" requires featureImage.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/hero-accent-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/hero-accent-validate.ts",
  },
  {
    ruleId: "PAGE-PROPS-FORMAT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-block.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-block.ts",
  },
  {
    ruleId: "PAGE-PROPS-MARKER-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-block.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-block.ts",
  },
  {
    ruleId: "PARITY-LIST-COUNT",
    contract: "…: list count mismatch in section \"…\" (…=…, …=…)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/translation-parity.ts.",
    docRef: "packages/werkstatt-site/src/checks/translation-parity.ts",
  },
  {
    ruleId: "PARITY-LIST-ITEM-COUNT",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "PARITY-PARAGRAPH-COUNT",
    contract: "…: paragraph count mismatch in section \"…\" (…=…, …=…)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/translation-parity.ts.",
    docRef: "packages/werkstatt-site/src/checks/translation-parity.ts",
  },
  {
    ruleId: "PARITY-SENTENCE-COUNT",
    contract: "…: sentence count mismatch in section \"…\" paragraph … (…=…, …=…)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/translation-parity.ts.",
    docRef: "packages/werkstatt-site/src/checks/translation-parity.ts",
  },
  {
    ruleId: "PBP-TIMING-01",
    contract: "…: … is time-bound but has no timing (startEvent, clock, timezone) — RFC-1293.",
    action: "Add timing.\"…\" to the policy frontmatter after the owner decides when the period starts and how it is counted.",
    docRef: "packages/werkstatt-site/src/checks/lib/pbp-timing.ts",
  },
  {
    ruleId: "PBP-TIMING-02",
    contract: "…: timing.\"…\" declares clock: business without businessHours — the counting window is undefined.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/lib/pbp-timing.ts.",
    docRef: "packages/werkstatt-site/src/checks/lib/pbp-timing.ts",
  },
  {
    ruleId: "PBP-TIMING-03",
    contract: "…: timing.\"…\" timezone \"…\" is not a valid IANA zone.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-pbp.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-pbp.ts",
  },
  {
    ruleId: "PBP-TIMING-04",
    contract: "…: … is counted in working-days but timing.\"…\" declares clock: calendar — use clock: business with businessHours.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-pbp.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-pbp.ts",
  },
  {
    ruleId: "PBT-01",
    contract: "fc.string().filter() anti-pattern — can cause test hangs when filter rejects most candidates.",
    action: "Use letterString() or composeWord() from @warpgogol/werkstatt-shared/pbt instead.",
    docRef: "packages/werkstatt-site/src/checks/validator-pbt-safety.ts",
  },
    {
    ruleId: "PEER-01",
    contract: "pnpm install --dry-run failed with peer dependency issues but no specific conflicts could be parsed. Raw output: …",
    action: "Check the pnpm output manually for peer dependency conflicts.",
    docRef: "packages/werkstatt-site/src/checks/template-peer-deps-validate.ts",
  },
  {
    ruleId: "PEER-02",
    contract: "Template file not found: …",
    action: "Ensure packages/werkstatt-site/src/onboarding/templates/package.template.json exists.",
    docRef: "packages/werkstatt-site/src/checks/template-peer-deps-validate.ts",
  },
  {
    ruleId: "PEER-03",
    contract: "Dependency resolution failed (registry/network error): …",
    action: "Ensure registry access is available, or run in an environment with a local cache.",
    docRef: "packages/werkstatt-site/src/checks/template-peer-deps-validate.ts",
  },
  {
    ruleId: "PILLAR-COMMERCIAL-PROMISE",
    contract: "industry \"…\" metaDescription contains unfulfillable promise phrase \"…\".",
    action: "Remove the commercial promise from the industry metaDescription.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "PILLAR-HERO-CTA-NOT-ANCHOR",
    action: "Set pillar.hero.primaryCta.target to { kind: anchor, anchor: industry-catalog } so the hub guides visitors to the catalog first.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "PILLAR-MISSING-TITLE-TEMPLATE",
    contract: "depth-0 pillar level has no titleTemplate — the hub title must communicate the industry-hub function.",
    action: "Add a titleTemplate to the depth-0 level that communicates the industry-hub function.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "PILLAR-NO-PUBLISHED-INDUSTRIES",
    contract: "surface \"…\" has a pillar hub but no published depth-1 industry entries.",
    action: "Ensure at least one industry has live demand records so the catalog is not empty.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "PILLAR-PRICEREF-UNRESOLVABLE",
    contract: "pillar.productPrice.priceRef \"…\" is not a valid PBP reference (expected \"business-profile.…\")",
    action: "Use a business-profile.offerings/… reference for the price.",
    docRef: "packages/werkstatt-site/src/checks/surface-hub-validate.ts",
  },
  {
    ruleId: "PIPELINE-LOG-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "PIPELINE-LOG-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/pipeline/pipeline-log-hygiene.ts.",
    docRef: "packages/werkstatt-site/src/checks/pipeline/pipeline-log-hygiene.ts",
  },
  {
    ruleId: "PIPELINE-LOG-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/pipeline/pipeline-log-hygiene.ts.",
    docRef: "packages/werkstatt-site/src/checks/pipeline/pipeline-log-hygiene.ts",
  },
  {
    ruleId: "PIPELINE-LOG-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/pipeline/pipeline-log-hygiene.ts.",
    docRef: "packages/werkstatt-site/src/checks/pipeline/pipeline-log-hygiene.ts",
  },
  {
    ruleId: "PIPELINE-TIMEOUT-01",
    contract: "Long-running command … has no timeoutMs metadata.",
    action: "Declare timeoutMs on the command registration or its pipeline step descriptor.",
    docRef: "packages/werkstatt-site/src/checks/pipeline/pipeline-telemetry.ts",
  },
  {
    ruleId: "PIPELINE-TIMEOUT-02",
    contract: "Command … timeoutMs is lower than expectedDurationMs.",
    action: "Raise timeoutMs above the expected duration or lower the expectedDurationMs estimate.",
    docRef: "packages/werkstatt-site/src/checks/pipeline/pipeline-telemetry.ts",
  },
  {
    ruleId: "PIPELINE-TIMEOUT-03",
    contract: "Pipeline wrapper … timeoutMs is lower than the sum of configured critical step durations.",
    action: "Raise the wrapper timeout budget or revisit the configured critical step estimates.",
    docRef: "packages/werkstatt-site/src/checks/pipeline/pipeline-telemetry.ts",
  },
  {
    ruleId: "PIPELINE-TIMEOUT-04",
    contract: "Command … declares an impossible timeout or expected-duration value.",
    action: "Use non-negative finite millisecond values for timeoutMs and expectedDurationMs.",
    docRef: "packages/werkstatt-site/src/checks/pipeline/pipeline-telemetry.ts",
  },
  {
    ruleId: "PKG-IMPORT-SHIM-01",
    contract: "Static value import of type-shim-only specifier '…' in …:….",
    action: "Use `import type`/`export type` for declarations, or `await import()` so the real package resolves at runtime.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "POLICY-FOUND",
    contract: "Validate RFC-0183 Feature Policy fields in existing RFC-0047 content domains.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/feature-policy.ts.",
    docRef: "packages/werkstatt-site/src/checks/feature-policy.ts",
  },
  {
    ruleId: "POLICY-INVALID-SHAPE",
    contract: "Invalid policy at …: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/feature-policy.ts.",
    docRef: "packages/werkstatt-site/src/checks/feature-policy.ts",
  },
  {
    ruleId: "POLICY-LEGACY-FEATURE-FLAG",
    contract: "Legacy featureFlag dot-path at … is retired by RFC-0183. Use policy.visibility and policy.behavior instead.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/feature-policy.ts.",
    docRef: "packages/werkstatt-site/src/checks/feature-policy.ts",
  },
  {
    ruleId: "POLICY-LEGACY-FEATURES-DIR",
    contract: "src/content/features/** is retired by RFC-0183. Move policy into existing RFC-0047 content domains.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/feature-policy.ts.",
    docRef: "packages/werkstatt-site/src/checks/feature-policy.ts",
  },
  {
    ruleId: "POLICY-LEGACY-FEATURES-TS",
    contract: "src/configure/features.ts is retired by RFC-0183. Declare feature policy in content frontmatter instead.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/feature-policy.ts.",
    docRef: "packages/werkstatt-site/src/checks/feature-policy.ts",
  },
  {
    ruleId: "potential-orphan-language",
    contract: "Language directory \"…\" may not be declared in system.md i18n.supported.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/i18n-config-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/i18n-config-validate.ts",
  },
  {
    ruleId: "PRICE-PRESENCE-01",
    contract: "RFC-1066: scan built HTML for sections where {price:...} markers in source content resolved to empty — detects price-marker drift caused by missing derivedPrices or locale-suppression bugs.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/price-presence.ts.",
    docRef: "packages/werkstatt-site/src/checks/price-presence.ts",
  },
  {
    ruleId: "PRICE-PRESENCE-02",
    contract: "Page \"…\" (lang \"…\") contains {price:...} marker \"…\" but no rendered HTML exists in dist/client — the marker can never resolve.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/price-presence.ts.",
    docRef: "packages/werkstatt-site/src/checks/price-presence.ts",
  },
  {
    ruleId: "PRICE-PRESENCE-03",
    contract: "Price marker \"…\" (block …) is unresolved in rendered HTML.",
    action: "The component rendering this field does not resolve {price:…} markers — see RFC-1288/RFC-1289.",
    docRef: "packages/werkstatt-site/src/checks/price-presence.ts",
  },
  {
    ruleId: "PROPS-02",
    contract: "Manifest example fails its own …: …",
    action: "Fix the example block, or the …, so the two agree.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "PROPS-03",
    contract: "Content-driven component manifest uses 'propsSchema' for content — rename to 'contentSchema'.",
    action: "Move the content fields from propsSchema to contentSchema. If the component also accepts caller-supplied props, keep those in propsSchema.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "PROPS-04",
    contract: "pageOverride property keys do not match contentSchema property keys. Missing in pageOverride: […]. Extra in pageOverride: […].",
    action: "Ensure pageOverride in propsSchema has the same property keys as contentSchema (all optional).",
    docRef: "packages/werkstatt-site/src/checks/props-contract.ts",
  },
  {
    ruleId: "PROSE-DUP-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-prose.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-prose.ts",
  },
  {
    ruleId: "PROSE-DUP-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-prose.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-prose.ts",
  },
  {
    ruleId: "PROSE-DUP-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-prose.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-prose.ts",
  },
  {
    ruleId: "PROSE-DUP-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-prose.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-prose.ts",
  },
  {
    ruleId: "PROSE-DUP-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-prose.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-prose.ts",
  },
  {
    ruleId: "PSEO-ART-02",
    contract: "Target translation has no derivedFrom/sourceHash lineage.",
    action: "Regenerate the translation draft from a ready source artifact.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-ART-03",
    contract: "Target translation is outdated against the current ready source hash.",
    action: "Regenerate the draft and re-run target-language review.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-ART-04",
    contract: "Approved translation does not have quality.targetGate=pass.",
    action: "Complete translation QA and human review before approving.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-ART-05",
    contract: "Translation lacks derived.contractRef \"…\".",
    action: "Regenerate using the current approved contract overlay.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-ART-06",
    contract: "Translation references modules.…, which is missing or not approved.",
    action: "Regenerate after the contract overlay is populated and approved.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-ART-08",
    contract: "Approved translation lacks humanReview=pass.",
    action: "Record target-language human review before approval.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-GLOSS-01",
    contract: "Missing translation glossary terms for …/… (modules.…).",
    action: "Run: pnpm exec werkstatt run surface.translation.glossary.generate --module … --target … to create the glossary, then approve it.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-GLOSS-02",
    contract: "Glossary term \"…\" in modules.… is malformed or ambiguous.",
    action: "Each overlay term needs a concept and at least one locale form.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-NOTE-01",
    contract: "Missing translator note overlay for …/… (modules.…).",
    action: "Run surface.translation.notes.generate, review it, then approve it.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-NOTE-02",
    contract: "Translator note overlay modules.… (…) is not approved.",
    action: "Review and approve the note before translation generation.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-NOTE-03",
    contract: "Translator note overlay modules.… is stale against module context.",
    action: "Regenerate and re-approve the note after module-context changes.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-NOTE-04",
    contract: "Translator note overlay modules.… (…) is missing \"…\" content.",
    action: "Fill note.… in the modules.… overlay.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-NOTE-05",
    contract: "Translator note overlays carry reviewed example content after initial translations are approved.",
    action: "Add reviewed examples after initial translations are approved.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PSEO-PROOF-01",
    contract: "Demand-map proof input is missing; proof status is not enough data.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "PSEO-PROOF-02",
    contract: "Demand-map proof input has invalid generatedAt metadata or belongs to the wrong blueprint.",
    action: "Regenerate the demand-map proof input with current metadata for the expected blueprint.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-proof.ts",
  },
  {
    ruleId: "PSEO-PROOF-03",
    contract: "Evidence-join proof input is missing or contains no mapped rows; proof status is not enough data.",
    action: "Regenerate the evidence-join proof input so the mapped rows reach the proof gate.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-proof.ts",
  },
  {
    ruleId: "PSEO-PROOF-04",
    contract: "Evidence-join proof input has invalid generatedAt metadata or belongs to the wrong blueprint.",
    action: "Regenerate the evidence-join proof input with current metadata for the expected blueprint.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-proof.ts",
  },
  {
    ruleId: "PSEO-PROOF-05",
    contract: "Visibility-outcome proof input is missing, has invalid generatedAt metadata, or is empty.",
    action: "Regenerate the visibility-outcome proof input with current metadata for the expected blueprint.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-proof.ts",
  },
  {
    ruleId: "PSEO-QA-01",
    contract: "Translation dropped numeric echo \"…\".",
    action: "Preserve numbers, dates, prices, and identifiers exactly.",
    docRef: "packages/werkstatt-site/src/checks/surface-translation.ts",
  },
  {
    ruleId: "PUBGATE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-pbp.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-pbp.ts",
  },
  {
    ruleId: "PUBGATE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/dist-content-references.ts.",
    docRef: "packages/werkstatt-site/src/checks/dist-content-references.ts",
  },
  {
    ruleId: "PUBGATE-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/dist-content-references.ts.",
    docRef: "packages/werkstatt-site/src/checks/dist-content-references.ts",
  },
  {
    ruleId: "PUBTIER-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/content-pbp.ts.",
    docRef: "packages/werkstatt-site/src/checks/content-pbp.ts",
  },
  {
    ruleId: "PUBTXT-CS",
    contract: "robots.txt does not contain a Content-Signal directive.",
    action: "Run robots.generate.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "Q-ASPECT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/asset-quality.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/asset-quality.ts",
  },
  {
    ruleId: "Q-ASSET-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "Q-AVOID-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "Q-COPY-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "Q-CRAFT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "Q-DIM-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/asset-prompt.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/asset-prompt.ts",
  },
  {
    ruleId: "Q-FRAME-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "Q-MOCK-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "Q-SUBJECT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "Q-TEXT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/module.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/module.ts",
  },
  {
    ruleId: "Q-TRANSPORT",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/onboarding/asset-slot-fulfill.ts.",
    docRef: "packages/werkstatt-site/src/onboarding/asset-slot-fulfill.ts",
  },
  {
    ruleId: "SYSTEM-01",
    contract: "System commands require a forge repository on the system profile (profile: system in forge.yaml).",
    action: "Run the command inside a repository created with `forge create --in-place --profile system`, or correct the forge.yaml profile field.",
    docRef: "docs/rfcs/rfc-1508-forge-system-system-profile-system-map-schemas-and-system-map-validate.md",
  },
  {
    ruleId: "SYSTEM-MAP-01",
    contract: "Every required system-map file (system/system.yaml, system/products.yaml, system/edges.yaml) exists and satisfies its forge/…@1 schema.",
    action: "Repair the reported file against its forge/…@1 schema — see packages/forge/os/system/schemas.ts.",
    docRef: "packages/forge/os/system/schemas.ts",
  },
  {
    ruleId: "SYSTEM-MAP-02",
    contract: "Product ids are unique and every edge consumer is a declared product.",
    action: "Remove the duplicate product id or declare the edge consumer in system/products.yaml.",
    docRef: "packages/forge/os/system/repo.ts",
  },
  {
    ruleId: "SYSTEM-MAP-03",
    contract: "Every edge contract is offered by at least one product in system/products.yaml.",
    action: "Declare the contract in a product's offers[] or remove the edge from system/edges.yaml.",
    docRef: "packages/forge/os/system/repo.ts",
  },
  {
    ruleId: "SYSTEM-MAP-04",
    contract: "A consumer/contract pair may not appear in both allowed and forbidden edge lists.",
    action: "Keep the pair in exactly one list in system/edges.yaml — forbidden wins at lookup time.",
    docRef: "packages/forge/os/system/repo.ts",
  },
  {
    ruleId: "SYSTEM-MAP-05",
    contract: "system/products.local.yaml covers declared products and names only existing folders.",
    action: "Update system/products.local.yaml (gitignored) to list checked-out product folders.",
    docRef: "packages/forge/os/system/repo.ts",
  },
  {
    ruleId: "SYSTEM-TASK-01",
    contract: "Every task command argument names an existing task file that satisfies forge/system-task@1.",
    action: "Check the T-NNNN id against queue/tasks/ — unknown or schema-invalid task files must be repaired or recreated via `werkstatt run system.task.create`.",
    docRef: "packages/forge/os/system/task-store.ts",
  },
  {
    ruleId: "SYSTEM-TASK-02",
    contract: "Only the RFC-1509 transition table's edges are legal, each owned by the command the table names.",
    action: "Check the task's state and the owning command — dispatch owns ready→dispatched, collect owns dispatched→reported/failed and reported→integrated; satisfy the row's check (reason, brief, dependency, version-set) before retrying `werkstatt run system.task.move`.",
    docRef: "docs/rfcs/rfc-1509-forge-system-task-queue-dispatch-briefs-and-task-reports.md",
  },
  {
    ruleId: "SYSTEM-TASK-03",
    contract: "A task may not move to ready or dispatch when any of its contracts is a forbidden edge for its product.",
    action: "Renegotiate the consumer/contract pair in system/edges.yaml, or drop the contract from the task.",
    docRef: "packages/forge/os/system/repo.ts",
  },
  {
    ruleId: "SYSTEM-TASK-05",
    contract: "The task's product is declared in system/products.yaml and resolves to an existing local checkout via products.local.yaml.",
    action: "Declare the product in system/products.yaml or add its folder to system/products.local.yaml.",
    docRef: "packages/forge/os/system/handlers/system-task-dispatch.ts",
  },
  {
    ruleId: "SYSTEM-TASK-06",
    contract: "A dispatch brief must not contain the system identity or another product's local folder.",
    action: "Scrub queue/briefs/<id>.md — product sessions must not learn the system repository's identity or sibling checkouts.",
    docRef: "packages/forge/os/system/handlers/system-task-dispatch.ts",
  },
  {
    ruleId: "SYSTEM-TASK-07",
    contract: "Collect requires a task report at the dispatch worktree's .forge/task/report.yaml or its preserved copy under the product's common git dir.",
    action: "Write the report in the product session, or fail the task deliberately with --mark-failed --reason <why>.",
    docRef: "packages/forge/os/system/handlers/system-task-collect.ts",
  },
  {
    ruleId: "SYSTEM-TASK-08",
    contract: "A collected report must satisfy forge/task-report@1 and name the task being collected.",
    action: "Fix the report's schema or task field in the product session, or --mark-failed the task.",
    docRef: "packages/forge/os/system/task-schemas.ts",
  },
  {
    ruleId: "SYSTEM-TASK-09",
    contract: "The products.local.yaml launcher argv runs after a successful dispatch.",
    action: "Inspect the launcher command's stderr — the task stays dispatched; fix the launcher argv or invoke it by hand.",
    docRef: "packages/forge/os/system/handlers/system-task-dispatch.ts",
  },
  {
    ruleId: "OUTBOX-01",
    contract: "Every docs/outbox/<id>.yaml entry satisfies forge/outbox@1 — schema, id, contract, need, why, state.",
    action: "Fix the entry against forge/outbox@1 — an entry names a contract, need, why and state; see the fo-outbox skill.",
    docRef: "packages/forge/os/system/outbox-schema.ts",
  },
  {
    ruleId: "OUTBOX-02",
    contract: "An outbox entry's id field equals its filename stem — docs/outbox/OB-0003.yaml declares id OB-0003.",
    action: "Rename the file or fix the id — the filename stem is the canonical id.",
    docRef: "packages/forge/os/system/handlers/outbox-validate.ts",
  },
  {
    ruleId: "SYSTEM-OUTBOX-02",
    contract: "No task is created when the edge from the asking product to the contract is forbidden.",
    action: "Resolve the forbidden edge in system/edges.yaml, or have the product withdraw the entry.",
    docRef: "packages/forge/os/system/handlers/system-outbox-scan.ts",
  },
  {
    ruleId: "SYSTEM-MAP-06",
    contract: "Every system/scenarios/<id>.yaml names only products declared in system/products.yaml and contracts some product offers.",
    action: "Declare the product in system/products.yaml, add the contract to a product's offers[], or fix the scenario.",
    docRef: "packages/forge/os/system/repo.ts",
  },
  {
    ruleId: "SYSTEM-VS-01",
    contract: "system.versionset.record takes --products <product=tag,…> and --scenarios <id,…>, each scenario declared under system/scenarios/.",
    action: "Fix the flag values or declare the missing scenario under system/scenarios/.",
    docRef: "packages/forge/os/system/handlers/system-versionset-record.ts",
  },
  {
    ruleId: "SYSTEM-VS-02",
    contract: "Every product a named scenario exercises must appear in --products and resolve to a local checkout.",
    action: "Add the product=tag pair to --products or map the product folder in system/products.local.yaml.",
    docRef: "packages/forge/os/system/handlers/system-versionset-record.ts",
  },
  {
    ruleId: "SYSTEM-VS-03",
    contract: "A version-set tag exists locally and is an annotated forge/release-tag@1 tag cut by flow.cut.",
    action: "Fetch or cut the release tag in the product checkout — lightweight and foreign tags are refused.",
    docRef: "packages/forge/os/system/handlers/system-versionset-record.ts",
  },
  {
    ruleId: "SYSTEM-VS-04",
    contract: "A version set exists only when every check of every named scenario exits 0 — no partial sets.",
    action: "Read the scenario log under system/version-sets/evidence/<id>/ — fix the check or the product release and re-run.",
    docRef: "packages/forge/os/system/handlers/system-versionset-record.ts",
  },
  {
    ruleId: "QUEUE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/queue/manifest.ts.",
    docRef: "packages/forge/os/queue/manifest.ts",
  },
  {
    ruleId: "QUEUE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/queue/manifest.ts.",
    docRef: "packages/forge/os/queue/manifest.ts",
  },
  {
    ruleId: "QUEUE-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/queue/manifest.ts.",
    docRef: "packages/forge/os/queue/manifest.ts",
  },
  {
    ruleId: "QUEUE-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/queue/manifest.ts.",
    docRef: "packages/forge/os/queue/manifest.ts",
  },
  {
    ruleId: "QUEUE-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/queue/manifest.ts.",
    docRef: "packages/forge/os/queue/manifest.ts",
  },
  {
    ruleId: "QUEUE-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/queue/manifest.ts.",
    docRef: "packages/forge/os/queue/manifest.ts",
  },
  {
    ruleId: "QUEUE-07",
    contract: "Item \"…\" is implementable but carries … open decision(s) — resolve the decision window first.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/queue/handlers/queue-validate.ts.",
    docRef: "packages/forge/os/queue/handlers/queue-validate.ts",
  },
  {
    ruleId: "QUEUE-08",
    contract: "A decision-ledger entry is decided but carries no answer to bind, or targets a doc that is not a manifest item — invisible to the queue.",
    action: "Fill the decision's answer or repoint its target doc to a manifest item.",
    docRef: "packages/forge/os/queue/manifest.ts",
  },
  {
    ruleId: "RB-07",
    contract: "inlineCssBytes … exceeds … limit … on route …",
    action: "Move shared CSS to the external stylesheet (build.inlineStylesheets: \"auto\") or raise inlineCssBytes.limit in src/content/system.md.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "RC-00",
    contract: "Root entry page not found.",
    action: "Run routes.generate to create src/pages/index.astro.",
    docRef: "packages/werkstatt-site/src/checks/root-canonical.ts",
  },
  {
    ruleId: "RC-01",
    contract: "Root page emits a <meta http-equiv=\"refresh\"> stub instead of rendering content.",
    action: "Render the default-language home directly via resolvePageRoute() so AI crawlers receive content (RFC-0159).",
    docRef: "packages/werkstatt-site/src/checks/root-canonical.ts",
  },
  {
    ruleId: "RC-02",
    contract: "Root page does not call resolvePageRoute().",
    action: "Render the default-language home content via resolvePageRoute(), not a redirect-only component (RFC-0159).",
    docRef: "packages/werkstatt-site/src/checks/root-canonical.ts",
  },
  {
    ruleId: "RC-03",
    contract: "Root page passes a canonicalUrl override.",
    action: "Remove the canonicalUrl override; under RFC-0160 \"/\" is self-canonical via the layout's default Astro.url.",
    docRef: "packages/werkstatt-site/src/checks/root-canonical.ts",
  },
  {
    ruleId: "REFERRAL-CAPACITY-01",
    contract: "capacity.updatedAt … is … days old (window: …) — refresh the wave counter or remove the capacity block.",
    action: "Update capacity {month, free, total, updatedAt} in policies/partner-program.md, or delete the block to fall back to the static range line.",
    docRef: "packages/werkstatt-site/src/checks/referral-partners.ts",
  },
  {
    ruleId: "REFERRAL-CAPACITY-02",
    contract: "capacity.total … is outside the published waveSlots range …–… — two sources of truth about the wave size diverge.",
    action: "Align capacity.total with the digital-foundation availability.slotRange, or update the slotRange — the landing renders both.",
    docRef: "packages/werkstatt-site/src/checks/referral-partners.ts",
  },
  {
    ruleId: "REFERRAL-EXPIRY-01",
    contract: "partner \"…\" validUntil … is in the past (today: …) — reconfirm the recommendation with the recommender or retire it.",
    action: "Extend validUntil after reconfirmation, or flip status to retired with retiredAt — an expired recommendation must not keep rendering.",
    docRef: "packages/werkstatt-site/src/checks/referral-partners.ts",
  },
  {
    ruleId: "REFERRAL-JSON-01",
    contract: "… partner \"…\" emitted no /r/….json twin.",
    action: "Check the generated [slug].json endpoint getStaticPaths.",
    docRef: "packages/werkstatt-site/src/checks/referral-json-parity.ts",
  },
  {
    ruleId: "REFERRAL-JSON-02",
    contract: "/r/….json is not valid JSON.",
    action: "The endpoint must serialize the builder document verbatim.",
    docRef: "packages/werkstatt-site/src/checks/referral-json-parity.ts",
  },
  {
    ruleId: "REFERRAL-JSON-03",
    contract: "… /r/….json must contain exactly {type, slug, status: \"…\"} — found keys: …",
    action: "Emit exactly {type, slug, status} keys in the referral JSON document.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-01",
    contract: "… partner \"…\" emitted no page at …",
    action: "Check the generated /r/[slug] route and getStaticPaths lifecycle gate.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-02",
    contract: "The § 5a UWG disclosure is missing or renders out of order relative to the embedded form.",
    action: "Add the disclosure footnote, or move it directly below the embedded form.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-03",
    contract: "… renders … — referral pages must not ship persistence surfaces.",
    action: "Remove the control from headerControls/footer overrides — it writes to device storage.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-04",
    contract: "… lacks <meta name=\"robots\" content=\"noindex\">.",
    action: "Add <meta name=\"robots\" content=\"noindex\"> to the landing page head.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-06",
    contract: "A paused, retired, or pending partner page leaks identity or attribution that its lifecycle state forbids.",
    action: "Emit the lifecycle-correct neutral document — paused/retired/pending slugs carry no partner identity.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-07",
    contract: "… lacks Open Graph tags — the shared link renders bare.",
    action: "Add Open Graph tags to the shared-link variant — optional but recommended for partner-shared links.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-08",
    contract: "… form lacks native action=\"/api/send-message\" method=\"post\".",
    action: "The enhancement-only contract still requires a working native POST — the form must succeed without JS.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-09",
    contract: "… renders no data-referral-landing article marker — the v7 section contract cannot be verified.",
    action: "Render the data-referral-landing article marker in the section output.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-LANDING-10",
    contract: "… contains review/rating vocabulary — the recommender's voice must never read as a customer review.",
    action: "Remove review/rating vocabulary from the landing copy.",
    docRef: "packages/werkstatt-site/src/checks/referral-landing.ts",
  },
  {
    ruleId: "REFERRAL-PARTNERS-01",
    contract: "partners.yaml violates the v4 registry contract: …",
    action: "v4 requires status (pending|active|retired|paused), structured consent {method: none|document|channel}, and forbids legacy active/publicNameConsentRef. See RFC-1222/1258/1277.",
    docRef: "packages/werkstatt-site/src/checks/referral-partners.ts",
  },
  {
    ruleId: "REFERRAL-PARTNERS-02",
    contract: "partner \"…\" consent.ref \"…\" resolves to no existing pbp/consent entity under business-profile/{lang}/trust/consents/.",
    action: "Author the consent entity (pbp/consent@1) first, or switch consent.method to channel with the venue + grantedAt recorded.",
    docRef: "packages/werkstatt-site/src/checks/referral-partners.ts",
  },
  {
    ruleId: "REFERRAL-PARTNERS-03",
    contract: "….… names \"…\" — no page in system.md carries that route for …",
    action: "Point the route at an authored page slug, or remove the entry.",
    docRef: "packages/werkstatt-site/src/checks/referral-partners.ts",
  },
  {
    ruleId: "REFERRAL-PHRASE-GUARD",
    contract: "… carries an unverifiable claim pattern \"…\": \"…\".",
    action: "Rewrite the sentence to a verifiable claim, or phrase it as a negation — negated forms are legitimate.",
    docRef: "packages/werkstatt-site/src/checks/referral-partners.ts",
  },
  {
    ruleId: "REFERRAL-RECEIPT-01",
    action: "The receipt is part of the handoff artifact — it must render on the landing.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "REFERRAL-RECEIPT-02",
    contract: "… renders the receipt after the form — the receipt must precede it.",
    action: "Keep the receipt directly above the embedded send-message form.",
    docRef: "packages/werkstatt-site/src/checks/referral-receipt.ts",
  },
  {
    ruleId: "REFERRAL-RECEIPT-03",
    contract: "… referrer field missing or not prefilled with \"…\".",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "REFERRAL-RECEIPT-04",
    contract: "send-message API no longer stamps \"…\" on partner-resolved submissions.",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "REFERRAL-REWARD-PARITY",
    contract: "… \"…\" does not carry the PBP-derived amount … — display phrases must match the offering (DNA-103)",
    action: "Rewrite the phrase to interpolate the derived amount, or fix the offering — never hand-copy digits.",
    docRef: "packages/werkstatt-site/src/checks/referral-partners.ts",
  },
  {
    ruleId: "REGISTRY-CHANGED",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/registry.ts.",
    docRef: "packages/werkstatt-site/src/checks/registry.ts",
  },
  {
    ruleId: "REGISTRY-INVALID",
    contract: "Manifest fails to parse (YAML parse error).",
    action: "Fix the YAML syntax in the manifest.",
    docRef: "packages/werkstatt-site/src/checks/registry.ts",
  },
  {
    ruleId: "REGISTRY-MISSING",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/registry.ts.",
    docRef: "packages/werkstatt-site/src/checks/registry.ts",
  },
  {
    ruleId: "REGISTRY-NEW",
    contract: "Manifest exists on disk but is not in uni.registry.yaml.",
    action: "Run `site-kernel run uni.registry.build` to regenerate uni.registry.yaml.",
    docRef: "packages/werkstatt-site/src/checks/registry.ts",
  },
  {
    ruleId: "REGISTRY-READ-ERROR",
    contract: "Manifest could not be read.",
    action: "Ensure the manifest file is present and readable.",
    docRef: "packages/werkstatt-site/src/checks/registry.ts",
  },
  {
    ruleId: "REGISTRY-STALE",
    action: "Run `site-kernel run uni.registry.build` to regenerate uni.registry.yaml.",
    docRef: "packages/werkstatt-site/src/checks/registry.ts",
  },
  {
    ruleId: "REMEDIATION-01",
    contract: "Validator rule \"…\" has no entry in REMEDIATION_CATALOG — add a remediation pattern for this ruleId.",
    action: "Add a REMEDIATION_CATALOG entry for the flagged ruleId — contract, action, and docRef are required on new entries.",
    docRef: "packages/werkstatt-engine/src/remediation/remediation-hint-validate.ts",
  },
  {
    ruleId: "REMEDIATION-04",
    contract: "REMEDIATION_CATALOG entry \"…\" references command token \"…\" in action/template which is not a registered command — the printed remedy cannot be invoked.",
    action: "Correct the command token in the entry's action/template to a registered command, or remove the token.",
    docRef: "packages/werkstatt-engine/src/remediation/remediation-hint-validate.ts",
  },
  {
    ruleId: "RENDER-BG-01",
    contract: "Scrimmed background textures keep visible content — the scrim never fully hides the texture's imagery.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check-rules.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check-rules.ts",
  },
  {
    ruleId: "RENDER-CHROME-01",
    contract: "Every chrome string resolves in a supported locale — declared hidden chrome roots included.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check.ts",
  },
  {
    ruleId: "RENDER-CREDIT-01",
    contract: "Material credits stay inside their media slot on the rendered surface.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check.ts",
  },
  {
    ruleId: "RENDER-CREDIT-02",
    contract: "Material credits keep at least 3:1 contrast against their background.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check.ts",
  },
  {
    ruleId: "RENDER-FOLD-01",
    contract: "Hero text in the first fold meets 4.5:1 contrast against composited pixels (3:1 at 24px+).",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check-rules.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check-rules.ts",
  },
  {
    ruleId: "RENDER-FOLD-02",
    contract: "First-fold CTA labels keep at least 4.5:1 contrast against their own button surface.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check.ts",
  },
  {
    ruleId: "RENDER-FOLD-03",
    contract: "Header lockup line count is desktop-only: stacked layouts render 2 rows, inline renders 1.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check.ts",
  },
  {
    ruleId: "RENDER-OFFSET-01",
    contract: "Fixed chrome never overhangs into section content.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check.ts",
  },
  {
    ruleId: "RENDER-OVERFLOW-01",
    contract: "Chrome text stays inside its column bounds at every viewport.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check-rules.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check-rules.ts",
  },
  {
    ruleId: "RENDER-OVERLAP-01",
    contract: "Text-bearing siblings never overlap on the rendered surface.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/page-render-check-rules.ts.",
    docRef: "packages/werkstatt-site/src/checks/page-render-check-rules.ts",
  },
  {
    ruleId: "REV-01",
    contract: "… reviewer equals generator.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/ops-fleet.ts",
  },
  {
    ruleId: "REV-03",
    contract: "… approved despite grounding violations.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/pseo/pseo-governance.ts.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-governance.ts",
  },
  {
    ruleId: "REV-04",
    contract: "… low-confidence verdict was approved.",
    action: "Re-review the artifact at higher confidence before approving.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-governance.ts",
  },
  {
    ruleId: "REV-06",
    contract: "Review verdict is malformed or unpinned.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/pseo/pseo-governance.ts.",
    docRef: "packages/werkstatt-site/src/checks/pseo/pseo-governance.ts",
  },
  {
    ruleId: "RG-HUB-01",
    contract: "ratgeber hub (depth-0) semanticType is \"…\" — expected \"collection\" (CollectionPage)",
    action: "Set semanticType: collection on the depth-0 level in the ratgeber blueprint.",
    docRef: "packages/werkstatt-site/src/checks/ratgeber-hub-validate.ts",
  },
  {
    ruleId: "RG-HUB-02",
    contract: "ratgeber hub layout is missing required blocks (hero:…, cards:…, markdown:…, cta:…)",
    action: "Ensure bakeRatgeberHub emits hero, audience-cards (Themenbereiche), markdown (Redaktion), and final-cta blocks.",
    docRef: "packages/werkstatt-site/src/checks/ratgeber-hub-validate.ts",
  },
  {
    ruleId: "RG-HUB-03",
    contract: "article \"…\" is missing required card fields (title or summary)",
    action: "Ensure each article record has title and summary fields.",
    docRef: "packages/werkstatt-site/src/checks/ratgeber-hub-validate.ts",
  },
  {
    ruleId: "RG-HUB-05",
    contract: "article slug \"…\" is reserved (reservedSlugs: …)",
    action: "Rename the article slug to something other than ….",
    docRef: "packages/werkstatt-site/src/checks/ratgeber-hub-validate.ts",
  },
  {
    ruleId: "RG-HUB-06",
    contract: "article \"…\" is in the surface artifact but is not published (noindex + not indexable)",
    action: "Ensure the statusGate in the blueprint excludes non-published articles.",
    docRef: "packages/werkstatt-site/src/checks/ratgeber-hub-validate.ts",
  },
  {
    ruleId: "RG-HUB-07",
    contract: "article \"…\" contains prohibited commercial claim phrase \"…\".",
    action: "Remove the commercial promise from the article prose or fields. FAQ answers are excluded.",
    docRef: "packages/werkstatt-site/src/checks/ratgeber-hub-validate.ts",
  },
  {
    ruleId: "RG-HUB-08",
    contract: "article \"…\" is missing required article metadata (publishedAt, author, etc.)",
    action: "Ensure each article record has publishedAt, author, and tags fields.",
    docRef: "packages/werkstatt-site/src/checks/ratgeber-hub-validate.ts",
  },
  {
    ruleId: "ROBOTS-AITRAIN-01",
    action: "Run robots.generate.",
    docRef: "packages/werkstatt-site/src/checks/robots.ts",
  },
  {
    ruleId: "ROBOTS-AITRAIN-02",
    contract: "robots policy is self-contradictory: contentSignal declares ai-train=no but explicitly allows training crawler(s): ….",
    action: "Resolve the policy in system.md — remove the token from crawlerAllowlist/customRules or change contentSignal.",
    docRef: "packages/werkstatt-site/src/checks/robots.ts",
  },
  {
    ruleId: "ROBOTS.VALIDATE",
    action: "Run robots.generate and ensure robots.txt contains User-agent, Sitemap, and crawl rules.",
    docRef: "packages/werkstatt-site/src/checks/robots.ts",
  },
  {
    ruleId: "ROUTE-THIN-01",
    contract: "line …: <style> block in route file (move styles to src/styles/)",
    action: "Move the styles into src/styles/ and import them via @styles/.",
    docRef: "packages/werkstatt-site/src/checks/semantic.ts",
  },
  {
    ruleId: "ROUTE-THIN-02",
    contract: "line …: inline style= attribute in route file (use CSS classes instead)",
    action: "Use a CSS class defined in src/styles/ instead of inline style=.",
    docRef: "packages/werkstatt-site/src/checks/semantic.ts",
  },
  {
    ruleId: "ROUTE-THIN-03",
    contract: "forbidden import '…' in route file — composition belongs in share/astro or ui/components.",
    action: "Move the import into a werkstatt-site share/astro module or a ui/components document component.",
    docRef: "packages/werkstatt-site/src/checks/semantic.ts",
  },
  {
    ruleId: "ROUTE-THIN-04",
    contract: "declared twin missing: … — the pair … ↔ … must be emitted together.",
    action: "Re-run routes.generate so both twins emit from their templates.",
    docRef: "packages/werkstatt-site/src/checks/semantic.ts",
  },
  {
    ruleId: "RSHAD-03",
    contract: "A redirect target is not in the sitemap but a static file exists at the target path.",
    action: "Remove the stale static file from dist/client/ or point the redirect to a live canonical route.",
    docRef: "packages/werkstatt-site/src/checks/redirect-shadow.ts",
  },
  {
    ruleId: "RSHAD-00",
    contract: "The redirect-shadow audit is inconclusive — `_redirects`, `dist/client/`, or the wrangler config is missing.",
    action: "Build dist/client and ensure _redirects plus the wrangler config exist so the shadow audit can run.",
    docRef: "packages/werkstatt-site/src/checks/redirect-shadow.ts",
  },
  {
    ruleId: "RSHAD-01",
    contract: "Static file shadows redirect source: … — redirect will never fire.",
    action: "Remove the static file from dist/client/ or remove the redirect from _redirects.",
    docRef: "packages/werkstatt-site/src/checks/redirect-shadow.ts",
  },
  {
    ruleId: "RSHAD-02",
    contract: "Worker route matches redirect source: … — Worker may intercept before _redirects.",
    action: "Add a Worker route exception for redirect sources or process _redirects in the Worker fetch handler.",
    docRef: "packages/werkstatt-site/src/checks/redirect-shadow.ts",
  },
  {
    ruleId: "RULEID-CANONICAL-01",
    contract: "ruleId literal \"…\" violates the canonical schema (/^[A-Z0-9][A-Z0-9._-]*$/).",
    action: "Author the ruleId in canonical casing at the emit site; move interpolated values into `data`/`message`. Test fixtures carrying intentionally-invalid ids escape via string concatenation.",
    docRef: "packages/werkstatt-site/src/checks/diagnostic-rule-id.ts",
  },
  {
    ruleId: "RUNTIME-WARN-01",
    contract: "Missing image runtime warning must have a static asset diagnostic equivalent.",
    action: "Register and wire … so \"…\" is represented as Diagnostic[].",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/section-agent.ts",
  },
  {
    ruleId: "RUNTIME-WARN-02",
    contract: "Missing pageId runtime warning must have a static semantic-target diagnostic equivalent (SEM-TARGET-01).",
    action: "Register the missing-pageId warning's static equivalent (SEM-TARGET-01) in semantic.targets.validate.",
    docRef: "packages/werkstatt-site/src/checks/runtime-warnings-lint.ts",
  },
  {
    ruleId: "SCAN-01",
    contract: "Hardcoded file path in scan function.",
    action: "Use discoverSourceFiles(io, srcDir, patterns) instead of a hardcoded path literal.",
    docRef: "packages/werkstatt-site/src/checks/validator-scan-coverage.ts",
  },
  {
    ruleId: "SCAN-02",
    contract: "Validator \"…\" declares reads glob \"…\" whose static prefix \"…\" does not resolve to an existing directory.",
    action: "Repoint the glob to the directory that replaced it, remove the dead entry, or add `// scan-coverage: <reason>` on the reads line if the absence is intentional.",
    docRef: "packages/werkstatt-site/src/checks/validator-scan-coverage.ts",
  },
  {
    ruleId: "SCAN-03",
    action: "Import createCoverageTracker from ./lib/dist-coverage.ts (or ../../lib/dist-coverage.ts) and record scan()/skip() for every enumerated dist page.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SEARCH-01",
    contract: "indexable route missing from search index: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-search/index-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-search/index-validate.ts",
  },
  {
    ruleId: "SEARCH-02",
    contract: "excluded (noindex/disabled) route present in search index: …",
    action: "Remove the excluded route from the search index or un-exclude the route.",
    docRef: "packages/werkstatt-site/src/checks/site-search/index-validate.ts",
  },
  {
    ruleId: "SEARCH-03",
    contract: "indexed route does not resolve to an emitted route: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-search/index-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-search/index-validate.ts",
  },
  {
    ruleId: "SEARCH-04",
    contract: "index manifest is not parseable JSON.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-search/index-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-search/index-validate.ts",
  },
  {
    ruleId: "SEARCH-05",
    contract: "site-search declared in content but no index manifest found — run site-search.index.generate.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-search/index-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-search/index-validate.ts",
  },
  {
    ruleId: "SECTION-DEFAULT-01",
    contract: "Shared UI source uses app-specific asset fallback \"hero-1\".",
    action: "Omit the optional image when no token is authored, or declare a portable fallback registry entry.",
    docRef: "packages/werkstatt-site/src/checks/section-defaults.ts",
  },
  {
    ruleId: "SECTION-DEFAULT-02",
    contract: "Shared UI source uses app-specific pageId fallback \"donateContact\".",
    action: "Omit the optional CTA when no target is authored, or provide a validated app/site-level target.",
    docRef: "packages/werkstatt-site/src/checks/section-defaults.ts",
  },
  {
    ruleId: "SECTION-DEFAULT-04",
    contract: "Shared UI source describes a legacy fallback without a validated migration path.",
    action: "Remove the implicit legacy fallback or document it through a portable fallback registry.",
    docRef: "packages/werkstatt-site/src/checks/section-defaults.ts",
  },
  {
    ruleId: "SECTION-LANG-PROJ-01",
    contract: "Rendition heading '…' (…) rendered in … is absent from llms-full.txt — projections must expose the same alternate-language content.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/semantic-fact-parity.ts.",
    docRef: "packages/werkstatt-site/src/checks/semantic-fact-parity.ts",
  },
  {
    ruleId: "SECTION-SEM-01",
    contract: "Validate archetype catalog freshness and ensure every manifest archetype resolves to a known RFC-0072 archetype.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/archetype/registry-build.ts.",
    docRef: "packages/werkstatt-site/src/checks/archetype/registry-build.ts",
  },
  {
    ruleId: "SECTION-SEM-02",
    contract: "Validate archetype catalog freshness and ensure every manifest archetype resolves to a known RFC-0072 archetype.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/archetype/registry-build.ts.",
    docRef: "packages/werkstatt-site/src/checks/archetype/registry-build.ts",
  },
  {
    ruleId: "SECTION-SEM-03",
    contract: "Validate archetype catalog freshness and ensure every manifest archetype resolves to a known RFC-0072 archetype.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/archetype/registry-build.ts.",
    docRef: "packages/werkstatt-site/src/checks/archetype/registry-build.ts",
  },
  {
    ruleId: "SECTION-SEM-04",
    contract: "Validate archetype catalog freshness and ensure every manifest archetype resolves to a known RFC-0072 archetype.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/archetype/registry-build.ts.",
    docRef: "packages/werkstatt-site/src/checks/archetype/registry-build.ts",
  },
  {
    ruleId: "SECTION-SEM-05",
    contract: "Validate archetype catalog freshness and ensure every manifest archetype resolves to a known RFC-0072 archetype.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/archetype/registry-build.ts.",
    docRef: "packages/werkstatt-site/src/checks/archetype/registry-build.ts",
  },
  {
    ruleId: "SECTION-SEM-06",
    contract: "Validate archetype catalog freshness and ensure every manifest archetype resolves to a known RFC-0072 archetype.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/archetype/registry-build.ts.",
    docRef: "packages/werkstatt-site/src/checks/archetype/registry-build.ts",
  },
  {
    ruleId: "SEM-TARGET-03",
    contract: "Semantic target pageId \"…\" has no route for language \"…\".",
    action: "Add routes.… for \"…\" in system.md or remove the localized target.",
    docRef: "packages/werkstatt-site/src/checks/semantic-targets.ts",
  },
  {
    ruleId: "SEMANTIC-COVERAGE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/audit/validators/semantic-coverage.ts.",
    docRef: "packages/werkstatt-site/src/checks/audit/validators/semantic-coverage.ts",
  },
  {
    ruleId: "SERVICES-PROJ-01",
    contract: "…: service entry has slug '…' but no name field.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services-projection.ts.",
    docRef: "packages/werkstatt-site/src/checks/services-projection.ts",
  },
  {
    ruleId: "SERVICES-PROJ-02",
    contract: "Duplicate slug '…' in …: … and ….",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services-projection.ts.",
    docRef: "packages/werkstatt-site/src/checks/services-projection.ts",
  },
  {
    ruleId: "SERVICES-PROJ-03",
    contract: "business/…/services.md exists alongside business/…/services/ directory — ambiguous source. The projection reads from services/, not services.md.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/check-warpgogol.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/check-warpgogol.ts",
  },
  {
    ruleId: "SERVICES-PROJ-04",
    contract: "Duplicate projected service id '…' — two services resolve to the same id.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services-projection.ts.",
    docRef: "packages/werkstatt-site/src/checks/services-projection.ts",
  },
  {
    ruleId: "SINT-01",
    contract: "Section root must be <SectionShell>; <SectionShell> not found in file.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-02",
    contract: "Raw <section> element is forbidden; use <SectionShell> as the root.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-03",
    contract: "<SectionShell> used without matching import from @warpgogol/werkstatt-site/ui/components/section-shell.astro.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-04",
    contract: "Reference to the deleted VisualModifiers / visualModifierSchema is forbidden.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-05",
    contract: "Raw <… class=\"…\"> outside <SectionHeader> is forbidden; use <SectionHeader>.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-06",
    contract: "Raw <a class=\"btn ...\"> inside a section is forbidden; use <SectionCta> or <SectionCtaGroup>.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-07",
    contract: "Raw <Image> from astro:assets inside a section is forbidden; render images via <SectionImage>.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-08",
    contract: "Image prop used as raw URL — resolve through resolveImage(contentAssetImages, props.xxx, { lang }) instead.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-09",
    contract: "Section renders JSON.stringify(pageOverride) scaffold stub — replace with content-aware markup.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-10",
    contract: "<SectionShell> used without sectionId={...} prop — anchor navigation broken.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-11",
    contract: "Section uses <SectionShell> but does not call resolveSectionAnchor to compute sectionId.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-12",
    contract: "<SectionShell> used without lang={lang} prop.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-13",
    contract: "Section does not destructure sectionNumber from Astro.props.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-14",
    contract: "<SectionShell> used without sectionNumber={sectionNumber} prop.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-15",
    contract: "blocks-renderer.astro does not pass blockId={block.id ?? \"\"} to section components.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-16",
    contract: "blocks-renderer.astro does not compute and pass sectionNumber to section components.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-17",
    contract: "blocks-renderer.astro does not pass lang to section components.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-18",
    contract: "Element with data-count-up renders \"0\" as text content — external agents that don't execute JS see a misleading zero; the actual value must render as text content.",
    action: "Replace the 0 text content with the actual value expression (e.g. {props.overall.score}) — the count-up animation overwrites it via JS as progressive enhancement.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SINT-19",
    contract: "Astro file must start with --- frontmatter delimiter. Without it, the Astro compiler throws an opaque 'Unexpected token' error.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/section-framework/integrity.ts.",
    docRef: "packages/werkstatt-site/src/checks/section-framework/integrity.ts",
  },
  {
    ruleId: "SITE-SHELL-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-shell-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-shell-contract.ts",
  },
  {
    ruleId: "SITE-SHELL-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-shell-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-shell-contract.ts",
  },
  {
    ruleId: "SITE-SHELL-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-shell-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-shell-contract.ts",
  },
  {
    ruleId: "SITE-SHELL-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-shell-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-shell-contract.ts",
  },
  {
    ruleId: "SITE-SHELL-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-shell-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-shell-contract.ts",
  },
  {
    ruleId: "SITE-SHELL-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-shell-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-shell-contract.ts",
  },
  {
    ruleId: "SITE-SHELL-07",
    contract: "pages[] entry \"…\" binds an undeclared shell profile, or a routeProfiles pattern references an undeclared profile.",
    action: "Declare the profile in shellContract.profiles or remove the binding.",
    docRef: "packages/werkstatt-site/src/checks/site-shell-contract.ts",
  },
  {
    ruleId: "SITE-SHELL-08",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/site-shell-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/site-shell-contract.ts",
  },
  {
    ruleId: "SITEMAP-COV-01",
    contract: "Indexable page missing from sitemap: …",
    action: "Ensure the sitemap generator includes all indexable pages from system.md.",
    docRef: "packages/werkstatt-site/src/checks/sitemap-coverage.ts",
  },
  {
    ruleId: "SITEMAP-COV-02",
    contract: "Sitemap URL not in expected indexable set: …",
    action: "Verify this URL should be in the sitemap; if not, exclude it via output.sitemap: false.",
    docRef: "packages/werkstatt-site/src/checks/sitemap-coverage.ts",
  },
  {
    ruleId: "SITEMAP-GATED-LEAK-01",
    action: "Remove the page from system.md routes or set deployment.production: true; gated pages must not appear in the sitemap.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SITEMAP-PH-01",
    contract: "Sitemap URL contains unresolved placeholder: …",
    action: "Ensure the sitemap generator expands route templates into resolved slugs before emitting URLs.",
    docRef: "packages/werkstatt-site/src/checks/sitemap-placeholder.ts",
  },
  {
    ruleId: "SIZE-01",
    contract: "SIZE-01: flags a packages/** .ts/.tsx source file exceeding a 600-line threshold (warning 601-1200, error 1200+), against a shrink-only ratchet baseline. Pass --write-baseline to regenerate the baseline.",
    action: "Split the file into a sibling folder-of-files with a thin re-export shim, or shrink the baseline ceiling after review.",
    docRef: "packages/forge/os/core/handlers/file-size-lint.ts",
  },
  {
    ruleId: "SLA-DRIFT-01",
    contract: "Detect hardcoded SLA values in page content that duplicate PBP offering guarantee fields (RFC-1060). Fail-level: blocks builds when a string matches a PBP guarantee value but is not a =(business-profile...) expression.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/sla-pbp-reference.ts.",
    docRef: "packages/werkstatt-site/src/checks/sla-pbp-reference.ts",
  },
  {
    ruleId: "SLASH-01",
    contract: "Trailing-slash policy is 'always' but no _redirects file found — no normalization redirects configured.",
    action: "Add trailing-slash normalization rules to public/_redirects or configure normalization in the Worker fetch handler.",
    docRef: "packages/werkstatt-site/src/checks/trailing-slash.ts",
  },
  {
    ruleId: "SLASH-02",
    contract: "build.format is '…' but trailingSlash policy is 'always' — pages will be served at /path.html, not /path/.",
    action: "Set build.format to 'directory' in astro.config.mjs to match trailingSlash: always.",
    docRef: "packages/werkstatt-site/src/checks/trailing-slash.ts",
  },
  {
    ruleId: "SLASH-03",
    contract: "build.format is not explicitly set in astro.config.mjs — defaulting to 'directory' which matches trailingSlash: always, but explicit declaration is recommended.",
    action: "Set build: { format: 'directory' } in astro.config.mjs to explicitly declare the trailing-slash policy.",
    docRef: "packages/werkstatt-site/src/checks/trailing-slash.ts",
  },
  {
    ruleId: "SLASH-04",
    contract: "File extensions in public/ not excluded by isPageRoute: …. The Worker will 308-redirect these to trailing-slash URLs, causing 404s.",
    action: "Add the missing extensions to PAGE_ROUTE_EXCLUDED_EXTENSIONS in packages/werkstatt-shared/src/share/redirects.ts, then rerun agent.markdown-negotiation.generate.",
    docRef: "packages/werkstatt-site/src/checks/trailing-slash.ts",
  },
  {
    ruleId: "SMAP-01",
    contract: "Sitemap-included route … has no … mirror in the served dist.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/jsonld-schemamap.ts.",
    docRef: "packages/werkstatt-site/src/checks/jsonld-schemamap.ts",
  },
  {
    ruleId: "SMAP-02",
    contract: "Mirror … diverges from the captured @graph for ….",
    action: "Re-run jsonld.mirror.generate — mirrors are verbatim serializations of .cache/jsonld-expected.json.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SMAP-03",
    contract: "A generated mirror artifact is missing from, or diverges inside, the served dist.",
    action: "Run jsonld.mirror.generate after the build.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SMAP-04",
    contract: "public/_headers lacks: ….",
    action: "Re-run public.infrastructure.generate — the boilerplate emits these blocks when the agent surface is enabled.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SMAP-05",
    contract: "identity.domain is unset — schemamap.xml loc/jsonld URLs are emitted relative.",
    action: "Set identity.domain in src/content/system.md.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SMOKE-INIT-01",
    contract: "Async init function … attaches DOM event handlers via addEventListener but does not set a data-*-initialized attribute after the last handler. Smoke tests cannot reliably synchronize with this component.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/component-smoke-init-contract.ts.",
    docRef: "packages/werkstatt-site/src/checks/component-smoke-init-contract.ts",
  },
  {
    ruleId: "SNAP-02",
    contract: "No committed behavior.snapshot.generated.yaml exists for this app.",
    action: "Run: pnpm exec werkstatt run behavior.snapshot.generate --site <app>, then commit the file.",
    docRef: "packages/werkstatt-site/src/checks/behavior-snapshot.ts",
  },
  {
    ruleId: "SNUM-01",
    contract: "Numbered section \"…\" (block …) has no header.heading to render its section number. It consumes a number but the number is invisible.",
    action: "Add a header.heading to the block props, or set hideSectionNumber: true in block.props if the number should be suppressed.",
    docRef: "packages/werkstatt-site/src/checks/section-numbering.ts",
  },
  {
    ruleId: "SPEC-01",
    contract: "integrity.yaml not found.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-02",
    contract: "forge-spec.yaml schema violation: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-03",
    contract: "dependency cycle: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-04",
    contract: "dependsOn reference does not resolve: … (in node …)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-05",
    contract: "node … references wave … which does not exist.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-06",
    contract: "duplicate node id: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-07",
    contract: "materializedAs … for node … not found in …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-08",
    contract: "duplicate amendment id: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-09",
    contract: "amendment … targets document not found: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-10",
    contract: "accepted amendments … all target … — they compose additively; review that their changes do not contradict.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-11",
    contract: "accepted amendment … has no reviewers.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-12",
    contract: "node … declares an empty consumers list.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-13",
    contract: "consumer identity not configured — nodes declaring consumers cannot be owned locally: … (set project.consumer in forge.yaml or pass --consumer)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-validate.ts.",
    docRef: "packages/forge/os/spec/spec-validate.ts",
  },
  {
    ruleId: "SPEC-14",
    contract: "amendment … does not match forge/spec-amendment@1: (root): no frontmatter block.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/spec-amendments.ts.",
    docRef: "packages/forge/os/spec/spec-amendments.ts",
  },
  {
    ruleId: "STALE-01",
    action: "Remove this file: git rm …",
    docRef: "packages/werkstatt-site/src/checks/generated-stale-validate.ts",
  },
  {
    ruleId: "CANON-01",
    contract: "A sitemap URL is not in the expected canonical set.",
    action: "Regenerate sitemap with canonicalPageUrl.",
    docRef: "packages/werkstatt-site/src/checks/canonical-url.ts",
  },
  {
    ruleId: "CANON-02",
    contract: "A feed URL is not in the expected canonical set.",
    action: "Regenerate feed with canonicalPageUrl.",
    docRef: "packages/werkstatt-site/src/checks/canonical-url.ts",
  },
  {
    ruleId: "CANON-03",
    contract: "An llms.txt URL is not in the expected canonical set.",
    action: "Regenerate llms with canonicalPageUrl.",
    docRef: "packages/werkstatt-site/src/checks/canonical-url.ts",
  },
  {
    ruleId: "CANON-04",
    contract: "An HTML canonical href is not in the expected canonical set.",
    action: "Ensure pageUrl in resolve-route.ts uses canonicalPageUrl with trailingSlash: always.",
    docRef: "packages/werkstatt-site/src/checks/canonical-url.ts",
  },
  {
    ruleId: "STAMP-01",
    contract: "Sitemap lastmod for … is not a valid YYYY-MM-DD date: …",
    action: "Use a source-backed update stamp resolver.",
    docRef: "packages/werkstatt-site/src/checks/canonical-url.ts",
  },
  {
    ruleId: "STAMP-02",
    contract: "Sitemap lastmod for … is … but resolver expects …",
    action: "Regenerate sitemap with the update-stamp resolver.",
    docRef: "packages/werkstatt-site/src/checks/canonical-url.ts",
  },
  {
    ruleId: "STAMP-03",
    contract: "Sitemap lastmod values come from a source-backed update stamp — pages without one emit no lastmod.",
    action: "Remove lastmod from pages without a source-backed update stamp.",
    docRef: "packages/werkstatt-site/src/checks/canonical-url.ts",
  },
  {
    ruleId: "STAMP-04",
    contract: "An update stamp equals today's date — it may be the build date rather than a source-backed stamp.",
    action: "Ensure the update stamp comes from authored content, not new Date().",
    docRef: "packages/werkstatt-site/src/checks/canonical-url.ts",
  },
  {
    ruleId: "SUPPRESS-VAL-02",
    contract: "Config schema validation failed: …",
    action: "Ensure suppressions[] array is present with valid rules. Each rule requires ruleId, category, and reason.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SUPPRESS-VAL-03",
    contract: "Conflicting rule at index …: duplicate of rule at index …. Same ruleId + same conditions produces a no-op.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SUPPRESS-VAL-08",
    contract: "Rule at index … (ruleId: …) expired on …. It no longer applies — matching findings resurface as active. Remove the rule or extend expiresOn.",
    action: "Delete the rule, or extend expiresOn if the suppressed condition is still relevant.",
    docRef: "packages/werkstatt-site/src/checks/suppressions-validate.ts",
  },
  {
    ruleId: "SUPPRESS-VAL-09",
    contract: "Rule at index … (ruleId: …) is due for review (reviewAfter: …). The rule still applies — confirm it is still needed.",
    action: "Re-confirm the rule and bump reviewAfter, or set expiresOn if the condition is transient.",
    docRef: "packages/werkstatt-site/src/checks/suppressions-validate.ts",
  },
  {
    ruleId: "SUPPRESS-VAL-10",
    contract: "Rule at index … (ruleId: …) is category 'channel-noise' without expiresOn. Channel-noise suppressions mask transient measurement conditions and must carry an expiry date.",
    action: "Add expiresOn (and reviewAfter) so the rule cannot outlive the condition it masks.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SUPPRESS-VAL-11",
    contract: "Rule at index … (ruleId: …) has no reviewAfter — every suppression must schedule its re-confirmation.",
    action: "Add reviewAfter: <YYYY-MM-DD> to re-confirm the rule on schedule.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "SURF-DRIFT-01",
    contract: "agent.json missing or unparseable on the channel — interfaces.* cannot be enumerated.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/agent/agent-contract-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-contract-check.ts",
  },
  {
    ruleId: "SURF-DRIFT-02",
    contract: "… advertises … but it returned HTTP … on …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/agent/agent-contract-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-contract-check.ts",
  },
  {
    ruleId: "SURF-DRIFT-03",
    contract: "… returned non-JSON where the manifest declares a JSON document.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/agent/agent-contract-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-contract-check.ts",
  },
  {
    ruleId: "SURF-DRIFT-04",
    contract: "… probe incomplete — …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/agent/agent-contract-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-contract-check.ts",
  },
  {
    ruleId: "SURF-DRIFT-05",
    contract: "External contract check: replays the golden journey (discovery → knowledge → MCP → action → health) and probes every advertised interfaces.* endpoint for drift (RFC-1413) against a live deployed origin.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/agent/agent-contract-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-contract-check.ts",
  },
  {
    ruleId: "SURF-DRIFT-06",
    contract: "External contract check: replays the golden journey (discovery → knowledge → MCP → action → health) and probes every advertised interfaces.* endpoint for drift (RFC-1413) against a live deployed origin.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/agent/agent-contract-check.ts.",
    docRef: "packages/werkstatt-site/src/checks/agent/agent-contract-check.ts",
  },
  {
    ruleId: "SURFACE-01",
    contract: "README.md is … lines (…)",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/core/handlers/public-surface.ts.",
    docRef: "packages/forge/os/core/handlers/public-surface.ts",
  },
  {
    ruleId: "SURFACE-02",
    contract: "package.json missing engines.node.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/core/handlers/public-surface.ts.",
    docRef: "packages/forge/os/core/handlers/public-surface.ts",
  },
  {
    ruleId: "SURFACE-03",
    contract: "Check consistency between README.md, package.json, and docs/ structure.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/core/handlers/public-surface.ts.",
    docRef: "packages/forge/os/core/handlers/public-surface.ts",
  },
  {
    ruleId: "SURFACE-04",
    contract: "Check consistency between README.md, package.json, and docs/ structure.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/core/handlers/public-surface.ts.",
    docRef: "packages/forge/os/core/handlers/public-surface.ts",
  },
  {
    ruleId: "SURFACE-05",
    contract: "Required root files are missing — CONTRIBUTING.md, SECURITY.md, or CHANGELOG.md.",
    action: "Add the missing root files to the forge package root.",
    docRef: "packages/forge/os/core/handlers/public-surface.ts",
  },
  {
    ruleId: "SVC-NAME-01",
    contract: "Registry file not found at services/registry.yaml.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-naming-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-naming-validate.ts",
  },
  {
    ruleId: "SVC-NAME-02",
    contract: "Service '…': wrangler.jsonc name '…' must equal id '…'.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-naming-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-naming-validate.ts",
  },
  {
    ruleId: "SVC-NAME-03",
    contract: "Service '…': service.config.yaml id '…' must equal id '…'.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-naming-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-naming-validate.ts",
  },
  {
    ruleId: "SVC-NAME-04",
    contract: "Service '…': package.json name '…' must equal '…' or '…'.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-naming-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-naming-validate.ts",
  },
  {
    ruleId: "SVC-NAME-05",
    contract: "Service '…': directory services/…/ does not exist.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-naming-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-naming-validate.ts",
  },
  {
    ruleId: "SVC-NAME-06",
    contract: "Service '…': id must not end with '-worker' suffix. Rename to '…'.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-naming-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-naming-validate.ts",
  },
  {
    ruleId: "SVC-REG-01",
    contract: "Registry file not found at services/registry.yaml, or the registry file failed to parse.",
    action: "Create services/registry.yaml or fix its YAML syntax.",
    docRef: "packages/werkstatt-site/src/checks/services/service-registry-validate.ts",
  },
  {
    ruleId: "SVC-REG-02",
    contract: "No services: key found in registry. Add CF Worker service entries.",
    action: "Add a services: key with entries for each Cloudflare Worker service.",
    docRef: "packages/werkstatt-site/src/checks/services/service-registry-validate.ts",
  },
  {
    ruleId: "SVC-REG-03",
    contract: "Service entry missing required 'id' field.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-registry-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-registry-validate.ts",
  },
  {
    ruleId: "SVC-REG-04",
    contract: "The service registry declares a duplicate id or a duplicate workerName.",
    action: "Deduplicate the id/workerName entries in services/registry.yaml.",
    docRef: "packages/werkstatt-site/src/checks/services/service-registry-validate.ts",
  },
  {
    ruleId: "SVC-REG-05",
    contract: "Service '…' declares workerName '…' that must equal its id.",
    action: "Set workerName equal to the service id.",
    docRef: "packages/werkstatt-site/src/checks/services/service-registry-validate.ts",
  },
  {
    ruleId: "SVC-REG-06",
    contract: "Service '…': service.config.yaml not found at services/…/service.config.yaml.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-registry-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-registry-validate.ts",
  },
  {
    ruleId: "SVC-REG-07",
    contract: "Service '…': wrangler.jsonc not found — not a Cloudflare Worker service.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-registry-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-registry-validate.ts",
  },
  {
    ruleId: "SVC-REG-08",
    contract: "Service '…': healthProbes must be an array of probe declarations.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/services/service-registry-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/services/service-registry-validate.ts",
  },
  {
    ruleId: "tag-language-mismatch",
    contract: "i18n.supported[\"…\"].tag \"…\" language subtag \"…\" does not match the key's language subtag \"…\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/i18n-config-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/i18n-config-validate.ts",
  },
  {
    ruleId: "TEMPLATE-IMPORTS-01",
    contract: "A template import cannot be resolved — the imported package is unreadable or the specifier is wrong.",
    action: "Declare the imported package and keep it readable, or fix the import specifier.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/governance.ts",
  },
  {
    ruleId: "TEMPLATE-IMPORTS-02",
    contract: "pnpm install --frozen-lockfile failed: …",
    action: "Run pnpm install to sync the lockfile, then commit pnpm-lock.yaml.",
    docRef: "packages/werkstatt-site/src/checks/template-imports-validate.ts",
  },
  {
    ruleId: "TERM-01",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-site/src/checks/text-corpus/rules/terms.ts.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/terms.ts",
  },
  {
    ruleId: "TERM-03",
    contract: "term \"…\": pbpRef unresolved: …",
    action: "Fix the pbpRef or regenerate the index: pnpm exec werkstatt run content.ref-index.generate --site <id>.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/terms.ts",
  },
  {
    ruleId: "TERM-PAIR-01",
    contract: "…: mirrored section \"…\" contains source canonical.",
    action: "Use \"…\" for \"…\" in the … mirror, or narrow the term's routes/kinds scope if the divergence is intentional.",
    docRef: "packages/werkstatt-site/src/checks/translation-parity.ts",
  },
  {
    ruleId: "TERMS-DRIFT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "TERMS-DRIFT-02",
    contract: "…:… — =(…) resolves to no canonical business-profile field.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "TERMS-KIND-01",
    contract: "… — policy file slug \"…\" is a policy kind literal but declares kind \"…\" — re-tag or rename.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/pbp-terms-reference.ts.",
    docRef: "packages/werkstatt-site/src/checks/pbp-terms-reference.ts",
  },
  {
    ruleId: "TEST-DEPTH-01",
    contract: "Test file has zero expect() calls: …",
    action: "Add meaningful assertions that exercise behavior.",
    docRef: "packages/werkstatt-site/src/checks/test-depth-lint.ts",
  },
  {
    ruleId: "TEST-DEPTH-02",
    contract: "Test block \"…\" has zero expect() calls.",
    action: "Add assertions to \"…\" or remove if it is a setup/teardown hook.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/governance.ts",
  },
  {
    ruleId: "TEST-DEPTH-03",
    contract: "All assertions in … are trivial (toBeTruthy, toBeDefined, toBeNull, toBe(true), toBe(null), toHaveLength(0))",
    action: "Add assertions that verify specific behavior, not just existence.",
    docRef: "packages/werkstatt-site/src/checks/test-depth-lint.ts",
  },
  {
    ruleId: "TEST-DEPTH-04",
    contract: "Test file imports … name(s) but never calls any: …",
    action: "Use the imported functions/values in assertions, or remove unused imports.",
    docRef: "packages/werkstatt-site/src/checks/test-depth-lint.ts",
  },
  {
    ruleId: "TEST-DEPTH-05",
    contract: "Test block \"…\" imports … name(s) but never calls any: …",
    action: "Use the imported names in \"…\" or remove them.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/governance.ts",
  },
  {
    ruleId: "TEST-WEAKEN-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-06",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-07",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-08",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-09",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-10",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-weakening.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST-WEAKEN-11",
    contract: "A *.proof.yaml proof spec was weakened alongside an implementation change — statement changed, spec-set fields grown or shrunk in the weakening direction, or domain.cardinality dropped or shrunk.",
    action: "Restore the proof spec's original statement, spec-set fields, and cardinality, or remove the accompanying implementation change.",
    docRef: "packages/werkstatt-site/src/checks/test-weakening.ts",
  },
  {
    ruleId: "TEST.ADJACENCY-01",
    contract: "Scan all packages and services src directories for source files without adjacent test files.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "TEST.ADJACENCY-02",
    contract: "Scan all packages and services src directories for source files without adjacent test files.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/test-adjacency.ts.",
    docRef: "packages/werkstatt-site/src/checks/test-adjacency.ts",
  },
  {
    ruleId: "TEST.ADJACENCY-03",
    contract: "Load-verification stub: every expect() asserts only toBeDefined — …",
    action: "Delete the stub (structure does not require tests) or write a real behavioral test. A stub fakes coverage.",
    docRef: "packages/werkstatt-site/src/checks/test-adjacency.ts",
  },
  {
    ruleId: "TEST.SIGNAL.VALIDATE",
    contract: "… test signal is …: …",
    action: "Honor the reported requiredAction for the package's test signal, or keep it explicitly skipped.",
    docRef: "packages/werkstatt-site/src/checks/test-signal.ts",
  },
  {
    ruleId: "TPL-DRIFT-01",
    contract: "TPL-DRIFT-01: command \"…\" in template … is missing generates[] entry \"…\" that exists in command-tables.",
    action: "Add generates: [{ path: \"…\", ... }] to the \"…\" registration in ….",
    docRef: "packages/werkstatt-site/src/checks/template-command-drift-validate.ts",
  },
  {
    ruleId: "TPL-DRIFT-02",
    contract: "TPL-DRIFT-02: command \"…\" in template … is missing modulePath that exists in command-tables (\"…\").",
    action: "Add modulePath: \"…\" to the \"…\" registration in ….",
    docRef: "packages/werkstatt-site/src/checks/template-command-drift-validate.ts",
  },
  {
    ruleId: "TPL-DRIFT-03",
    contract: "TPL-DRIFT-03: command \"…\" in template … is missing writes[] entry \"…\" that exists in command-tables.",
    action: "Add \"…\" to the writes array of \"…\" in ….",
    docRef: "packages/werkstatt-site/src/checks/template-command-drift-validate.ts",
  },
  {
    ruleId: "TS-BARREL-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/barrel-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/barrel-validate.ts",
  },
  {
    ruleId: "TS-BARREL-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/barrel-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/barrel-validate.ts",
  },
  {
    ruleId: "TS-EXPORTS-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/package-exports-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/package-exports-validate.ts",
  },
  {
    ruleId: "TS-IMPORT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/import-boundaries-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/import-boundaries-validate.ts",
  },
  {
    ruleId: "TS-IMPORT-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/import-boundaries-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/import-boundaries-validate.ts",
  },
  {
    ruleId: "TS-PHANTOM-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/phantom-deps-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/phantom-deps-validate.ts",
  },
  {
    ruleId: "TS-STRICT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/strict-mode-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/strict-mode-validate.ts",
  },
  {
    ruleId: "TS-STRICT-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/strict-mode-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/strict-mode-validate.ts",
  },
  {
    ruleId: "TS-STRICT-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/strict-mode-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/strict-mode-validate.ts",
  },
  {
    ruleId: "TS-TSCONFIG-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/tsconfig-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/tsconfig-validate.ts",
  },
  {
    ruleId: "TS-TSCONFIG-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/tsconfig-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/tsconfig-validate.ts",
  },
  {
    ruleId: "TS-TSCONFIG-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/tsconfig-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/tsconfig-validate.ts",
  },
  {
    ruleId: "TS-TSCONFIG-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/tsconfig-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/tsconfig-validate.ts",
  },
  {
    ruleId: "TS-TSCONFIG-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-typescript/src/checks/tsconfig-validate.ts.",
    docRef: "packages/werkstatt-typescript/src/checks/tsconfig-validate.ts",
  },
  {
    ruleId: "TYPO-APOS-03",
    contract: "Copy uses a wrong apostrophe variant — the Uzbek apostrophe after o/g must be ʻ (U+02BB).",
    action: "Replace the wrong apostrophe variant with the canonical U+02BB form.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-APOS-04",
    contract: "Uzbek glottal stop should be ʼ (U+02BC): \"…\" — tutuq belgisi is a letter, not a quote.",
    action: "Apply the remediation described for this ruleId in packages/werkstatt-shared/src/typography/rules-tier2-locale.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier2-locale.ts",
  },
  {
    ruleId: "TYPO-CASE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-CASE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-HEAD-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier2-structure.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier2-structure.ts",
  },
  {
    ruleId: "TYPO-HEAD-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier2-structure.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier2-structure.ts",
  },
  {
    ruleId: "TYPO-HEAD-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-HEAD-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/fix.ts.",
    docRef: "packages/werkstatt-shared/src/typography/fix.ts",
  },
  {
    ruleId: "TYPO-LOCALE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier1.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier1.ts",
  },
  {
    ruleId: "TYPO-LOCALE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier1.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier1.ts",
  },
  {
    ruleId: "TYPO-LOCALE-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier1.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier1.ts",
  },
  {
    ruleId: "TYPO-MD-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-MD-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-MD-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier2-structure.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier2-structure.ts",
  },
  {
    ruleId: "TYPO-PAIR-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier2-structure.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier2-structure.ts",
  },
  {
    ruleId: "TYPO-PAIR-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-PAIR-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-PUNCT-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-PUNCT-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier1.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier1.ts",
  },
  {
    ruleId: "TYPO-PUNCT-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-PUNCT-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-SPACE-01",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-SPACE-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/fix.ts.",
    docRef: "packages/werkstatt-shared/src/typography/fix.ts",
  },
  {
    ruleId: "TYPO-SPACE-03",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-SPACE-04",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-shared/src/typography/rules-tier1.ts.",
    docRef: "packages/werkstatt-shared/src/typography/rules-tier1.ts",
  },
  {
    ruleId: "TYPO-YAML-01",
    contract: "Frontmatter does not parse: …",
    action: "Fix the YAML syntax error in the frontmatter.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "TYPO-YAML-02",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/typography.ts.",
    docRef: "packages/werkstatt-site/src/checks/typography.ts",
  },
  {
    ruleId: "UTIL-PROV-01",
    contract: "Forbidden import '…' outside canonical path '…'. Use @warpgogol/werkstatt-shared/… instead.",
    action: "Import from @warpgogol/werkstatt-shared/…, or add an allowlist entry with a reason in utility-registry.yaml.",
    docRef: "packages/werkstatt-site/src/checks/utility-provenance.ts",
  },
  {
    ruleId: "UTIL-PROV-02",
    contract: "Function name '…' outside canonical path '…'. Use @warpgogol/werkstatt-shared/… instead.",
    action: "Import from @warpgogol/werkstatt-shared/…, or add an allowlist entry with a reason in utility-registry.yaml.",
    docRef: "packages/werkstatt-site/src/checks/utility-provenance.ts",
  },
  {
    ruleId: "UTIL-PROV-03",
    contract: "Pattern '…' detected outside canonical path '…': …",
    action: "Import from @warpgogol/werkstatt-shared/…, or add an allowlist entry with a reason in utility-registry.yaml.",
    docRef: "packages/werkstatt-site/src/checks/utility-provenance.ts",
  },
  {
    ruleId: "UTIL-REG-01",
    contract: "Utility registry missing or invalid YAML. Cannot validate utility provenance.",
    action: "Create packages/werkstatt-shared/utility-registry.yaml with a 'utilities' array.",
    docRef: "packages/werkstatt-site/src/checks/utility-provenance.ts",
  },
  {
    ruleId: "UTIL-REG-02",
    contract: "Invalid regex in registry for pattern '…' (utility: …): …",
    action: "Fix the regex syntax in utility-registry.yaml.",
    docRef: "packages/werkstatt-site/src/checks/utility-provenance.ts",
  },
  {
    ruleId: "V-LS-01",
    contract: "…: no valid frontmatter block.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "V-LS-02",
    contract: "…: missing required field \"…\".",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "V-LS-03",
    contract: "…: lastMergedRfc \"…\" is not an archived RFC.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "V-LS-04",
    contract: "…: history entry \"…\" is not an archived RFC.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "V-LS-05",
    contract: "duplicate domain \"…\" found in multiple files.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "V-LS-06",
    contract: "…: duplicate section \"…\" (occurrence …) — repair via spec.live.rebuild.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "V-LS-07",
    contract: "…: history contains … entries for \"…\" — repair via spec.live.rebuild.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "V-LS-08",
    contract: "…: living spec for domain \"…\" does not exist — repair via spec.live.merge --id …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "V-LS-09",
    contract: "…: history entry \"…\" unreadable, not implemented, or lacks ## Design — excluded from replay.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/forge/os/spec/live-spec-validate.ts.",
    docRef: "packages/forge/os/spec/live-spec-validate.ts",
  },
  {
    ruleId: "VALIDATOR-CONTRACT-MISSING",
    contract: "Every validator command declares a contract tag grouping it with validators enforcing the same surface (RFC-0963).",
    action: "Add a contract tag to the command's KernelCommandDefinition.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "VALIDATOR-RULES-MISSING",
    contract: "Every validator command declares the rule IDs it can emit (RFC-0963).",
    action: "Add the rules[] declaration to the command's KernelCommandDefinition.",
    docRef: "packages/werkstatt-engine/src/runtime/validate-declarations.ts",
  },
  {
    ruleId: "VIS-BG-01",
    action: "Run with --site <id> or from inside an app directory.",
    docRef: "packages/werkstatt-site/src/checks/visual/index.ts",
  },
  {
    ruleId: "VIS-REG-01",
    contract: "… — visual regression confirmed by reviewer: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/visual-regression/types.ts.",
    docRef: "packages/werkstatt-site/src/checks/visual-regression/types.ts",
  },
  {
    ruleId: "VIS-REG-02",
    contract: "… — flagged but unreviewable (…); ship requires explicit waiver.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/visual-regression/types.ts.",
    docRef: "packages/werkstatt-site/src/checks/visual-regression/types.ts",
  },
  {
    ruleId: "VIS-REG-04",
    contract: "visual baseline manifest missing for release …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/visual-regression/baseline.ts.",
    docRef: "packages/werkstatt-site/src/checks/visual-regression/baseline.ts",
  },
  {
    ruleId: "VIS-REG-05",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/visual-regression/types.ts.",
    docRef: "packages/werkstatt-site/src/checks/visual-regression/types.ts",
  },
  {
    ruleId: "VITE-CLIENT-DEP-01",
    contract: "RFC-0955: Validate that client-side dependencies resolve to browser-compatible entry points.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/vite-client-deps-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/vite-client-deps-validate.ts",
  },
  {
    ruleId: "VITE-CLIENT-DEP-02",
    contract: "RFC-0955: Validate that client-side dependencies resolve to browser-compatible entry points.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/vite-client-deps-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/vite-client-deps-validate.ts",
  },
  {
    ruleId: "VITE-CLIENT-DEP-03",
    contract: "RFC-0955: Validate that client-side dependencies resolve to browser-compatible entry points.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/vite-client-deps-validate.ts.",
    docRef: "packages/werkstatt-site/src/checks/vite-client-deps-validate.ts",
  },
  {
    ruleId: "WALK-01",
    contract: "Nested recursive readdir walker declared outside the canonical @warpgogol/werkstatt-shared/node/fs module.",
    action: "Import { collectFiles } from \"@warpgogol/werkstatt-shared/node/fs\" instead of declaring a local walk() function.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/core-infra.ts",
  },
  {
    ruleId: "WDL-00",
    contract: "Could not read site-kernel-checks/src/: …",
    action: "Ensure packages/os/site-kernel-checks/src/ exists and is readable.",
    docRef: "packages/werkstatt-site/src/checks/warning-diagnostics-lint.ts",
  },
  {
    ruleId: "WDL-01",
    contract: "Warning-like findings appear as source prose, string arrays, or passResult summary text instead of canonical Diagnostics.",
    action: "Emit a Diagnostic with severity warning/info via diagnosticsResult, or add a local warning-diagnostics-ok suppression.",
    docRef: "packages/werkstatt-site/src/checks/warning-diagnostics-lint.ts",
  },
  {
    ruleId: "WERK-01",
    contract: "Werk record fails schema or anchored provenance: …",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "WERK-02",
    contract: "Werk \"…\" is publishable but lacks client approval.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/surface-demand.ts.",
    docRef: "packages/werkstatt-site/src/checks/surface-demand.ts",
  },
  {
    ruleId: "WERK-04",
    contract: "Werk \"…\" media \"…\" lacks an RFC-0220 credit reference.",
    action: "Resolve the reported violation — the enforced contract is declared in packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/content-surface.ts",
  },
  {
    ruleId: "WS-WRITE-01",
    contract: "Command `…` (reachable from an APPS_* pipeline) writes `…`, which is outside apps/<app>/, but is not declared on SHARED_WRITE_ALLOWLIST.",
    action: "Add a SharedWriteEntry for the command to SHARED_WRITE_ALLOWLIST in packages/werkstatt-site/src/checks/workspace-write-boundary.ts, and migrate its write to writeFileAtomic from @warpgogol/werkstatt-engine/kernel (RFC-0258).",
    docRef: "packages/werkstatt-site/src/checks/workspace-write-boundary.ts",
  },
  {
    ruleId: "XLINK-01",
    contract: "Default-language content links to \"…\" — default-language routes must not carry a language prefix. Use \"…\" instead.",
    action: "Remove the \"/…/\" prefix from the URL. The default language is unprefixed per RFC-0160.",
    docRef: "packages/werkstatt-site/src/checks/content-xlinks.ts",
  },
  {
    ruleId: "XLINK-02",
    contract: "Display-text URL path \"…\" differs from href URL path \"…\".",
    action: "Make the display text match the href URL. Use \"…\" in the display text, or change the href to match.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "XLINK-03",
    contract: "URL path \"…\" uses language prefix \"/…/\" with slug \"…\" from a different language. Use the correct slug for language \"…\".",
    action: "Check the route registry in system.md for the correct \"…\" slug. The slug \"…\" belongs to another language.",
    docRef: "packages/werkstatt-site/src/checks/diagnostics/rules/migrated-checks.ts",
  },
  {
    ruleId: "XLINK-04",
    contract: "Full URL path \"…\" does not resolve to a known route in system.md.",
    action: "Check the route slug in system.md or remove the link if it is no longer needed.",
    docRef: "packages/werkstatt-site/src/checks/content-xlinks.ts",
  },
  {
    ruleId: "YAML-CONTRACT-01",
    contract: "JSON file is not in the tool-mandatory whitelist. Use .yaml instead.",
    action: "Convert to … or add to … if tool-mandatory.",
    docRef: "packages/werkstatt-site/src/checks/yaml-contract-lint.ts",
  },
  {
    ruleId: "YAML-CONTRACT-02",
    contract: "File uses .yml extension. Use .yaml instead.",
    action: "Rename … to … or add to … if tool-mandatory.",
    docRef: "packages/werkstatt-site/src/checks/yaml-contract-lint.ts",
  },
  {
    ruleId: "YAML-CONTRACT-03",
    contract: "Generated artifact uses .json extension. Use .generated.yaml instead.",
    action: "Run the owning generator to produce … and delete the stale .json file.",
    docRef: "packages/werkstatt-site/src/checks/yaml-contract-lint.ts",
  },
  {
    ruleId: "YAML-CONTRACT-04",
    contract: "Whitelist file is missing or unparseable.",
    action: "Create … at the repository root with categorized tool-mandatory JSON file patterns.",
    docRef: "packages/werkstatt-site/src/checks/yaml-contract-lint.ts",
  },
  {
    ruleId: "YAML-CONTRACT-05",
    contract: "YAML file contains JSON content (starts with '…'). Use YAML syntax instead.",
    action: "Rewrite … using YAML block-style syntax (key: value, lists with -).",
    docRef: "packages/werkstatt-site/src/checks/yaml-contract-lint.ts",
  },
  {
    ruleId: "REMEDIATION-05",
    contract:
      "REMEDIATION_CATALOG contract/action text is real authored prose — no template-literal fragments, mid-word ellipsis cuts, or truncated tails print as the remedy.",
    action:
      "Rewrite the flagged contract/action as a complete authored sentence naming the violated contract or the fix — see the emission message at the entry's docRef for the authoritative wording.",
    docRef: "packages/werkstatt-engine/src/remediation/remediation-hint-validate.ts",
  },
  {
    ruleId: "A11Y-AXE-01",
    contract:
      "Every probed route is free of axe violations at or above the blockOn severity threshold — the diagnostic names route, axe rule, impact, and target selector.",
    action:
      "Fix the reported axe violation — route, ruleId, and target selector are in data.findings; the fixHint carries the rule's help URL — then re-run the pipeline.",
    docRef: "packages/werkstatt-site/src/checks/a11y-axe-probe.ts",
  },
  {
    ruleId: "A11Y-AXE-02",
    contract:
      "Every probed route completes its render/axe pass — hung pages and non-200 responses fail that route instead of stalling the gate.",
    action:
      "Reproduce the route render locally (the diagnostic names the route and the thrown error), fix the hang or error response, then re-run the probe.",
    docRef: "packages/werkstatt-site/src/checks/a11y-axe-probe.ts",
  },
  {
    ruleId: "A11Y-AXE-04",
    contract:
      "Chromium resolves before scanning — a missing browser is an error never demoted by --warn-only; a missing @syrokomskyi/axiom-study severity mapping degrades to an inert warning by design.",
    action:
      "Run `werkstatt run playwright.chromium.ensure` for the pinned playwright version and install the axiom link deps so severityForAxeImpact resolves, then re-run the probe.",
    docRef: "packages/werkstatt-site/src/checks/a11y-axe-probe.ts",
  },
  {
    ruleId: "DIST_MISSING",
    contract: "no built output at dist/client for … — run build.post first",
    action: "Run the site's build (build.post) so dist/client exists, then re-run the probe.",
    docRef: "packages/werkstatt-site/src/checks/a11y-axe-probe.ts",
  },
  {
    ruleId: "CONTRACT-05",
    contract: "The translation contract is approved but has never been reviewed, or its last review is older than reviewIntervalDays.",
    action: "Run translation.contract.review --approve to stamp the review.",
    docRef: "packages/werkstatt-site/src/checks/translation-contract.ts",
  },
  {
    ruleId: "CONTRACT-06",
    contract: "… rendered PBP label value(s) lack a contract term.",
    action: "Add a contract term for each uncovered label value.",
    docRef: "packages/werkstatt-site/src/checks/translation-contract.ts",
  },
  {
    ruleId: "CONTRACT-07",
    contract: "retired translation carriers still present: …",
    action: "Migrate with translation.contract.scaffold, then delete the legacy files/dirs.",
    docRef: "packages/werkstatt-site/src/checks/translation-contract.ts",
  },
  {
    ruleId: "CJ-CHAIN-05",
    contract: "payloadMac checks skipped — pass --project-key to verify payload integrity.",
    action: "Re-run the chain validator with --project-key so payloadMac verification executes.",
    docRef: "packages/werkstatt-journal/src/validators/chain.ts",
  },
  {
    ruleId: "TRUNC-01",
    contract: "A findings list was capped — the marker names the true total and the applied cap.",
    action: "Resolve the listed findings to shrink the list below its cap.",
    docRef: "packages/werkstatt-shared/src/kernel/diagnostic-cap.ts",
  },
  {
    ruleId: "GRAM-02",
    contract: "A grammar-baseline entry no longer occurs — the baseline holds a stale fixed finding.",
    action: "Run text.corpus.validate --grammar-baseline-prune --site <id> to drop stale entries.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/grammar.ts",
  },
  {
    ruleId: "GRAM-05",
    contract: "LANGUAGETOOL_URL is not set — grammar and orthography are not checked.",
    action: "Start a local LanguageTool (docs/runbooks/languagetool.md) and set LANGUAGETOOL_URL.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/grammar.ts",
  },
  {
    ruleId: "LEAK-LANG-01",
    contract: "Foreign-language rendered text appears in a page without a lang marker.",
    action: "Translate the string in its source file, or wrap the element with lang when the foreign text is intentional.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/leaks.ts",
  },
  {
    ruleId: "LEAK-INTERNAL-01",
    contract: "Pipeline vocabulary is rendered in visitor-visible text.",
    action: "Rephrase without pipeline vocabulary, or allow-list the token in system.md typography.allowedTokens.",
    docRef: "packages/werkstatt-site/src/checks/text-corpus/rules/leaks.ts",
  },
  {
    ruleId: "A11Y-AXE-03",
    contract: "no probeable routes derived for … — the pre-deploy axe gate is inert.",
    action: "Restore probeable routes (fix the build output or route derivation) so the axe gate exercises real pages.",
    docRef: "packages/werkstatt-site/src/checks/a11y-axe-probe.ts",
  },
  {
    ruleId: "EFF-REDUNDANT-01",
    contract: "A full-strength lighten veil is redundant under textBackdrop: plate.",
    action: "Drop the lighten entry from the effects block.",
    docRef: "packages/werkstatt-site/src/checks/effects-contract.ts",
  },
  {
    ruleId: "ENSURE-01",
    contract: "Command … declares ensure target … — no such registered command, or the target is neither read-only (mutatesState: false) nor idempotent (rerun-safe).",
    action: "Register the ensure target, or point the ensure at a registered command that is read-only or declared rerun-safe.",
    docRef: "packages/werkstatt-site/src/checks/command-manifest-validate.ts",
  },
  {
    ruleId: "ENSURE-02",
    contract: "Command … declares ensure … with when … — no matching key in its ensureConditions.",
    action: "Add the named resolver to the command's ensureConditions map or drop the when clause.",
    docRef: "packages/werkstatt-site/src/checks/command-manifest-validate.ts",
  },
  {
    ruleId: "ENSURE-03",
    contract: "ensure … failed — prerequisite could not be prepared.",
    action: "Run the failing ensure command directly to see its diagnostics, fix the prerequisite it could not satisfy, then re-run the declaring command.",
    docRef: "packages/werkstatt-engine/src/kernel/runtime/execute-command.ts",
  },
  {
    ruleId: "ENSURE-04",
    contract: "A declared ensure could not be resolved at runtime — unregistered or non-preparable target, unresolvable when condition, or an ensure cycle.",
    action: "Fix the ensure declaration so its target resolves and its when names a key in ensureConditions, then re-run.",
    docRef: "packages/werkstatt-engine/src/kernel/runtime/execute-command.ts",
  },
  {
    ruleId: "GATE-CMP-02",
    contract: "step … threw during a composite gate run.",
    action: "Fix the throwing step or catch the error inside it — the gate records the throw as a fail and continues, so the exception text is the defect.",
    docRef: "packages/werkstatt-shared/src/kernel/composite-gate.ts",
  },
  // --- Deploy channel migration (RFC-1492) ---------------------------------
  {
    ruleId: "CHANNEL-01",
    contract: "A site's system-config.yaml or system-state.yaml still names the legacy deploy channel main at the flagged key path.",
    action:
      "Run werkstatt run sternsystem.channels.migrate --id <site> — it renames the key to prod in the cache clone and commits; until then every registry reader refuses the site (never patch the file by hand).",
    docRef:
      "docs/rfcs/rfc-1492-werkstatt-rename-the-production-deploy-channel-main-to-prod.md",
    targetFiles: [
      "../systems-cache/<id>/system-config.yaml",
      "../systems-cache/<id>/system-state.yaml",
    ],
  },
  {
    ruleId: "CHANNEL-MIGRATE-01",
    contract: "sternsystem.channels.migrate received both --id and --all, or neither.",
    action: "Re-run with exactly one selector — werkstatt run sternsystem.channels.migrate --id <site> or --all.",
    docRef:
      "docs/rfcs/rfc-1492-werkstatt-rename-the-production-deploy-channel-main-to-prod.md",
  },
  {
    ruleId: "CHANNEL-MIGRATE-02",
    contract: "A channel file carries both main and prod at the same key path — the migrate refuses to merge.",
    action:
      "Resolve the conflict manually in the flagged file (keep the prod value, delete the main key), then re-run werkstatt run sternsystem.channels.migrate --id <site>.",
    docRef:
      "docs/rfcs/rfc-1492-werkstatt-rename-the-production-deploy-channel-main-to-prod.md",
  },
  {
    ruleId: "CHANNEL-MIGRATE-03",
    contract: "The site is not migratable right now — an open mission, an in-flight ship op, or a dirty cache clone.",
    action:
      "Close the mission (werkstatt run mission.close), wait for the ship op to finish, or sweep the cache clone (werkstatt run sternsystem.sync --id <site>), then re-run the migrate.",
    docRef:
      "docs/rfcs/rfc-1492-werkstatt-rename-the-production-deploy-channel-main-to-prod.md",
  },
  {
    ruleId: "CHANNEL-MIGRATE-04",
    contract: "A write, git, or passport step of the migrate exited non-zero.",
    action:
      "Read the failed step in the diagnostic, fix it (permissions, git identity, signing key), and re-run — the rename is idempotent and resumes from whatever already committed.",
    docRef:
      "docs/rfcs/rfc-1492-werkstatt-rename-the-production-deploy-channel-main-to-prod.md",
  },
  {
    ruleId: "CHANNEL-MIGRATE-05",
    contract: "The site has passport.json but neither SIGNING_PRIVATE_KEY nor SIGNING_PRIVATE_KEY_PATH resolves — an unsigned passport would fail PASSPORT-02 after the rename.",
    action:
      "Provide the signing key (workshop .env or exported SIGNING_PRIVATE_KEY) and re-run werkstatt run sternsystem.channels.migrate --id <site>.",
    docRef:
      "docs/rfcs/rfc-1492-werkstatt-rename-the-production-deploy-channel-main-to-prod.md",
  },
  {
    ruleId: "PLATFORM-ID-01",
    contract: "The platform identity (release-line version + checkout SHA) must be readable before the fingerprints contract may emit — a partial fingerprint must never reach flow.cut.",
    action:
      "Inspect the reported read failure and re-run werkstatt run platform.identity --json to confirm the identity resolves, then re-run the fingerprints emit.",
    docRef:
      "docs/rfcs/rfc-1493-werkstatt-platform-identity-from-release-tags-and-commits-site-pins-compared-by-migrator-cursor.md",
  },
  {
    ruleId: "PLATFORM-ID-02",
    contract: "A release fingerprint is a property of the committed platform tree only — a modified or untracked-not-ignored file under packages/, integrations/ or services/ must never enter the tag annotation.",
    action:
      "Commit or remove the listed files, then re-run flow.cut — the hook re-runs platform.identity --fingerprints on the cleaned tree.",
    docRef:
      "docs/rfcs/rfc-1496-werkstatt-release-fingerprints-from-the-committed-platform-tree.md",
  },
  {
    ruleId: "PLATFORM-ID-03",
    contract: "A release fingerprint belongs to the release commit — the checkout must sit at the --at sha flow.cut passes so the tag annotates the tree it names.",
    action:
      "Check out the release commit and re-run flow.cut — it runs the hook in the primary on develop's tip, so integrate first when the session is not merged yet.",
    docRef:
      "docs/rfcs/rfc-1496-werkstatt-release-fingerprints-from-the-committed-platform-tree.md",
  },
  {
    ruleId: "PROD-PLATFORM-01",
    contract: "A production deployment must only run on platform commits already integrated into develop — patch-identity (git cherry) semantics, never ancestry.",
    action:
      "Integrate the session so its platform patches land on develop (werkstatt run flow.integrate), then re-run werkstatt run release.prepare to record the integrated HEAD as platformCommit before shipping.",
    docRef:
      "docs/rfcs/rfc-1494-werkstatt-production-deploys-only-from-integrated-platform-commits.md",
  },
  {
    ruleId: "PROD-PLATFORM-02",
    contract: "Production deployments stay permitted while platform patches are integrated into local develop but not yet pushed — the warning prevents silent provenance loss, never blocks.",
    action:
      "Push develop so origin/develop carries the platform commits and the warning clears on the next preflight.",
    docRef:
      "docs/rfcs/rfc-1494-werkstatt-production-deploys-only-from-integrated-platform-commits.md",
  },
  {
    ruleId: "PROD-PLATFORM-03",
    contract: "A production deployment must never run on a dirty platform tree — uncommitted changes under the platform source paths falsify the recorded platformCommit.",
    action:
      "Commit or revert the dirty platform paths, then re-run werkstatt run release.prepare to re-record platformCommit and platformDirty before shipping.",
    docRef:
      "docs/rfcs/rfc-1494-werkstatt-production-deploys-only-from-integrated-platform-commits.md",
  },
  {
    ruleId: "PROD-PLATFORM-04",
    contract: "Every release manifest must record platformCommit so production deploys can prove platform patches are integrated — a missing pin fails closed.",
    action:
      "Re-run werkstatt run release.prepare to write platformCommit into release.yaml, then re-run the production gate.",
    docRef:
      "docs/rfcs/rfc-1494-werkstatt-production-deploys-only-from-integrated-platform-commits.md",
  },
  {
    ruleId: "EC-28",
    contract: "A gate-isolation snapshot directory from a dead process blocks the next commit until the swept worktree state is restored and the snapshot removed.",
    action:
      "Recover the snapshot with werkstatt run ecosystem.commit --restore-isolation <nonce> — it re-applies the captured patch, moves the swept untracked files back, verifies and removes the snapshot directory. A live-holder snapshot must be left alone (its commit is still inside the gate window).",
    docRef:
      "docs/rfcs/rfc-1506-werkstatt-commit-gate-isolation-without-git-stash.md",
  },
  {
    ruleId: "WT-GATE-06",
    contract: "A changed range that touches a declared cold-e2e input must pass that e2e under its own budget — a failure or timeout blocks integration.",
    action:
      "Fix the failing e2e in the session worktree (re-run it via the reproduce line in the check detail), or narrow the changed range away from the e2e's declared @scoped-gate inputs, then re-run the gate.",
    docRef:
      "docs/rfcs/rfc-1507-werkstatt-scoped-gates-always-run-ratchet-scans-and-run-the-cold-e2e-as-its-own-gate.md",
  },
];

export const REMEDIATION_CATALOG: ReadonlyMap<string, RemediationPattern> = new Map(
  REMEDIATION_ENTRIES.map((entry) => [entry.ruleId, entry]),
);

// RFC-1466: authored fragment — scar.migrate lands remedies here; a
// diagnosticCode → remedy lookup must see them at failure time (RFC-1461
// channel). Fail-open, mtime-keyed memoization on cwd.
const FRAGMENT_REL = join("docs", "remediation-catalog.custom.yaml");
// The kernel may be invoked from any subdirectory — resolve the workspace
// root by walking up to the nearest ancestor carrying forge.yaml (ADR-0089:
// never trust bare process.cwd()).
function resolveFragmentPath(): string | null {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 16; i++) {
    if (existsSync(join(dir, "forge.yaml"))) {
      const candidate = join(dir, FRAGMENT_REL);
      return existsSync(candidate) ? candidate : null;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

let fragmentCache: { path: string; mtimeMs: number; map: Map<string, RemediationPattern> } | null = null;

function fragmentRemedies(): Map<string, RemediationPattern> {
  const p = resolveFragmentPath();
  if (p === null) {
    fragmentCache = null;
    return new Map();
  }
  let mtimeMs: number;
  try {
    mtimeMs = statSync(p).mtimeMs;
  } catch {
    fragmentCache = null;
    return new Map();
  }
  if (fragmentCache?.path === p && fragmentCache.mtimeMs === mtimeMs) return fragmentCache.map;
  const map = new Map<string, RemediationPattern>();
  try {
    const parsed = yamlParse(readFileSync(p, "utf8")) as {
      entries?: { id?: unknown; ruleText?: unknown; diagnosticCodes?: unknown; migratedFrom?: unknown }[];
    } | null;
    for (const e of parsed?.entries ?? []) {
      if (typeof e?.id !== "string" || typeof e?.ruleText !== "string") continue;
      const pattern: RemediationPattern = {
        ruleId: e.id,
        action: e.ruleText,
        ...(typeof e.migratedFrom === "string" ? { docRef: e.migratedFrom } : {}),
      };
      map.set(e.id, pattern);
      if (Array.isArray(e.diagnosticCodes)) {
        for (const code of e.diagnosticCodes) {
          if (typeof code === "string") map.set(code, { ...pattern, ruleId: code });
        }
      }
    }
  } catch {
    /* malformed fragment — fail open */
  }
  fragmentCache = { path: p, mtimeMs, map };
  return map;
}

export function lookupRemediation(ruleId: string): RemediationPattern | undefined {
  return REMEDIATION_CATALOG.get(ruleId) ?? fragmentRemedies().get(ruleId);
}
