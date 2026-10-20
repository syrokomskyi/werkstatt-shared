/*
<MODULE_CONTRACT>
<purpose>`werkstatt:publication-register/v1` — the seeded publication register
(src/content/ledger/publication.yaml, RFC-1341). Per-entity content-use tier
ceiling plus open blockers (gap id, kind, owner). Pure schema + tier
primitives; IO readers live in werkstatt-site checks/lib/pbp-publication.ts.</purpose>
<non-goals>
  <item>Do not read files — this module is pure schema/types.</item>
  <item>Do not evaluate asset ceilings against entity status — the `assets` section mirrors intake/extraction facts; PUBGATE-03 consumes it.</item>
  <item>Do not raise ceilings above preview for unpublished entities — entityCeiling caps it.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1353/AMD-011: optional faq section — {entryId, ceiling, blockers, questionnaireRef?} per seeded slug for entries below public.</item>
  <item>RFC-1346: assets entries gain origin (placeholder|generated|extracted|client|stock|studio) — placeholder ⇒ derived preview tier via slot:&lt;id&gt; in belowPublic.</item>
  <item>RFC-1345: assets section typed — {ceiling, blockers, emitted} per asset basename for extraction register entries + PUBGATE-03.</item>
  <item>RFC-1341: created — publication register schema + tier model.</item>
  <item>RFC-1341: preview/public publication tiers — register + ceiling + requires + PUBTIER-01/02 + tier artifact</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

// ---------------------------------------------------------------------------
// Tier model
// ---------------------------------------------------------------------------

/** Ordered content-use tiers: draft < preview < public. */
export type PublicationTier = "draft" | "preview" | "public";
export type SiteCeiling = "public" | "preview";

export const PUBLICATION_TIER_ORDER: Record<PublicationTier, number> = {
  draft: 0,
  preview: 1,
  public: 2,
};

export function tierAtLeast(tier: PublicationTier, floor: PublicationTier): boolean {
  return PUBLICATION_TIER_ORDER[tier] >= PUBLICATION_TIER_ORDER[floor];
}

// ---------------------------------------------------------------------------
// Register schema
// ---------------------------------------------------------------------------

const blockerSchema = z
  .object({
    gap: z.string().min(1),
    kind: z.enum(["proof", "rights", "approval"]),
    /** Gap owner, seeded from the intake; PUBTIER-01 names it in remediation. */
    obtainableBy: z.string().min(1).optional(),
    holdsBelow: z.enum(["preview", "public"]),
  })
  .strict();

export const publicationRegisterSchema = z
  .object({
    schema: z.literal("werkstatt:publication-register/v1"),
    entities: z
      .record(
        z.string(),
        z
          .object({
            ceiling: z.enum(["draft", "preview", "public"]),
            blockers: z.array(blockerSchema).default([]),
          })
          .strict(),
      )
      .default({}),
    /**
     * RFC-1345: per-asset tier register — keyed by the asset basename the file
     * is emitted under (`ast-07.webp`, `ext-<sha12>.webp`, `slot-<id>.webp`).
     * `emitted` stores the emitted path relative to `src/content/` so
     * PUBGATE-03 can match dist basenames even after re-encode changes the
     * content hash. RFC-1346: `origin` carries the intake origin vocabulary
     * plus `placeholder` — the derived-tier emitter reads it (placeholder ⇒
     * belowPublic `slot:<id>` ⇒ preview), never sidecars mid-build.
     */
    assets: z
      .record(
        z.string(),
        z
          .object({
            ceiling: z.enum(["draft", "preview", "public"]),
            blockers: z.array(blockerSchema).default([]),
            emitted: z.string().min(1).optional(),
            origin: z
              .enum(["placeholder", "generated", "extracted", "client", "stock", "studio"])
              .optional(),
          })
          .strict(),
      )
      .default({}),
    /**
     * RFC-1353/AMD-011: seeded FAQ entries below public — keyed by the seeded
     * slug (`<topic>-<nn>` or the entry's explicit slug). `awaiting-client`
     * rows carry `questionnaireRef` so the status card can list them without
     * reading the intake bundle.
     */
    faq: z
      .record(
        z.string(),
        z
          .object({
            entryId: z.string().min(1),
            ceiling: z.enum(["draft", "preview"]),
            blockers: z.array(blockerSchema).default([]),
            questionnaireRef: z.string().optional(),
          })
          .strict(),
      )
      .default({}),
  })
  .strict();

export type PublicationRegister = z.infer<typeof publicationRegisterSchema>;
export type PublicationRegisterEntity = PublicationRegister["entities"][string];
export type PublicationRegisterAsset = PublicationRegister["assets"][string];
export type PublicationRegisterFaqEntry = PublicationRegister["faq"][string];
export type PublicationBlocker = z.infer<typeof blockerSchema>;

// ---------------------------------------------------------------------------
// Entity ceiling resolution
// ---------------------------------------------------------------------------

/**
 * Effective ceiling of a PBP entity (RFC-1341): `internal: true` is a
 * permanent draft; `status: published` is public; anything else takes the
 * register entry's ceiling — capped at `preview` (the register cannot publish,
 * only `status: published` does).
 */
export function entityCeiling(
  entity: { status: string | null; internal: boolean },
  registerEntry: { ceiling: PublicationTier } | undefined,
): PublicationTier {
  if (entity.internal) return "draft";
  if (entity.status === "published") return "public";
  const ceiling = registerEntry?.ceiling ?? "draft";
  return ceiling === "public" ? "preview" : ceiling;
}
