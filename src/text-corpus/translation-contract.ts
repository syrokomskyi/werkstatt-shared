/*
<MODULE_CONTRACT>
<purpose>
  RFC-1372: werkstatt/translation-contract@1 — the single per-site translation
  contract at &lt;site&gt;/.author/translation-contract.yaml. Unifies the three
  retired carriers (.author/terms.yaml, .author/voice-profile.yaml,
  enriched/_translation-*): concept-keyed terms with per-locale
  canonical/forbidden forms (RFC-1291 semantics carried forward), the voice
  profile, and a structured translator note with per-locale overrides plus
  modules.&lt;id&gt; overlays carrying per-module terms/note/lifecycle/
  provenance/moduleContextHash (RFC-0273's approval+stale machinery moved
  inside the contract). Authoring is human-gated: lifecycle.status draft |
  approved; enforcement consumers honor only approved contracts.
</purpose>
<non-goals>
  <item>No file IO — loaders/commands live in werkstatt-site/src/checks/translation-contract.ts.</item>
  <item>No rendering — the contract is author tooling, never visitor-facing (DNA-4).</item>
  <item>No matching logic — term matchers live in werkstatt-site rules/terms.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1400/AMD-014: lifecycle gains optional delegatedBy/delegationId/decisionRef/contractSha256 — approval provenance stamped only on delegated agent approvals.</item>
  <item>RFC-1372: initial — contract schema, TRANSLATION_CONTRACT_REL, resolveTranslatorNote overlay merge (site → locales → module → module locales).</item>
  <item>RFC-1372: unify terminology, voice, and translator guidance into a per-site translation contract (RFC-1372)</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { corpusSegmentKindSchema } from "./schema.ts";

export const TRANSLATION_CONTRACT_REL = ".author/translation-contract.yaml";
export const TRANSLATION_CONTRACT_SCHEMA_ID = "werkstatt/translation-contract@1";

const localeTag = z.string().min(2).max(12);

/** Per-locale form pair. `canonical` may be absent for forbidden-only entries
 *  (migrated glossary forbidden lists carry no declared replacement). */
export const contractLocaleFormSchema = z
  .object({
    canonical: z.string().min(1).optional(),
    forbidden: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type ContractLocaleForm = z.infer<typeof contractLocaleFormSchema>;

/** Concept-keyed term — one concept, per-locale canonical/forbidden forms. */
export const contractTermSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    /** Human note: what this term names. */
    concept: z.string().default(""),
    forms: z.record(localeTag, contractLocaleFormSchema),
    wholeWord: z.boolean().default(true),
    caseSensitive: z.boolean().default(true),
    /** Limit to segment kinds (RFC-1291 carry-over). */
    kinds: z.array(corpusSegmentKindSchema).optional(),
    /** Limit to route prefixes. */
    routes: z.array(z.string().startsWith("/")).optional(),
    /** Braceless content ref pinned to a PBP field (TERM-03 semantics). */
    pbpRef: z.string().optional(),
    severity: z.enum(["error", "warning"]).default("error"),
  })
  .strict();
export type ContractTerm = z.infer<typeof contractTermSchema>;

export const contractVoiceSchema = z
  .object({
    forbiddenPhrases: z.array(z.string()).default([]),
    preferredPhrasings: z
      .array(z.object({ avoid: z.string(), prefer: z.string() }).strict())
      .default([]),
    mandatoryPhrases: z.array(z.string()).default([]),
  })
  .strict();
export type ContractVoice = z.infer<typeof contractVoiceSchema>;

const noteFields = {
  purpose: z.string().default(""),
  audience: z.string().default(""),
  voice: z.string().default(""),
  doNotTranslate: z.array(z.string()).default([]),
  preserveExactly: z.array(z.string()).default([]),
  transcreateGuidance: z.string().default(""),
  forbiddenMoves: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
};

/** Field-level override — every field optional so "authored empty" stays
 *  distinguishable from "not overridden" during merges. */
export const contractNoteOverrideSchema = z
  .object({
    purpose: z.string().optional(),
    audience: z.string().optional(),
    voice: z.string().optional(),
    doNotTranslate: z.array(z.string()).optional(),
    preserveExactly: z.array(z.string()).optional(),
    transcreateGuidance: z.string().optional(),
    forbiddenMoves: z.array(z.string()).optional(),
    examples: z.array(z.string()).optional(),
  })
  .strict();
export type ContractNoteOverride = z.infer<typeof contractNoteOverrideSchema>;

/** Structured translator note — data, not prose; `brief` renders it. */
export const contractNoteSchema = z
  .object({
    ...noteFields,
    locales: z.record(localeTag, contractNoteOverrideSchema).default({}),
  })
  .strict();
export type ContractNote = z.infer<typeof contractNoteSchema>;

/** Module note overlay — same fields as the site note (all optional) plus its
 *  own per-locale override map for locale-keyed module guidance. */
export const contractModuleNoteSchema = z
  .object({
    purpose: z.string().optional(),
    audience: z.string().optional(),
    voice: z.string().optional(),
    doNotTranslate: z.array(z.string()).optional(),
    preserveExactly: z.array(z.string()).optional(),
    transcreateGuidance: z.string().optional(),
    forbiddenMoves: z.array(z.string()).optional(),
    examples: z.array(z.string()).optional(),
    locales: z.record(localeTag, contractNoteOverrideSchema).default({}),
  })
  .strict();
export type ContractModuleNote = z.infer<typeof contractModuleNoteSchema>;

export const contractLifecycleSchema = z
  .object({
    status: z.enum(["draft", "approved"]),
    reviewedAt: z.string().nullable().default(null),
    reviewedBy: z.string().nullable().default(null),
    /**
     * RFC-1400/AMD-014: approval provenance — present only when a delegated
     * `agent:<id>` approved under an active translation.contract.approve
     * grant (TCAPPROVE-05); all absent on a direct human approval.
     */
    delegatedBy: z.string().nullable().optional(),
    delegationId: z.string().nullable().optional(),
    /** The onboarding decision entry (OD-NN) whose selectedOption "Approve" backs this approval. */
    decisionRef: z.string().nullable().optional(),
    /** sha256 of the contract bytes the decision cited — TCAPPROVE-04 binds it at approve time. */
    contractSha256: z.string().nullable().optional(),
  })
  .strict();
export type ContractLifecycle = z.infer<typeof contractLifecycleSchema>;

export const contractProvenanceSchema = z
  .object({
    approved: z.boolean().default(false),
    generatedAt: z.string().default(""),
    promptId: z.string().default(""),
    model: z.string().default(""),
  })
  .strict();
export type ContractProvenance = z.infer<typeof contractProvenanceSchema>;

export const contractModuleSchema = z
  .object({
    /** Additional terms applied only to this module's artifacts. */
    terms: z.array(contractTermSchema).default([]),
    note: contractModuleNoteSchema.default({ locales: {} }),
    lifecycle: contractLifecycleSchema.default({
      status: "draft",
      reviewedAt: null,
      reviewedBy: null,
    }),
    provenance: contractProvenanceSchema.default({
      approved: false,
      generatedAt: "",
      promptId: "",
      model: "",
    }),
    /** RFC-0273 stale-invalidation, moved inside the contract. */
    moduleContextHash: z.string().default(""),
  })
  .strict();
export type ContractModule = z.infer<typeof contractModuleSchema>;

export const translationContractSchema = z
  .object({
    schema: z.literal(TRANSLATION_CONTRACT_SCHEMA_ID),
    lifecycle: contractLifecycleSchema,
    reviewPolicy: z
      .object({ reviewIntervalDays: z.number().int().positive().default(90) })
      .strict()
      .default({ reviewIntervalDays: 90 }),
    terms: z.array(contractTermSchema).default([]),
    voice: contractVoiceSchema.default({
      forbiddenPhrases: [],
      preferredPhrasings: [],
      mandatoryPhrases: [],
    }),
    note: contractNoteSchema.default({
      purpose: "",
      audience: "",
      voice: "",
      doNotTranslate: [],
      preserveExactly: [],
      transcreateGuidance: "",
      forbiddenMoves: [],
      examples: [],
      locales: {},
    }),
    modules: z.record(z.string(), contractModuleSchema).default({}),
    provenance: contractProvenanceSchema.default({
      approved: false,
      generatedAt: "",
      promptId: "translation-contract-v1",
      model: "deterministic",
    }),
  })
  .strict();
export type TranslationContract = z.infer<typeof translationContractSchema>;

const defined = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/**
 * RFC-1372 overlay merge — field-level replacement, last write wins:
 * site note → site note.locales[lang] → module note → module note.locales[lang].
 * `locales` keys themselves are never part of the merged result.
 */
export function resolveTranslatorNote(
  contract: TranslationContract,
  lang: string,
  moduleId?: string,
): Omit<ContractNote, "locales"> {
  const { locales: siteLocales, ...siteBase } = contract.note;
  const merged: Record<string, unknown> = { ...siteBase };
  Object.assign(merged, defined(siteLocales[lang] ?? {}));
  const mod = moduleId ? contract.modules[moduleId] : undefined;
  if (mod) {
    const { locales: modLocales, ...modBase } = mod.note;
    Object.assign(merged, defined(modBase as Record<string, unknown>));
    Object.assign(merged, defined(modLocales[lang] ?? {}));
  }
  return merged as Omit<ContractNote, "locales">;
}
