/*
<MODULE_CONTRACT>
<purpose>
[RFC-1198] Source-consistency guard: the cookie-based RFC-1191 capture surface
must stay deleted. Scans the shared + site source trees for banned literals
(cookie name, capture module, attribution reader, removed entitlement, storage
writes in referral paths) and asserts zero survivors in executable code.
</purpose>
<non-goals>
  <item>Does not scan comments or Compass headers — historical references in
  /* * / and // comment regions are documentation, not live code paths.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198: created.</item>
  <item>RFC-1198: comment-aware scan — literals are checked against code with
  block/line comments stripped, so Compass headers and doc comments may keep
  historical names while executable code stays clean.</item>
  <item>RFC-1198: cookie-free referral attribution — /r/<slug> partner landings + voluntary referrer field

Replace the RFC-1191 wg_ref cookie capture with URL+form attribution:
static /r/<slug> and /<lang>/r/<slug> partner landings (noindex, zero JS,
consent-gated via publicNameConsentRef), ?ref prefill on the existing
referrerField rail, server-side slug resolution against the bundled
partners.yaml, referral_partner_slug/name on the Lagebild ingress contract,
legacy /?ref -> /r/<slug> 302 in the generated worker, and full removal of
the cookie capture module (wg_ref, referral.attribution entitlement,
payload.attribution).</item>
</CHANGE_SUMMARY>
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// Literals are concatenated so this guard file does not match its own scan.
const BANNED = [
  "wg_" + "ref",
  "referral-" + "capture",
  "readAttribution" + "FromRequest",
  "ReferralAttribution" + "Payload",
  "referral" + ".attribution",
  "referral" + "_code",
  "first" + "_touch_at",
  "Ingress" + "Attribution",
  "payload" + ".attribution",
];

const SRC_ROOTS = ["packages/werkstatt-shared/src", "packages/werkstatt-site/src"];
const EXTENSIONS = new Set([".ts", ".astro"]);

// Contract-mirror allowlist (PLAN-RFC-1238-01): the vendored Lagebild
// website-ingress schema still declares the legacy `attribution` block as a
// bounded-window tolerant-reader field (Lagebild RFC-0016) for un-migrated
// sites — the removal condition is owned by ADR-0106. The derived wire types
// and their conformance test must therefore
// name `referral_code`/`first_touch_at`/`IngressAttribution` — these are the
// contract surface, not the deleted cookie machinery (no reader, no cookie,
// no entitlement, no sender path populates them).
const ALLOWLIST = new Set([
  "packages/werkstatt-shared/src/integration/codegen/verbund-contract-types.ts",
  "packages/werkstatt-shared/src/integration/lagebild-contracts.types.generated.ts",
  "packages/werkstatt-shared/src/integration/tests/verbund-contract.test.ts",
  "packages/werkstatt-shared/src/integration/index.ts",
]);

const REPO_ROOT = process.cwd().replace(/packages\/werkstatt-shared$/, "");

function* sourceFiles(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name !== "node_modules" && name !== "dist") yield* sourceFiles(full);
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      yield full;
    }
  }
}

/**
 * Strips block and line comments so banned names remain legal inside
 * documentation (Compass headers, doc comments) while staying banned in
 * executable code. String literals are left intact — a string carrying a
 * banned literal IS a live reference.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function scan(literal: string): string[] {
  const hits: string[] = [];
  for (const root of SRC_ROOTS) {
    for (const file of sourceFiles(join(REPO_ROOT, root))) {
      const code = stripComments(readFileSync(file, "utf-8"));
      if (code.includes(literal)) {
        const rel = file.replace(REPO_ROOT, "").replace(/^\//, "");
        if (!ALLOWLIST.has(rel)) hits.push(rel);
      }
    }
  }
  return hits;
}

describe("RFC-1198 no-cookie remnants guard", () => {
  for (const literal of BANNED) {
    test(`zero live references to ${literal}`, () => {
      expect(scan(literal)).toEqual([]);
    });
  }
});
