/*
<MODULE_CONTRACT>
<purpose>
RFC-1325: single predicate module for site-host classification. Every
host-dependent branch (access protection, dns upsert, search verification,
dns-aid generation, certify) MUST import from here — a local `workers.dev`
or `^(dev|alt)[.-]` literal is a HOST-01 defect.
</purpose>
<non-goals>
  <item>DNS record management or domain registration — this module only classifies and derives host strings.</item>
  <item>PIN/access logic — access-protection.ts consumes isDevOrAltHost from here.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Lives under middleware/ — the deployed Worker bundle reaches shared only via ./middleware/* subpaths.</item>
  <item>channelHost takes the channel workerName so provisional hosts map to &lt;workerName&gt;.&lt;account-subdomain&gt; — the caller owns worker-name derivation (dev-&lt;id&gt; etc.).</item>
  <item>provisional-studio-domain reuses the custom-domain dotted channel form (dev.&lt;id&gt;.&lt;base&gt;) so pre- and post-adoption host shapes are identical — classification comes from deployment.hosting, never from host suffixes.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1325: review r1 — pin-carrying probes, AC-3 write ordering, dns-aid validate parity, hardened host lint</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
  <item>RFC-1492: rename production deploy channel main to prod with single DEPLOY_CHANNELS definition and CHANNEL-01 guard</item>
  <item>RFC-1529: declared host kind contracts + SITE_HOST_KIND propagation

Third SiteHostKind provisional-studio-domain, deployment.hosting schema, isProvisionalKind predicate, declared-kind noindex in access-protection, SITE_HOST_KIND vars token in wrangler template + config-regenerate.</item>
  <item>RFC-1529: declared staging-zone hosting end-to-end</item>
  <history>RFC-1325</history>
</CHANGE_SUMMARY>
*/

// @ai-invariant[INV-sitehost-01]: every host-dependent branch imports classification from this module — a local workers.dev or dev/alt-prefix literal elsewhere is a HOST-01 defect (checked-by: test:packages/werkstatt-site/src/checks/site-host-lint.test.ts)

import type { DeployChannel } from "../ontology/operations/leitstand.ts";

/**
 * RFC-1325 host classification: a real registered domain vs a provisional host.
 * RFC-1529: `provisional-studio-domain` — provisional semantics on a declared
 * staging zone (declared via `deployment.hosting`, never host-suffix inferred).
 */
export type SiteHostKind =
  "custom-domain" | "provisional-workers-dev" | "provisional-studio-domain";

const WORKERS_DEV_SUFFIX = ".workers.dev";

/** Strip a scheme, port, and trailing path so callers may pass a domain or a URL. */
function normalizeHost(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

/** Classify a site domain: `*.workers.dev` hosts are provisional, everything else is a custom domain. */
export function siteHostKind(domain: string): SiteHostKind {
  const host = normalizeHost(domain);
  return host === "workers.dev" || host.endsWith(WORKERS_DEV_SUFFIX)
    ? "provisional-workers-dev"
    : "custom-domain";
}

/** True when `domain` is set and resolves to the provisional workers.dev host. */
export function isProvisionalHost(domain: string | undefined): boolean {
  return (
    domain !== undefined && domain.length > 0 && siteHostKind(domain) === "provisional-workers-dev"
  );
}

/**
 * RFC-1529: true when a declared host kind carries provisional semantics
 * (PIN on dev/alt, noindex, dns-aid/verification skips). Operates on the kind
 * VALUE — the caller resolves it from `deployment.hosting.kind` or the
 * `SITE_HOST_KIND` runtime var; host-string inference stays forbidden.
 */
export function isProvisionalKind(kind: SiteHostKind | string | undefined): boolean {
  return kind === "provisional-workers-dev" || kind === "provisional-studio-domain";
}

/**
 * Derive the serving host for a channel.
 * - custom-domain: `dev.<domain>` / `alt.<domain>` / `<domain>` (RFC-0899 convention).
 * - provisional-studio-domain: identical to custom-domain — the dotted channel
 *   shape `dev.<id>.<staging>` unifies pre- and post-adoption host forms (RFC-1529).
 * - provisional-workers-dev: `<workerName>.<account-subdomain>` — the worker
 *   name IS the host label (`dev-<id>`, `alt-<id>`, `<id>`), so prod and dev/alt
 *   share the same derivation. `workerName` is the caller-derived channel worker
 *   name (RFC-0902 rule: adoption renames hosts, never worker names).
 */
export function channelHost(
  kind: SiteHostKind,
  domain: string,
  channel: DeployChannel,
  workerName: string,
): string {
  if (kind === "custom-domain" || kind === "provisional-studio-domain") {
    if (channel === "dev") return `dev.${domain}`;
    if (channel === "alt") return `alt.${domain}`;
    return domain;
  }
  const parts = normalizeHost(domain).split(".");
  if (parts.length < 4) {
    throw new Error(
      `[site-host] provisional channel host needs a <worker>.<account>.workers.dev domain, got '${domain}'`,
    );
  }
  const suffix = parts.slice(1).join(".");
  return `${workerName}.${suffix}`;
}

/** Build a worker's FQDN on the account subdomain: `<workerName>.<account>.workers.dev`. */
export function workersDevHost(workerName: string, accountSubdomain: string): string {
  return `${workerName}.${accountSubdomain}${WORKERS_DEV_SUFFIX}`;
}

/**
 * Dev/alt channel hosts: `dev.<domain>` / `alt.<domain>` on a custom domain,
 * and `dev-<site>.<account>.workers.dev` / `alt-<site>…` on a provisional
 * workers.dev host — the single `^(dev|alt)[.-]` rule (rehomed from
 * access-protection.ts; the private copy at certify.ts:1364 is deleted).
 */
export function isDevOrAltHost(host: string): boolean {
  return /^(dev|alt)[.-]/i.test(host);
}

const HOST_LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * True for a bare lowercase host name (`<label>.<label>.<tld>`): every label
 * alphanumeric with interior hyphens only, TLD alphabetic and ≥2 chars.
 * Single-sourced here — `--domain` validators at sternsystem.register and
 * site.domain.adopt share it; a local host-shape regex is the same HOST-01
 * defect class as a local classification literal.
 */
export function isBareHostname(domain: string): boolean {
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1]!;
  if (!/^[a-z]{2,}$/.test(tld)) return false;
  return labels.every((label) => HOST_LABEL_RE.test(label));
}
