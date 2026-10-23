/*
<MODULE_CONTRACT>
<purpose>
  RFC-1291/1372: term-entry contract — the per-locale term shape
  (`canonical`/`forbidden` + kinds/routes/pbpRef/severity scoping) the corpus
  matchers consume. The site's `.author/translation-contract.yaml`
  `terms[].forms[lang]` projects into TermEntry; the standalone
  `.author/terms.yaml` registry carrier is retired (CONTRACT-07).
  text.corpus.validate enforces it over the rendered-text corpus (TERM-01/03).
</purpose>
<non-goals>
  <item>No global all-sites list — terms are per site.</item>
  <item>No matching logic — compileTermMatcher lives in werkstatt-site rules/terms.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1291: initial — termEntrySchema/termRegistrySchema (werkstatt/term-registry@1).</item>
  <item>RFC-1291: per-site term registry over the rendered corpus</item>
  <item>RFC-1372: termRegistrySchema/TermRegistry retired with the .author/terms.yaml carrier — TermEntry survives as the per-locale projection of contract terms[].forms[lang] (review F-23).</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";
import { corpusSegmentKindSchema } from "./schema.ts";

export const termEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    /** BCP-47 primary tag as used by the site (de, uk, en). */
    lang: z.string().min(2),
    /** Human note: what this term names. */
    concept: z.string().min(1),
    canonical: z.string().min(1),
    forbidden: z.array(z.string().min(1)).min(1),
    /** Unicode letter/number boundaries. */
    wholeWord: z.boolean().default(true),
    /** German nouns are case-significant; UK vs uk matters. */
    caseSensitive: z.boolean().default(true),
    /** Limit to segment kinds (e.g. button, aria-label). */
    kinds: z.array(corpusSegmentKindSchema).optional(),
    /** Limit to route prefixes. */
    routes: z.array(z.string().startsWith("/")).optional(),
    /** Braceless content ref, e.g. business-profile.offerings/x.charges.activation.label. */
    pbpRef: z.string().optional(),
    severity: z.enum(["error", "warning"]).default("error"),
  })
  .strict();
export type TermEntry = z.infer<typeof termEntrySchema>;
