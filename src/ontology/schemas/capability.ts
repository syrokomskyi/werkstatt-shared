/*
<MODULE_CONTRACT>
<purpose>
RFC-0288: the closed capability catalog record schema — one YAML file per
AI-agent-invocable action (packages/werkstatt-site/src/domain/ontology/capabilities/*.yaml). The
input/output shape is a deliberately closed JSON-Schema subset chosen for
lossless projection to both OpenAPI (RFC-0289) and MCP tool schemas (RFC-0290).
</purpose>
<non-goals>
  <item>Do not resolve entitlements or active-capability logic here — that is
        @warpgogol/werkstatt-shared/agent/capability.ts (resolveActiveCapabilities).</item>
  <item>Do not widen the JSON-Schema subset beyond what OpenAPI + MCP both
        accept verbatim — widening requires an RFC amending RFC-0288.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0288: initial capability record schema.</item>
  <item>RFC-1112: add sideEffect ("write"|"none"); integration + humanEquivalent become optional and are required unless sideEffect is "none".</item>
  <item>RFC-1115: add optional agentGuidance block (sideEffect, whenToUse, whenNotToUse, retrySemantics) rendered into MCP tool descriptions and OpenAPI operation docs.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/** Localized string map: language code → string. At least one entry required. */
const localizedStringSchema = z
  .record(z.string().min(1), z.string().min(1))
  .refine((v) => Object.keys(v).length > 0, { message: "must declare at least one language" });

const capabilityPropertySchema = z
  .object({
    type: z.enum(["string", "boolean", "integer"]),
    format: z.enum(["email", "uuid", "uri", "date"]).optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
  })
  .strict();

/**
 * RFC-0288: the closed JSON-Schema subset. Deliberately small — every field
 * here must be losslessly projectable to an OpenAPI 3.1 schema object AND an
 * MCP tool inputSchema verbatim, with no transformation.
 */
export const capabilityInputOutputSchema = z
  .object({
    type: z.literal("object"),
    required: z.array(z.string().min(1)).optional(),
    additionalProperties: z.literal(false),
    properties: z.record(z.string().min(1), capabilityPropertySchema),
  })
  .strict()
  .refine((schema) => (schema.required ?? []).every((key) => key in schema.properties), {
    message: "required[] entries must all exist in properties",
  });

export type CapabilityInputOutputSchema = z.infer<typeof capabilityInputOutputSchema>;

const capabilityIntegrationSchema = z
  .object({
    eventKind: z.enum(["lead", "message", "appointment"]),
    source: z.literal("agent"),
  })
  .strict();

const capabilityRequiresSchema = z
  .object({
    entitlements: z.array(z.string().min(1)).default([]),
    sections: z.array(z.string().min(1)).default([]),
  })
  .strict();

const capabilityHumanEquivalentSchema = z
  .object({
    sectionType: z.string().min(1),
  })
  .strict();

const capabilityLimitsSchema = z
  .object({
    perMinutePerIp: z.number().int().positive(),
    maxPayloadBytes: z.number().int().positive(),
  })
  .strict();

/**
 * RFC-1115: model-oriented guidance rendered into MCP tool descriptions and
 * OpenAPI operation docs. `sideEffect` restates the record-level sideEffect so
 * the guidance block is self-contained — a superRefine keeps them consistent.
 * `retrySemantics` describes the RFC-1112 Idempotency-Key contract
 * descriptively; the mechanism stays owned by RFC-1112.
 */
const capabilityAgentGuidanceSchema = z
  .object({
    sideEffect: z.enum(["write", "none"]),
    whenToUse: z.string().min(1),
    whenNotToUse: z.string().min(1).optional(),
    retrySemantics: z.string().min(1).optional(),
  })
  .strict();

/** RFC-0288: one capability catalog record (packages/werkstatt-site/src/domain/ontology/capabilities/<id>.yaml). */
export const capabilityRecordSchema = z
  .object({
    /** Dot-separated, lowercase; the file stem MUST equal this id. */
    id: z
      .string()
      .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, "id must be dot-separated lowercase"),
    /** Integer; bump on breaking input/output change (by RFC). */
    version: z.number().int().positive(),
    kind: z.literal("action"),
    /**
     * RFC-1112: "write" (default when absent) dispatches an IntegrationEvent;
     * "none" marks a side-effect-free preview that validates input and returns
     * a draftId without dispatching.
     */
    sideEffect: z.enum(["write", "none"]).optional(),
    title: localizedStringSchema,
    description: localizedStringSchema,
    input: capabilityInputOutputSchema,
    output: capabilityInputOutputSchema,
    integration: capabilityIntegrationSchema.optional(),
    requires: capabilityRequiresSchema,
    humanEquivalent: capabilityHumanEquivalentSchema.optional(),
    limits: capabilityLimitsSchema,
    agentGuidance: capabilityAgentGuidanceSchema.optional(),
  })
  .strict()
  .superRefine((record, ctx) => {
    // RFC-1115: agentGuidance.sideEffect must restate the effective record-level
    // sideEffect (absent means "write") — contradictory declarations are drift.
    const effectiveSideEffect = record.sideEffect ?? "write";
    if (record.agentGuidance && record.agentGuidance.sideEffect !== effectiveSideEffect) {
      ctx.addIssue({
        code: "custom",
        path: ["agentGuidance", "sideEffect"],
        message: `must match the record-level sideEffect ("${effectiveSideEffect}")`,
      });
    }
    if (record.sideEffect === "none") return;
    if (!record.integration) {
      ctx.addIssue({
        code: "custom",
        path: ["integration"],
        message: 'required unless sideEffect is "none"',
      });
    }
    if (!record.humanEquivalent) {
      ctx.addIssue({
        code: "custom",
        path: ["humanEquivalent"],
        message: 'required unless sideEffect is "none"',
      });
    }
  });

export type CapabilityRecord = z.infer<typeof capabilityRecordSchema>;
