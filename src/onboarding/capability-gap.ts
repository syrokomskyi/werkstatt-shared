/*
<MODULE_CONTRACT>

<purpose>
RFC-1299: capabilityGapSchema — the Zod mirror of
docs/specs/werkstatt-onboarding/schemas/capability-gap.schema.yaml. A
capability gap is a typed proof that the platform catalog cannot express a
client need (D4): raised by the composer or by family.detect (kind
new-family), carried as a decision-window entry, and validated by
capability.gap.validate (CAPGAP-01…03).
</purpose>
<non-goals>
  <item>Do not score or detect gaps here — detection lives in werkstatt-site (family.detect); this file is the data contract only.</item>
  <item>Do not add fields beyond the spec schema — strict objects mirror additionalProperties:false (DNA-19).</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Field-for-field mirror of capability-gap.schema.yaml — the spec file is normative; any divergence is a bug.</item>
  <item>systemId has no pattern in the spec schema, so none is enforced here (CAPGAP-02's token check supplies the semantic constraint).</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1299: created — capabilityGapSchema + CapabilityGap type.</item>
  <item>RFC-1299: capability.brief + family.detect + capability.gap.validate</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

const capgapIdSchema = z.string().regex(/^CAPGAP-[0-9]{3,}$/);

const catalogEvidenceCandidateSchema = z
  .object({
    /** Catalog id (archetype, family, biome, …). */
    ref: z.string(),
    whyInsufficient: z.string(),
  })
  .strict();

const capabilityGapNeedSchema = z
  .object({
    statement: z.string(),
    evidenceRefs: z.array(z.string()).min(1),
  })
  .strict();

const capabilityGapCatalogEvidenceSchema = z
  .object({
    capabilityBriefSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    /** family.detect best score (for new-family). */
    familyScore: z.number().min(0).max(1).optional(),
    candidates: z.array(catalogEvidenceCandidateSchema).min(1),
  })
  .strict();

const capabilityGapProposalSchema = z
  .object({
    /**
     * Generic name by function (never a client name), e.g. `partner-locator`
     * rather than `dp7-partners`.
     */
    functionalName: z.string().regex(/^[a-z][a-z0-9-]{2,48}$/),
    /**
     * `data` = built in this onboarding with provenance.client;
     * `platform-rfc` = separate platform track (code).
     */
    track: z.enum(["data", "platform-rfc"]),
    sketch: z.string().optional(),
  })
  .strict();

export const capabilityGapSchema = z
  .object({
    id: capgapIdSchema,
    systemId: z.string(),
    kind: z.enum([
      "new-section-archetype",
      "section-props-extension",
      "new-family",
      "new-biome",
      "new-constellation",
      "new-pbp-entity-type",
      "new-component",
    ]),
    need: capabilityGapNeedSchema,
    catalogEvidence: capabilityGapCatalogEvidenceSchema,
    proposal: capabilityGapProposalSchema,
    /**
     * What the site uses until the extension exists (an existing archetype
     * or an omission). Code extensions never block birth.
     */
    interim: z.string(),
  })
  .strict();

export type CapabilityGap = z.infer<typeof capabilityGapSchema>;
