/*
<MODULE_CONTRACT>
<purpose>Barrel export for the typography module (RFC-1068, RFC-1069). Provides the
text-surface extractor, Tier 1 and Tier 2 rule engines, and locale defaults for
the typography.validate command and future typography rule families.</purpose>
<non-goals>
  <item>Do not implement command adapters — that lives in werkstatt-site.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1068: initial creation.</item>
  <item>RFC-1069: added Tier 2 structure rules export.</item>
  <item>RFC-1070: added Tier 2 locale rules export.</item>
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
  createTypographyContext,
  type TypographyRuleId,
  type TypographyRuleFamily,
  type TypographyFinding,
  type TypographyRule,
  type TypographyContext,
} from "./rules-tier1.ts";

export { TIER2_STRUCTURE_RULES } from "./rules-tier2-structure.ts";

export {
  LOCALE_DEFAULTS,
  getLocaleDefaults,
  type LocaleTypographyDefaults,
} from "./locale-defaults.ts";
