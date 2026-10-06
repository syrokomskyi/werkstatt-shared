/*
<MODULE_CONTRACT>
<purpose>
  RFC-1209: resource-budget contract — Zod schemas for the per-site
  `resourceBudget` block, the per-route measurement shape, and the committed
  public report artifact (`/.well-known/resource-budget.json`). Also carries
  the workspace baseline defaults and the resolve() that merges baseline,
  site override, and route overrides.
</purpose>
<non-goals>
  <item>Do not measure dist output — that is the site-module validator's job.</item>
  <item>Do not fetch or weigh third-party resources — origins are counted, never downloaded.</item>
  <item>Do not embed Lighthouse/CWV thresholds — byte/request budgets only (DNA-67 stays separate).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1209: initial contract — schemas, workspace baselines, resolve() merge path, deterministic report shape (buildContentHash, no wall-clock fields — DNA-58).</item>
  <item>RFC-1209: site resource budgets and public transparency surface (RFC-1209)</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

// ---------------------------------------------------------------------------
// RFC-1209: resourceBudget — per-site resource-budget block (system.md)
// ---------------------------------------------------------------------------

export const resourceBudgetConfigSchema = z
  .object({
    /** Total on-disk bytes of HTML + referenced local assets per route. */
    maxPageWeightKb: z.number().positive(),
    /** Total JS bytes loaded by a route (local script srcs + inline <script>). */
    maxJsKb: z.number().positive(),
    /** Asset references per route (local + counted third-party). */
    maxRequests: z.number().int().positive(),
    /** Distinct third-party origins referenced. */
    maxThirdPartyOrigins: z.number().int().min(0),
    /** advisory = warnings only; blocking = errors + non-zero exit. */
    enforce: z.enum(["advisory", "blocking"]),
    /** Per-route overrides keyed by route path (e.g. "/leistungen/"). */
    routeOverrides: z
      .record(
        z.string().min(1),
        z
          .object({
            maxPageWeightKb: z.number().positive().optional(),
            maxJsKb: z.number().positive().optional(),
            maxRequests: z.number().int().positive().optional(),
            maxThirdPartyOrigins: z.number().int().min(0).optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export type ResourceBudgetConfig = z.infer<typeof resourceBudgetConfigSchema>;

export interface RouteResourceMeasurement {
  route: string;
  pageWeightKb: number;
  jsKb: number;
  requests: number;
  thirdPartyOrigins: string[];
}

export const resourceBudgetReportSchema = z
  .object({
    schema: z.literal("gogol.resource-budget/1"),
    siteId: z.string().min(1),
    /** Deterministic link to build-identity.json contentHash — the report
     *  carries no wall-clock fields so generated.drift.validate stays green
     *  (byte-compare on dryRun re-render, DNA-58). */
    buildContentHash: z.string().min(1),
    budgets: resourceBudgetConfigSchema,
    measured: z.object({
      routes: z.number().int().min(0),
      p95PageWeightKb: z.number().min(0),
      maxPageWeightKb: z.number().min(0),
      totalJsKb: z.number().min(0),
    }),
    verdict: z.enum(["within", "exceeded-advisory", "exceeded-blocking"]),
  })
  .strict();

export type ResourceBudgetReport = z.infer<typeof resourceBudgetReportSchema>;

// ---------------------------------------------------------------------------
// Workspace baselines (RFC-1209)
// Provisional values pending the fleet calibration pass — chosen to catch
// catastrophic regressions while staying noise-free on the current fleet
// (advisory rollout means nothing blocks on these anyway).
// ---------------------------------------------------------------------------

export const RESOURCE_BUDGET_BASELINE: ResourceBudgetConfig = {
  maxPageWeightKb: 2048,
  maxJsKb: 512,
  maxRequests: 80,
  maxThirdPartyOrigins: 8,
  enforce: "advisory",
};

// ---------------------------------------------------------------------------
// resolveResourceBudget — baseline → site override → per-route effective budget
// ---------------------------------------------------------------------------

/** Resolve the effective budget for a site: authored override merged over the
 *  workspace baseline. `undefined` input resolves to the baseline. */
export function resolveResourceBudget(
  override: unknown,
): { ok: true; config: ResourceBudgetConfig } | { ok: false; issues: string[] } {
  if (override === undefined || override === null) {
    return { ok: true, config: RESOURCE_BUDGET_BASELINE };
  }
  const parsed = resourceBudgetConfigSchema.safeParse(override);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  return { ok: true, config: { ...RESOURCE_BUDGET_BASELINE, ...parsed.data } };
}

/** Canonical route key: leading + trailing slash, root stays "/". Authored
 *  override keys like "leistungen" or "/leistungen" all normalize to
 *  "/leistungen/" so a missing trailing slash cannot silently skip a budget. */
function normalizeRouteKey(route: string): string {
  const core = route.replace(/^\/+|\/+$/g, "");
  return core === "" ? "/" : `/${core}/`;
}

/** Effective budget for one route: base config with routeOverrides applied. */
export function effectiveBudgetForRoute(
  config: ResourceBudgetConfig,
  route: string,
): ResourceBudgetConfig {
  const overrides = config.routeOverrides;
  if (!overrides) return config;
  const wanted = normalizeRouteKey(route);
  for (const [key, routeOverride] of Object.entries(overrides)) {
    if (normalizeRouteKey(key) === wanted) {
      return { ...config, ...routeOverride, routeOverrides: overrides };
    }
  }
  return config;
}
