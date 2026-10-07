/*
<MODULE_CONTRACT>
<purpose>
[RFC-1198] Property-based tests for referral-partner contract invariants
(DNA-41/DNA-101): schema/loader/resolver determinism over generated inputs.
</purpose>
<non-goals>
  <item>No I/O — pure contract properties only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198: created.</item>
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

import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  REFERRAL_SLUG_PATTERN,
  ReferralPartnerSchema,
  resolveReferralPartner,
  type ReferralPartner,
} from "../partners.ts";

const arbSlug = fc
  .stringMatching(/^[a-z0-9]+(-[a-z0-9]+){0,3}$/)
  .filter((s) => s.length >= 3 && s.length <= 32);

const arbPartner = (slug: string): ReferralPartner => ({
  slug,
  displayName: "P " + slug,
  compensation: "referral-fee",
  locales: ["de"],
  status: "active",
  consent: { method: "channel", channel: "email", grantedAt: "2026-01-01" },
});

describe("ReferralPartnerSchema PBT", () => {
  test("every generated domain slug passes the schema", () => {
    fc.assert(
      fc.property(arbSlug, (slug) => {
        expect(ReferralPartnerSchema.safeParse({ ...arbPartner(slug), slug }).success).toBe(true);
      }),
    );
  });
});

describe("resolveReferralPartner PBT", () => {
  test("a partner always resolves from its own slug — including padded/cased input", () => {
    fc.assert(
      fc.property(
        arbSlug,
        fc.string({ maxLength: 5 }).map((s) => s.replace(/\S/g, " ")),
        (slug, pad) => {
          const resolved = resolveReferralPartner(`${pad}${slug.toUpperCase()}${pad}`, [
            arbPartner(slug),
          ]);
          expect(resolved?.slug).toBe(slug);
        },
      ),
    );
  });

  test("never resolves a slug that is not in the active set", () => {
    fc.assert(
      fc.property(arbSlug, arbSlug, (a, b) => {
        fc.pre(a !== b);
        expect(resolveReferralPartner(b, [arbPartner(a)])).toBeNull();
      }),
    );
  });

  test("slug pattern admits no whitespace or metacharacters", () => {
    fc.assert(
      fc.property(arbSlug, (slug) => {
        expect(REFERRAL_SLUG_PATTERN.test(slug)).toBe(true);
        expect(/[\s<>"'`\\]/.test(slug)).toBe(false);
      }),
    );
  });
});
