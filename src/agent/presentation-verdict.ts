/*
<MODULE_CONTRACT>
<purpose>
RFC-1213: verifier-side verifiable-credential contracts — the verdict shape
the agent gate binds to ActionContext after checking a W3C VC DM 2.0
verifiable presentation, the journaled record schema, and the site-level
trusted-issuer registry schema. The contract is PII-free at schema level:
PresentationVerdict carries verdict facts only (matched requirement, opaque
subject binding, issuer, failure reason) — no field can hold a presented
claim value, and the journal record hashes the presentation, never stores it.
</purpose>
<non-goals>
  <item>Do not parse or verify presentations — the verifier boundary lives in
        werkstatt-engine/src/agent-gate/presentation.ts.</item>
  <item>Do not store claim values anywhere — persistence of presented claims
        is forbidden at schema level (RFC-1213).</item>
  <item>Do not model credential issuance or holder UX — verifier side only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1213: initial contracts — VerifiablePresentationRequirement accept-entry schema, PresentationVerdict, journal record, trusted-issuer registry.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

// ---------------------------------------------------------------------------
// Requirement declaration (consumed by capability `requires.verifiablePresentation`)
// ---------------------------------------------------------------------------

/**
 * One acceptable credential shape inside a presentation requirement. `type` is
 * the closed VC type identifier the credential must carry;
 * `issuers` mixes inline issuer ids (`did:`/`https:`) with `@name` references
 * into the site's `trusted-issuers.yaml`. An absent/empty `issuers` means
 * "any issuer" — explicit, never implicit (AGP-05 gates `@name` resolution).
 */
export const presentationAcceptEntrySchema = z
  .object({
    /** Closed VC type identifier, e.g. "AgeOver18Credential". */
    type: z.string().min(1),
    /** Claim paths required on the credential subject, e.g. "credentialSubject.ageOver". */
    claims: z.array(z.string().min(1)).optional(),
    /** Inline issuer ids or "@name" refs into trusted-issuers.yaml; absent = any issuer. */
    issuers: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type PresentationAcceptEntry = z.infer<typeof presentationAcceptEntrySchema>;

/**
 * RFC-1213: the closed `requires.verifiablePresentation` block. `bindTo` is
 * v1-fixed to "verified-agent" — a presentation must cryptographically bind
 * to the caller's verified agent identity; anonymous callers cannot satisfy
 * the requirement (replay protection, AUDIT-RFC-1213-01).
 */
export const verifiablePresentationRequirementSchema = z
  .object({
    accept: z.array(presentationAcceptEntrySchema).min(1),
    /** Human-readable reason shown to the wallet/agent. */
    purpose: z.string().min(1),
    /** v1 fixed: the VP holder/subject binding MUST equal the verified agentId. */
    bindTo: z.literal("verified-agent"),
  })
  .strict();

export type VerifiablePresentationRequirement = z.infer<
  typeof verifiablePresentationRequirementSchema
>;

// ---------------------------------------------------------------------------
// Verdict — the ONLY shape presentation data may take downstream (AC-6)
// ---------------------------------------------------------------------------

/**
 * The verification verdict bound to ActionContext. No field can carry a
 * presented claim value — `subjectBinding` is the opaque verified agentId the
 * presentation bound to, `issuer` the credential issuer id. Claim leakage
 * requires changing this schema, which is what RFC-1213 exists to gate.
 */
export const presentationVerdictSchema = z
  .object({
    verified: z.boolean(),
    /** Which accept[] entry matched — the VC type identifier. */
    matchedRequirement: z.string().min(1).optional(),
    /** The verified agentId the presentation bound to — opaque correlation handle. */
    subjectBinding: z.string().min(1).optional(),
    issuer: z.string().min(1).optional(),
    failureReason: z.string().min(1).optional(),
  })
  .strict();

export type PresentationVerdict = z.infer<typeof presentationVerdictSchema>;

// ---------------------------------------------------------------------------
// Journal record — hashes and verdicts only
// ---------------------------------------------------------------------------

/** RFC-1213: schema marker stamped into every journaled presentation verdict. */
export const PRESENTATION_VERDICT_SCHEMA_ID = "gogol.presentation-verdict/1";

/**
 * The journaled verification record — `{requirementId, verified, issuer,
 * failureReason, presentationHash}` per the RFC. `presentationHash` is a
 * sha256 of the canonical presentation, never the presentation itself.
 */
export const presentationJournalRecordSchema = z
  .object({
    schema: z.literal(PRESENTATION_VERDICT_SCHEMA_ID),
    siteId: z.string().min(1),
    capability: z.string().min(1),
    requirementId: z.string().min(1),
    verified: z.boolean(),
    issuer: z.string().min(1).optional(),
    failureReason: z.string().min(1).optional(),
    presentationHash: z.string().min(1),
    occurredAt: z.string().min(1),
  })
  .strict();

export type PresentationJournalRecord = z.infer<typeof presentationJournalRecordSchema>;

// ---------------------------------------------------------------------------
// Trusted-issuer registry — src/content/agent/trusted-issuers.yaml
// ---------------------------------------------------------------------------

/**
 * Site-level issuer trust registry: named issuer-id sets referenced by
 * `accept[].issuers` `@name` entries so issuer policy does not drift across
 * capabilities. File: `src/content/agent/trusted-issuers.yaml`.
 */
export const trustedIssuerRegistrySchema = z
  .object({
    issuers: z.record(z.string().min(1), z.array(z.string().min(1)).min(1)).default({}),
  })
  .strict();

export type TrustedIssuerRegistry = z.infer<typeof trustedIssuerRegistrySchema>;

/**
 * Resolve one `accept[].issuers` list against the registry: `@name` entries
 * expand to the named set, inline ids pass through. Returns the resolved set
 * plus any unresolved `@name` references (AGP-05 surfaces those).
 */
export function resolveIssuerRefs(
  issuers: readonly string[] | undefined,
  registry: TrustedIssuerRegistry,
): { resolved: string[]; unresolvedRefs: string[] } {
  const resolved: string[] = [];
  const unresolvedRefs: string[] = [];
  for (const ref of issuers ?? []) {
    if (ref.startsWith("@")) {
      const named = registry.issuers[ref.slice(1)];
      if (named) resolved.push(...named);
      else unresolvedRefs.push(ref);
    } else {
      resolved.push(ref);
    }
  }
  return { resolved, unresolvedRefs };
}
