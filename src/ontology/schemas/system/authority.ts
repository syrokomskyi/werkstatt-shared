/*
<MODULE_CONTRACT>
<purpose>
  RFC-1259: Content-authority model (CAM) schema — the optional `authority:`
  block on system.md that unifies clientEditable[], pseo autonomy scopes, and
  approval gates as projections of one authorization model.
</purpose>
<non-goals>
  <item>Do not evaluate authority verdicts — resolution lives in
  werkstatt-site/src/domain/authority/resolve.ts.</item>
  <item>Do not declare validator rules — CAM-01..05 are emitted by
  authority.model.validate, not this schema.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1259: step 1 — camAuthoritySchema: closed fieldClass vocabulary,
  subjects, grants (incl. allowOverlap escape for documented narrowing), gates.
  version: 1 literal — unknown versions fail closed (CAM-01).</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/**
 * RFC-1259: closed field-class vocabulary (v1). A superset of the pseo
 * fieldClassSchema (structural, narrative, claims, product) — every pseo
 * scope is representable as a CAM grant on this axis.
 */
export const camFieldClassSchema = z.enum([
  "structural",
  "narrative",
  "claims",
  "product",
  "legal",
  "media",
  "navigation",
  "shell",
]);

/** RFC-1259: mutation-scope level scale (adapted from RFC-0278's L0–L4 vocabulary). */
export const camLevelSchema = z.enum(["L0", "L1", "L2", "L3", "L4"]);

export const camSubjectSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    /** Baseline level when no grant covers the query. */
    defaultLevel: camLevelSchema,
  })
  .strict();

export const camGateSchema = z
  .object({
    id: z.string().min(1),
    whenFieldClass: z.union([camFieldClassSchema, z.array(camFieldClassSchema).min(1)]),
    require: z.enum(["human-approval", "mission-digest-signoff", "provenance"]),
    /** Optional level ceiling this gate imposes on matched operations. */
    ceiling: camLevelSchema.optional(),
  })
  .strict();

export const camGrantSchema = z
  .object({
    subject: z.string().min(1),
    fieldClasses: z.array(camFieldClassSchema).min(1),
    /** Workspace-relative glob paths; absent = unrestricted within fieldClasses. */
    paths: z.array(z.string().min(1)).optional(),
    /** Grant ceiling; falls back to subject.defaultLevel when absent. */
    maxLevel: camLevelSchema.optional(),
    /** Gate id references resolved against the block's gates[]. */
    gates: z.array(z.string().min(1)).optional(),
    /**
     * Q-2 escape hatch: documented shadowing. Without it, CAM-03 flags any
     * glob-intersecting grant pair for the same subject×fieldClass carrying
     * different maxLevel.
     */
    allowOverlap: z.boolean().optional(),
  })
  .strict();

export const camAuthoritySchema = z
  .object({
    /** Unknown versions fail closed: the resolver refuses the block. */
    version: z.literal(1),
    /**
     * Informational restatement of the closed vocabulary — optional; the enum
     * is the enforcement, the list documents which classes the site uses.
     */
    fieldClasses: z.array(camFieldClassSchema).min(1).optional(),
    subjects: z.array(camSubjectSchema).min(1),
    grants: z.array(camGrantSchema).default([]),
    gates: z.array(camGateSchema).default([]),
  })
  .strict();

export type CamFieldClass = z.infer<typeof camFieldClassSchema>;
export type CamLevel = z.infer<typeof camLevelSchema>;
export type CamSubject = z.infer<typeof camSubjectSchema>;
export type CamGate = z.infer<typeof camGateSchema>;
export type CamGrant = z.infer<typeof camGrantSchema>;
export type CamAuthority = z.infer<typeof camAuthoritySchema>;
