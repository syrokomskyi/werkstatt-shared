/*
<MODULE_CONTRACT>
<purpose>
  RFC-1292: grammar-gate contracts — the site's .author/grammar.yaml config
  (language mapping, ignore words, disabled LanguageTool rules with mandatory
  reasons, pinned serverVersion) and the shrink-only .author/grammar-baseline.yaml
  (frozen finding keys; GRAM-01 fires only on keys absent from it).
</purpose>
<non-goals>
  <item>No LanguageTool client — that lives in werkstatt-site checks/text-corpus/languagetool-client.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1292: initial — grammarConfigSchema + grammarBaselineSchema + grammarFindingKey.</item>
  <item>RFC-1292: gate rendered-text grammar via self-hosted LanguageTool with shrink-only baseline (RFC-1292)

Adds GRAM-01..05 to text.corpus.validate: LanguageTool findings diff against
an operator-owned .author/grammar-baseline.yaml (init flag freezes, prune flag
shrinks-only), LANGUAGETOOL_URL-configured servers fail closed, absent config
warns GRAM-05. LT results cache under .cache keyed on text+lang+rules+version.
Baseline writes are mutatingFlags-gated and refuse on stale corpus (CORPUS-01).
Extractor fixed to space text nodes across element boundaries. C09 activated
with a stub LtClient. Live LT 6.7 verified (NACH_7_TAGE, GERMAN_SPELLER_RULE);
runbook + .env.example + AGENTS.md updated; no real-site baseline authored.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { corpusSegmentKindSchema } from "./schema.ts";

export const grammarConfigSchema = z
  .object({
    schema: z.literal("werkstatt/grammar-config@1"),
    /** Site lang → LanguageTool code, e.g. { de: "de-DE", uk: "uk-UA" }. */
    languages: z.record(z.string(), z.string()),
    /** Exact-match words ignored as findings (brand/product terms). */
    ignoreWords: z.array(z.string()).default([]),
    /** LanguageTool rule ids — each needs a reason in disabledRuleReasons. */
    disabledRules: z.array(z.string()).default([]),
    disabledRuleReasons: z.record(z.string(), z.string()).default({}),
    /** Pinned LT image tag; part of the cache key — bump with the runbook tag. */
    serverVersion: z.string().optional(),
    /** Restrict checking to these segment kinds; default: all kinds. */
    segmentKinds: z.array(corpusSegmentKindSchema).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const r of v.disabledRules) {
      if (!v.disabledRuleReasons[r]) {
        ctx.addIssue({ code: "custom", message: `disabledRules ${r} needs a reason` });
      }
    }
  });
export type GrammarConfig = z.infer<typeof grammarConfigSchema>;

export const grammarFindingKeySchema = z
  .object({
    route: z.string(),
    lang: z.string(),
    path: z.string(),
    /** LanguageTool rule id. */
    ruleId: z.string(),
    /** Matched substring (exact). */
    match: z.string(),
  })
  .strict();
export type GrammarFindingKey = z.infer<typeof grammarFindingKeySchema>;

export const grammarBaselineSchema = z
  .object({
    schema: z.literal("werkstatt/grammar-baseline@1"),
    entries: z.array(grammarFindingKeySchema.extend({ message: z.string() })),
  })
  .strict();
export type GrammarBaseline = z.infer<typeof grammarBaselineSchema>;

export function grammarFindingKey(k: GrammarFindingKey): string {
  return `${k.route}\u0000${k.lang}\u0000${k.path}\u0000${k.ruleId}\u0000${k.match}`;
}
