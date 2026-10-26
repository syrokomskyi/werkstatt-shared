/*
<MODULE_CONTRACT>
<purpose>Barrel export for the typography module (RFC-1068, RFC-1069, RFC-1070,
RFC-1071). Provides the text-surface extractor, Tier 1, Tier 2, and Tier 3 rule
engines, and locale defaults for the typography.validate command and future
typography rule families.</purpose>
<non-goals>
  <item>Do not implement command adapters — that lives in werkstatt-site.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1069: added Tier 2 structure rules export.</item>
  <item>RFC-1070: added Tier 2 locale rules export.</item>
  <item>RFC-1071: added Tier 3 advisory rules export.</item>
  <item>RFC-1072: added fix module export (FixAction, FIXABLE_RULE_IDS, applyFixes, isFixable).</item>
  <item>ADR-0116: compose-hygiene rules — COMP-PROMISE-01/COMP-SELFDESC-01 on typography.validate, COMP-I18N-01 lang-switcher on chrome.data.validate, DIST-LEAK-10 NEED_THIS_* placeholders on dist.serialization-leakage.validate</item>
  <history>RFC-1068</history>
</CHANGE_SUMMARY>
*/

export {
  extractTextSurface,
  TECHNICAL_KEYS,
  deriveFileLocale,
  type TextSegment,
  type TextSegmentSource,
  type TextSurfaceOptions,
  type YamlError,
  type ExtractTextSurfaceResult,
} from "./text-surface.ts";

export {
  TIER1_RULES,
  DEFAULT_ALLOWED_TOKENS,
  CYRILLIC_SCRIPT_LOCALES,
  createTypographyContext,
  type TypographyRuleId,
  type TypographyRuleFamily,
  type TypographyFinding,
  type TypographyRule,
  type TypographyContext,
} from "./rules-tier1.ts";

export { TIER2_STRUCTURE_RULES } from "./rules-tier2-structure.ts";

export { TIER2_LOCALE_RULES, type Tier2LocaleRuleId } from "./rules-tier2-locale.ts";

export { TIER3_ADVISORY_RULES, type Tier3AdvisoryRuleId } from "./rules-tier3-advisory.ts";

export {
  COMPOSE_HYGIENE_RULES,
  PROMISE_PHRASES,
  SELFDESC_PHRASES,
} from "./rules-compose-hygiene.ts";

export {
  LOCALE_DEFAULTS,
  getLocaleDefaults,
  type LocaleTypographyDefaults,
} from "./locale-defaults.ts";

export { type FixAction, FIXABLE_RULE_IDS, isFixable, applyFixes } from "./fix.ts";
