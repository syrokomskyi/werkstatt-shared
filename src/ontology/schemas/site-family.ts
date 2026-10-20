/*
<MODULE_CONTRACT>
<purpose>
Zod schema for site-family definition files under packages/werkstatt-site/src/domain/ontology/site-families/<id>/family.yaml.
A Site Family captures reusable onboarding recipes: detection signals, candidate biomes,
candidate constellations, required section archetypes, audit thresholds, and readiness baselines.
</purpose>
<non-goals>
  <item>Do not read files from disk.</item>
  <item>Do not validate referenced biome/constellation/archetype files here; runtime validators do that.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0071: Add site-family contract to @warpgogol/werkstatt-shared/ontology.</item>
  <item>RFC-1344: visitorQuestions — {id, prompt, placement home|within-one-hop} on the family root, superRefine enforces id uniqueness (FAMILY-Q-01's schema half); COMP-QUESTIONS-01/PAGE-ANSWERS-01 consume.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

const kebabId = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "id must be kebab-case (lowercase letters, digits, hyphens)");
const semver = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i, "version must be valid semver");

const eventNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(?:-[a-z0-9-]+)*$/, "eventName must be kebab-case");

const detectionSignalsSchema = z
  .object({
    archetypePrimary: kebabId.optional(),
    audienceAny: z.array(z.string().min(1)).default([]),
    conversionPrimary: kebabId.optional(),
    materialMentionsAny: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const siteFamilyDetectionSchema = z
  .object({
    signals: detectionSignalsSchema,
    threshold: z.number().min(0).max(1),
  })
  .strict();

const conversionGoalSchema = z
  .object({
    id: kebabId,
    eventName: eventNameSchema,
  })
  .strict();

const auditThresholdValueSchema = z.enum([
  "info",
  "warn",
  "warning",
  "required",
  "error",
  "forbidden",
]);

/**
 * RFC-1344: a question a visitor of this site family arrives with. Composer
 * page blocks declare `answers: [<question-id>]`; onboarding.composition.validate
 * (COMP-QUESTIONS-01) and page.block.validate (PAGE-ANSWERS-01) consume them.
 * `placement` is a closed enum: `home` must be answered by a home-page block,
 * `within-one-hop` by a home-page or primary-navigation-target block.
 */
export const siteFamilyVisitorQuestionSchema = z
  .object({
    id: kebabId,
    prompt: z.string().min(1),
    placement: z.enum(["home", "within-one-hop"]),
  })
  .strict();

export const siteFamilyRecipeSchema = z
  .object({
    candidateBiomes: z.array(kebabId).min(1),
    candidateConstellations: z.array(kebabId).min(1),
    requiredSectionArchetypes: z.array(kebabId).min(1),
    conversionGoals: z
      .object({
        primary: conversionGoalSchema,
        secondary: z.array(conversionGoalSchema).default([]),
      })
      .strict(),
    auditThresholds: z.record(z.string().min(1), auditThresholdValueSchema),
    agentReadinessBaseline: z
      .object({
        maxBytesToCta: z.number().int().positive(),
        requireStructuredData: z.array(z.string().min(1)).default([]),
      })
      .strict(),
  })
  .strict();

export const siteFamilySchema = z
  .object({
    id: kebabId,
    displayName: z.string().min(1),
    version: semver,
    description: z.string().min(1),
    detection: siteFamilyDetectionSchema,
    recipe: siteFamilyRecipeSchema,
    /**
     * RFC-1344: questions a visitor of this family arrives with — platform
     * data, never site-local overrides. Families without the field skip
     * COMP-QUESTIONS-01 (COMP-QUESTIONS-00 keeps the gap visible).
     */
    visitorQuestions: z.array(siteFamilyVisitorQuestionSchema).optional(),
  })
  .strict()
  .superRefine((family, ctx) => {
    const seen = new Set<string>();
    for (const [index, question] of (family.visitorQuestions ?? []).entries()) {
      if (seen.has(question.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate visitor question id '${question.id}'`,
          path: ["visitorQuestions", index, "id"],
        });
      }
      seen.add(question.id);
    }
  });

export type SiteFamilyDetection = z.infer<typeof siteFamilyDetectionSchema>;
export type SiteFamilyRecipe = z.infer<typeof siteFamilyRecipeSchema>;
export type SiteFamilyVisitorQuestion = z.infer<typeof siteFamilyVisitorQuestionSchema>;
export type SiteFamily = z.infer<typeof siteFamilySchema>;
export const SiteFamilyContract = siteFamilySchema;
