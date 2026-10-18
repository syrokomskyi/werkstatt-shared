/*
<MODULE_CONTRACT>
<purpose>
RFC-1326 acceptance tests: CLOUDFLARE_PERMISSIONS registry contents
(AC-1 — Vectorize Edit carries agent.search.index.create in usedBy),
probe coverage invariants, WORKSHOP_ENV_ALLOWLIST matching, and the
registry-rendered doc/hint strings the three permission surfaces consume.
</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1326: initial — AC-1 registry assertions, probe/unknown invariants, allow-list match, render helpers.</item>
  <item>RFC-1326: single Cloudflare permission registry, token preflight, birth provisioning</item>
  <item>RFC-1326: review-fix pass — siteName targeting for app-scoped provisioning, allow-list completion</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, test } from "vitest";
import {
  CLOUDFLARE_PERMISSIONS,
  WORKSHOP_ENV_ALLOWLIST,
  cloudflareTokenObtainHint,
  renderCloudflarePermissionCommentLines,
  renderCloudflarePermissionTableRows,
  workshopEnvAllowed,
} from "./permissions.ts";

describe("CLOUDFLARE_PERMISSIONS", () => {
  // AC-1: Vectorize Edit is listed and names agent.search.index.create.
  test("AC-1: account.vectorize.edit lists agent.search.index.create in usedBy", () => {
    const vectorize = CLOUDFLARE_PERMISSIONS.find((p) => p.id === "account.vectorize.edit");
    expect(vectorize).toBeDefined();
    expect(vectorize!.scope).toBe("account");
    expect(vectorize!.level).toBe("Edit");
    expect(vectorize!.requiredFor).toBe("always");
    expect(vectorize!.usedBy).toContain("agent.search.index.create");
  });

  test("the eight dp7-verified permissions are present", () => {
    expect(CLOUDFLARE_PERMISSIONS.map((p) => p.id)).toEqual([
      "account.workers-scripts.edit",
      "account.vectorize.edit",
      "account.account-settings.read",
      "zone.zone.read",
      "zone.dns.edit",
      "zone.workers-routes.edit",
      "zone.cache-purge.purge",
      "zone.single-redirect.edit",
    ]);
  });

  test("every permission is probeable except write-only Cache Purge", () => {
    for (const p of CLOUDFLARE_PERMISSIONS) {
      if (p.id === "zone.cache-purge.purge") {
        expect(p.probe).toBeNull();
      } else {
        expect(p.probe, p.id).not.toBeNull();
        expect(p.probe!.method).toBe("GET");
      }
    }
  });

  test("account probes substitute {accountId}, zone probes substitute {zoneId}", () => {
    for (const p of CLOUDFLARE_PERMISSIONS) {
      if (!p.probe) continue;
      if (p.scope === "account") {
        expect(p.probe.path, p.id).toContain("{accountId}");
      } else {
        expect(p.probe.path, p.id).toContain("{zoneId}");
      }
    }
  });

  test("Page Rules is absent — the stale copy listed it, the registry does not", () => {
    expect(CLOUDFLARE_PERMISSIONS.some((p) => /page.rules/i.test(p.id))).toBe(false);
  });
});

describe("WORKSHOP_ENV_ALLOWLIST", () => {
  test("kernel keys are allowed; site/service keys are not", () => {
    for (const allowed of [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_ZONE_ID",
      "CLOUDFLARE_READONLY_API_TOKEN",
      "SIGNING_PRIVATE_KEY",
      "SIGNING_PRIVATE_KEY_PATH",
      "WERKSTATT_OPERATOR_SIGNING_KEY",
      "R2_AXIOM_ACCOUNT_ID",
      "R2_NACHWEIS_SECRET_ACCESS_KEY",
      "FLEET_OWNERSHIP_REGISTRY_URL",
      "FLEET_OWNERSHIP_REGISTRY_TOKEN",
      "PASSPORT_SIGNING_KEY",
      "PUBLIC_KEY_URL",
      "LLM_PROVIDER",
      "LLM_MODEL",
      "LLM_API_KEY",
      "WARPGOGOL_OTLP_ENDPOINT",
      "WARPGOGOL_OTLP_TOKEN",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]) {
      expect(workshopEnvAllowed(allowed), allowed).toBe(true);
    }
    for (const denied of [
      "LANGUAGETOOL_URL",
      "LAGEBILD_API_KEY",
      "GH_TOKEN",
      "OPENAI_API_KEY",
      "SEARCH_REINDEX_TOKEN",
      "STRIPE_SECRET_KEY",
      "GSC_SERVICE_ACCOUNT_JSON",
      "ECOSYSTEM_COMMIT",
    ]) {
      expect(workshopEnvAllowed(denied), denied).toBe(false);
    }
  });

  test("every entry names its consumer — a wildcard request cannot sneak in", () => {
    for (const entry of WORKSHOP_ENV_ALLOWLIST) {
      expect(entry.consumer.length, entry.key).toBeGreaterThan(10);
    }
  });
});

describe("registry-rendered surfaces", () => {
  test("the token obtain hint lists every registry permission", () => {
    const hint = cloudflareTokenObtainHint();
    for (const p of CLOUDFLARE_PERMISSIONS) {
      expect(hint).toContain(`${p.group} → ${p.level}`);
    }
    expect(hint).not.toContain("Page Rules");
  });

  test("doc table rows carry scope, level and consumers", () => {
    const rows = renderCloudflarePermissionTableRows();
    expect(rows).toHaveLength(CLOUDFLARE_PERMISSIONS.length);
    expect(rows[1]).toContain("**Account → Vectorize**");
    expect(rows[1]).toContain("`agent.search.index.create`");
  });

  test("env comment lines are #-prefixed and carry consumers", () => {
    const lines = renderCloudflarePermissionCommentLines();
    expect(lines).toHaveLength(CLOUDFLARE_PERMISSIONS.length);
    for (const line of lines) {
      expect(line.startsWith("#     ")).toBe(true);
    }
    expect(lines[1]).toContain("agent.search.index.create");
  });
});
