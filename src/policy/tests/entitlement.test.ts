/*
<MODULE_CONTRACT>
<purpose>RFC-1191: verify parseEntitledFeatures — the shared reader for the generated
entitlements.yaml document used by runtime endpoints via an inlined ?raw bundle.</purpose>
<responsibilities>
  <item>well-formed document → the features array as strings.</item>
  <item>absent/empty/malformed input → null (fail-closed for paid modules).</item>
</responsibilities>
</MODULE_CONTRACT>
<CHANGE_SUMMARY><item>RFC-1191: initial parser test.</item></CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { parseEntitledFeatures } from "../entitlement.ts";

const DOC = `
customerId: null
features:
  - blog
  - referral.attribution
source: override
`;

test("parses the generated features list", () => {
  expect(parseEntitledFeatures(DOC)).toEqual(["blog", "referral.attribution"]);
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
