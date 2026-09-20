/*
<MODULE_CONTRACT>
<purpose>
RFC-1115: single rendering point for model-oriented capability descriptions.
Composes the authored base description with the optional agentGuidance block
(whenToUse, whenNotToUse, sideEffect, retrySemantics) into a multi-sentence
description consumed verbatim by MCP tools/list and OpenAPI operation docs.
</purpose>
<non-goals>
  <item>Do not restate the RFC-1112 Idempotency-Key mechanism — retrySemantics
        text is authored in capability YAMLs and passed through unchanged.</item>
  <item>Do not localize — callers pick the base description language; guidance
        fields are authored in English by design (capability YAMLs are global,
        not per-site) — English is the model-facing lingua franca.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1115: initial — renderAgentGuidanceDescription composer.</item>
</CHANGE_SUMMARY>
*/

import type { CapabilityRecord } from "@warpgogol/werkstatt-shared/ontology";

/** The optional agentGuidance block on a capability record (RFC-1115). */
export type CapabilityAgentGuidance = NonNullable<CapabilityRecord["agentGuidance"]>;

/**
 * Compose a tool/operation description from the base description and the
 * optional agentGuidance block. Guidance absent → the base description is
 * returned unchanged (AC-5 fallback).
 */
export function renderAgentGuidanceDescription(
  base: string,
  guidance: CapabilityAgentGuidance | undefined,
): string {
  if (!guidance) return base;

  const sentences: string[] = [base];
  sentences.push(`Use this when ${guidance.whenToUse}`);
  if (guidance.whenNotToUse) {
    sentences.push(`Do not use this when ${guidance.whenNotToUse}`);
  }
  sentences.push(
    guidance.sideEffect === "write"
      ? "This action has side effects — it submits a write to the business."
      : "This action is side-effect free — it validates input and returns a preview without dispatching anything.",
  );
  if (guidance.retrySemantics) {
    sentences.push(`Retry semantics: ${guidance.retrySemantics}`);
  }
  return sentences.join(" ");
}
