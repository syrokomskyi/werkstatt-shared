/*
<MODULE_CONTRACT>
<purpose>RFC-1295/RFC-1335: canonical zod schemas for the editorial review
packet (releases/&lt;id&gt;/editorial/packet.json) and the operator sign-off
record (systems-cache/&lt;id&gt;/gate-decisions/&lt;release&gt;-editorial.json).
Single-sourced here because werkstatt-engine cannot import
@warpgogol/werkstatt-site (RFC-0774/0775 plugin-hook inversion) — both the
engine's leitstand precondition helper and the site's editorial commands
consume these schemas. Types derive from schemas.</purpose>
<non-goals>
  <item>Do not add gate evaluation or diff computation — schema declarations only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1335: sunk from @warpgogol/werkstatt-site/checks/editorial/schema.ts — the promote-prod precondition helper in werkstatt-engine needs the same canonical shapes.</item>
  <item>RFC-1296: warningsAck on the sign-off; warningsIncreased + contentWarningsHash on the packet (defaults keep RFC-1295 records valid).</item>
  <item>RFC-1295: initial schemas — werkstatt/editorial-packet@1 and werkstatt/editorial-signoff@1.</item>
  <item>RFC-1335: implement RFC-1335: fail-fast editorial gate, adaptive certify budget, gate-bound producer ordering

warpgogol-m000202 burned ~26min of producer capture before the main gate
reported a missing editorial sign-off, and the fixed 40min timeout failed
a passing 112-route capture at 1512.5s.

- shared editorial precondition helper (checkEditorialPrecondition) reads
  packet.json + <release>-editorial.json via schemas sunk to
  werkstatt-shared/ontology/operations (engine cannot import werkstatt-site)
- leitstand.certify --gate prod reduces the producer plan to
  editorial-signoff when the precondition is unmet; fail decision names
  editorial.review.prepare/signoff in reasons + nextSteps
- leitstand.promote checks the precondition before loading the
  prod-verification decision (ordered authorization)
- adaptive budget clamp(10min + 15s x emittedHtmlCount, 20min, 90min)
  over dist/client/**.html; leitstand.certify.producerBudgetMs override
  (z.unknown so malformed values warn, never fail the config parse);
  40min fallback when the dist tree is absent
- producers whose requirements all declare reuse.allowedFrom: [] sort
  last so gate-bound evidence mints closest to the decision
- AC-6: cache-clone editorial coverage (prepare writes, verify read-only)</item>
  <item>RFC-1492: rename production deploy channel main to prod with single DEPLOY_CHANNELS definition and CHANNEL-01 guard</item>
  <history>RFC-1295, RFC-1336</history>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

export const editorialPacketSchema = z
  .object({
    schema: z.literal("werkstatt/editorial-packet@1"),
    systemId: z.string(),
    releaseId: z.string(),
    missionId: z.string(),
    /** sha256 of releases/<id>/text-diff.json, or "sha256:none" when absent/empty. */
    textDiffHash: z.string(),
    /** true when the text diff reports any added/removed/changed segments or pages. */
    textChanged: z.boolean(),
    /** sha256 of protected-changes.md. */
    protectedChangesHash: z.string(),
    protectedChanged: z.boolean(),
    findingsCount: z.object({
      error: z.number(),
      warning: z.number(),
    }),
    llmReview: z.boolean(),
    /** RFC-1296: sha256 of releases/<id>/content-warnings.json, "sha256:none" when absent. */
    contentWarningsHash: z.string().default("sha256:none"),
    /** RFC-1296: true when a content-contract rule's warnings grew vs the previous release. */
    warningsIncreased: z.boolean().default(false),
  })
  .strict();

export type EditorialPacket = z.infer<typeof editorialPacketSchema>;

export const editorialSignoffSchema = z
  .object({
    schema: z.literal("werkstatt/editorial-signoff@1"),
    systemId: z.string(),
    releaseId: z.string(),
    decision: z.enum(["approve", "reject"]),
    /**
     * RFC-1336: human:<handle> reviewer, or agent:<id> acting under an active
     * editorial.signoff delegation — agent reviewers MUST carry delegatedBy
     * + delegationId provenance.
     */
    reviewer: z.string().regex(/^(human|agent):[a-z0-9-]+$/),
    /** RFC-1336: the granting human on delegated sign-offs. */
    delegatedBy: z
      .string()
      .regex(/^human:[a-z0-9-]+$/)
      .optional(),
    /** RFC-1336: the delegation id backing a delegated sign-off. */
    delegationId: z
      .string()
      .regex(/^del-[0-9]{4,}$/)
      .optional(),
    textDiffHash: z.string(),
    protectedChangesHash: z.string(),
    protectedAck: z.boolean(),
    /** RFC-1296: reviewer acknowledged increased content warnings (EDIT-05). */
    warningsAck: z.boolean().default(false),
    notes: z.string().optional(),
    signedAt: z.string().datetime(),
  })
  .strict()
  .refine(
    (s) =>
      !s.reviewer.startsWith("agent:") ||
      (s.delegatedBy !== undefined && s.delegationId !== undefined),
    {
      message:
        "agent:<id> reviewers require delegatedBy + delegationId provenance (RFC-1336) — an unsigned agent attestation is not a sign-off",
    },
  );

export type EditorialSignoff = z.infer<typeof editorialSignoffSchema>;

/** Site override file for the protected-content registry (.author/protected-content.yaml). */
export const protectedContentSchema = z
  .object({
    schema: z.literal("werkstatt/protected-content@1"),
    globs: z.array(z.string().min(1)).min(1),
  })
  .strict();
