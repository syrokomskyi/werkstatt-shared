/*
<MODULE_CONTRACT>
<purpose>
  Environment resolver for observability — extracts OTLP endpoint/token
  and deployment environment from a MetricsPusherEnv or global process.env.
  Extracted from pusher.ts for testability and reuse.
</purpose>
<non-goals>
  <item>Do not import node: modules — must be Workers-compatible.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import type { WarpgogolEnvironment } from "./conventions.ts";

export interface MetricsPusherEnv {
  endpoint?: string;
  token?: string;
}

interface ProcessEnvLike {
  env?: Record<string, string | undefined>;
}

function getGlobalProcess(): ProcessEnvLike | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const g = globalThis as Record<string, unknown>;
  return typeof g["process"] === "object" && g["process"] !== null
    ? (g["process"] as ProcessEnvLike)
    : undefined;
}

export function resolvePusherEnv(env?: MetricsPusherEnv): { endpoint?: string; token?: string } {
  if (env) return env;
  const proc = getGlobalProcess();
  if (proc?.env) {
    return {
      endpoint: proc.env["WARPGOGOL_OTLP_ENDPOINT"],
      token: proc.env["WARPGOGOL_OTLP_TOKEN"],
    };
  }
  return {};
}

export function detectEnvironment(): WarpgogolEnvironment {
  const proc = getGlobalProcess();
  const raw = proc?.env
    ? (proc.env["WARPGOGOL_DEPLOYMENT_ENV"] ?? proc.env["NODE_ENV"])
    : undefined;
  if (raw === "production") return "production";
  if (raw === "preview") return "preview";
  if (raw === "ci") return "ci";
  return "development";
}
