/*
<MODULE_CONTRACT>
<purpose>RFC-1191: verify parseEntitledFeatures — the shared reader for the generated
entitlements.yaml document used by runtime endpoints via an inlined ?raw bundle.</purpose>
<responsibilities>
  <item>well-formed document → the features array as strings.</item>
  <item>absent/empty/malformed input → null (fail-closed for paid modules).</item>
</responsibilities>
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
