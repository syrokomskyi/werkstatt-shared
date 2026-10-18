/*
<MODULE_CONTRACT>
<purpose>
RFC-1326: single source of truth for the Cloudflare API permissions the
workshop token must carry. The registry drives (a) the CLOUDFLARE_API_TOKEN
hint in generated .env.example files, (b) the permission table in
docs/engineering/workshop-setup.md (marked section, rewritten by
cloudflare.permissions.generate), and (c) the read-only probes run by
cloudflare.token.check. Also owns WORKSHOP_ENV_ALLOWLIST — the only
workshop-root .env keys the kernel copies into process.env.
</purpose>
<non-goals>
  <item>Do not create, roll, or revoke tokens — operator-only (dashboard).</item>
  <item>Do not model R2 S3 credentials — those are separate keys.</item>
  <item>Do not prove Edit-vs-Read granularity — probes are read-only; a token holding only Read on an Edit entry still reports ok (documented approximation).</item>
</non-goals>
<KEY_DECISIONS>
  <item>probe: null marks write-only permissions (Cache Purge) — reported as `unknown`, never `missing`, so a healthy token never fails on an unprobeable entry.</item>
  <item>WORKSHOP_ENV_ALLOWLIST entries carry `prefix` — `CLOUDFLARE_` and `R2_` match whole families; every entry names its consumer so growing the list is a deliberate registry edit.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1326: initial — CloudflarePermission, CLOUDFLARE_PERMISSIONS (8 entries), WORKSHOP_ENV_ALLOWLIST, registry-rendered hint/table/env-block helpers.</item>
  <item>RFC-1326: single Cloudflare permission registry, token preflight, birth provisioning</item>
</CHANGE_SUMMARY>
*/

/** One Cloudflare API permission the workshop token may need. */
export interface CloudflarePermission {
  /** Dotted id, e.g. "account.workers-scripts.edit". */
  id: string;
  scope: "account" | "zone";
  /** Dashboard group label, e.g. "Workers Scripts". */
  group: string;
  level: "Read" | "Edit" | "Purge";
  /** Kernel commands (or operator steps) that consume this permission. */
  usedBy: string[];
  /**
   * Read-only GET endpoint proving the scope is granted. `{accountId}` and
   * `{zoneId}` placeholders are substituted by the checker. `null` = the
   * permission is write-only and cannot be probed — the checker reports
   * `unknown`, never `missing`.
   */
  probe: { method: "GET"; path: string } | null;
  /** `always` = required for every site; `custom-domain` = needed once a real domain is live. */
  requiredFor: "always" | "custom-domain";
}

export const CLOUDFLARE_PERMISSIONS: readonly CloudflarePermission[] = [
  {
    id: "account.workers-scripts.edit",
    scope: "account",
    group: "Workers Scripts",
    level: "Edit",
    usedBy: ["leitstand.dev-deploy", "leitstand.promote", "leitstand.access.protect"],
    probe: { method: "GET", path: "/accounts/{accountId}/workers/scripts" },
    requiredFor: "always",
  },
  {
    id: "account.vectorize.edit",
    scope: "account",
    group: "Vectorize",
    level: "Edit",
    usedBy: ["agent.search.index.create", "agent.search.warm"],
    probe: { method: "GET", path: "/accounts/{accountId}/vectorize/v2/indexes" },
    requiredFor: "always",
  },
  {
    id: "account.account-settings.read",
    scope: "account",
    group: "Account Settings",
    level: "Read",
    usedBy: ["sternsystem.register"],
    probe: { method: "GET", path: "/accounts/{accountId}/workers/subdomain" },
    requiredFor: "always",
  },
  {
    id: "zone.zone.read",
    scope: "zone",
    group: "Zone",
    level: "Read",
    usedBy: ["subdomain.register", "customdomain.register", "dns.record.upsert"],
    probe: { method: "GET", path: "/zones/{zoneId}" },
    requiredFor: "custom-domain",
  },
  {
    id: "zone.dns.edit",
    scope: "zone",
    group: "DNS",
    level: "Edit",
    usedBy: ["dns.record.upsert", "subdomain.register"],
    probe: { method: "GET", path: "/zones/{zoneId}/dns_records" },
    requiredFor: "custom-domain",
  },
  {
    id: "zone.workers-routes.edit",
    scope: "zone",
    group: "Workers Routes",
    level: "Edit",
    usedBy: ["customdomain.register"],
    probe: { method: "GET", path: "/zones/{zoneId}/workers/routes" },
    requiredFor: "custom-domain",
  },
  {
    id: "zone.cache-purge.purge",
    scope: "zone",
    group: "Cache Purge",
    level: "Purge",
    usedBy: ["leitstand.dev-deploy", "leitstand.promote"],
    probe: null,
    requiredFor: "custom-domain",
  },
  {
    id: "zone.single-redirect.edit",
    scope: "zone",
    group: "Single Redirect",
    level: "Edit",
    usedBy: ["redirect.register"],
    probe: {
      method: "GET",
      path: "/zones/{zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint",
    },
    requiredFor: "custom-domain",
  },
];

/** `Account → Workers Scripts` dashboard path for one permission. */
export function cloudflarePermissionScopeLabel(p: CloudflarePermission): string {
  const scopeLabel = p.scope === "account" ? "Account" : "Zone";
  return `${scopeLabel} → ${p.group}`;
}

/**
 * Markdown table rows for docs/engineering/workshop-setup.md §3.2 — emitted
 * inside the marked section by cloudflare.permissions.generate.
 */
export function renderCloudflarePermissionTableRows(): string[] {
  return CLOUDFLARE_PERMISSIONS.map(
    (p) =>
      `| **${cloudflarePermissionScopeLabel(p)}** | ${p.scope === "account" ? "Account" : "Zone"} | ` +
      `${p.level} | ${p.usedBy.map((u) => `\`${u}\``).join(", ")} |`,
  );
}

/**
 * The "Required permissions:" comment lines for the generated
 * .env.example Cloudflare block (one `Group → Level (consumers)` per entry).
 */
export function renderCloudflarePermissionCommentLines(): string[] {
  return CLOUDFLARE_PERMISSIONS.map(
    (p) => `#     ${cloudflarePermissionScopeLabel(p)} → ${p.level}  (${p.usedBy.join(", ")})`,
  );
}

/**
 * The CLOUDFLARE_API_TOKEN "How to obtain" hint shared by site and workshop
 * .env.example generators — rendered from the registry so the permission
 * list cannot drift (RFC-1326, AC-2).
 */
export function cloudflareTokenObtainHint(): string {
  const perms = CLOUDFLARE_PERMISSIONS.map(
    (p) => `${cloudflarePermissionScopeLabel(p)} → ${p.level}`,
  ).join(", ");
  return (
    "Cloudflare Dashboard → My Profile → API Tokens → Create Custom Token " +
    "(User API Token, NOT Account API Token). Required permissions: " +
    `${perms}. Scope to your account and the client zones only. ` +
    "See docs/engineering/workshop-setup.md for full guide."
  );
}

/** One workshop-root .env key the kernel may copy into process.env. */
export interface WorkshopEnvAllowlistEntry {
  /** Exact key name — or a prefix when `prefix` is true. */
  key: string;
  prefix?: boolean;
  /** Why the kernel (not a site) needs this key — named consumer, never a wildcard justification. */
  consumer: string;
}

/**
 * RFC-1326 (Q-3): the kernel-resolved workshop credential set. Everything
 * else stays site-level (site .env via context.workpieceEnv) or process-level
 * (a real exported environment). Growing this list means editing the
 * registry with a named consumer — never a wildcard request.
 */
export const WORKSHOP_ENV_ALLOWLIST: readonly WorkshopEnvAllowlistEntry[] = [
  {
    key: "CLOUDFLARE_",
    prefix: true,
    consumer:
      "leitstand deploy, cloudflare.token.check, dns.record.upsert, subdomain/customdomain/redirect.register, agent.search.index.create",
  },
  {
    key: "SIGNING_PRIVATE_KEY",
    consumer: "signing.*, sternsystem.passport.*, sternsystem.handover.*, fleet.claims.*",
  },
  { key: "SIGNING_PRIVATE_KEY_PATH", consumer: "signing key file resolution" },
  {
    key: "WERKSTATT_OPERATOR_SIGNING_KEY",
    consumer: "dht/swim operator-signed payloads (kernel/dht, kernel/swim)",
  },
  {
    key: "R2_",
    prefix: true,
    consumer: "R2 evidence/nachweis S3 credentials (evidence.sync, artifact-store)",
  },
  {
    key: "FLEET_OWNERSHIP_REGISTRY_",
    prefix: true,
    consumer:
      "fleet ownership registry reach (mission.close, sternsystem.validate, e2e.cold, fleet/ownership-registry)",
  },
];

/** True when `key` matches a WORKSHOP_ENV_ALLOWLIST entry (exact or prefix). */
export function workshopEnvAllowed(key: string): boolean {
  return WORKSHOP_ENV_ALLOWLIST.some((entry) =>
    entry.prefix ? key.startsWith(entry.key) : key === entry.key,
  );
}
