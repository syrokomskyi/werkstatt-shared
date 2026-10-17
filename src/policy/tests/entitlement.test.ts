/*
<MODULE_CONTRACT>
<purpose>
Unit tests for entitlement covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1191: initial parser test.</item>
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

import { test, expect } from "vitest";
import { parseEntitledFeatures } from "../entitlement.ts";

const DOC = `
customerId: null
features:
  - blog
  - external-link-qr
source: override
`;

test("parses the generated features list", () => {
  expect(parseEntitledFeatures(DOC)).toEqual(["blog", "external-link-qr"]);
});

test("returns null for absent or empty documents", () => {
  expect(parseEntitledFeatures(undefined)).toBeNull();
  expect(parseEntitledFeatures(null)).toBeNull();
  expect(parseEntitledFeatures("")).toBeNull();
});

test("returns null when features is not an array", () => {
  expect(parseEntitledFeatures("features: {}\n")).toBeNull();
  expect(parseEntitledFeatures("customerId: cus_1\n")).toBeNull();
});

test("returns null for malformed yaml", () => {
  expect(parseEntitledFeatures("features: [unclosed\n  - x")).toBeNull();
});
