/*
<MODULE_CONTRACT>
<purpose>Barrel export for @warpgogol/werkstatt-shared/observability — the observability port package (RFC-0337).</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0337: initial implementation.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

export {
  buildResourceAttributes,
  OTLP_ENDPOINT_ENV,
  OTLP_TOKEN_ENV,
  WARPGOGOL_ENVIRONMENTS,
  WARPGOGOL_LAYERS,
  type OtlpKeyValue,
  type WarpgogolEnvironment,
  type WarpgogolLayer,
  type WarpgogolResourceInput,
} from "./conventions.ts";

export {
  findMetricSpec,
  isLabelKeyForbidden,
  isMetricNameValid,
  FORBIDDEN_LABEL_KEYS,
  METRIC_NAME_PATTERN,
  WARPGOGOL_METRIC_REGISTRY,
  type WarpgogolMetricKind,
  type WarpgogolMetricSpec,
} from "./metric-registry.ts";

export {
  encodeOtlpMetrics,
  nowUnixNano,
  type OtlpGaugePoint,
  type OtlpHistogramPoint,
  type OtlpMetricPoint,
  type OtlpMetricsEnvelope,
  type OtlpSumPoint,
  type UnixNanoString,
} from "./otlp-json.ts";

export { createMetricsPusher, type MetricsPusher, type MetricsPusherEnv } from "./pusher.ts";

export { redactUrl } from "./redact.ts";

export {
  METRIC_REFS,
  type TypedCounter,
  type TypedGauge,
  type TypedHistogram,
} from "./typed-refs.ts";
