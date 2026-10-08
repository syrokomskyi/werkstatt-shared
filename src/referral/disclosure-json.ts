/*
<MODULE_CONTRACT>
<purpose>
[RFC-1222] Canonical builder for the `/r/<slug>.json` machine-readable
disclosure twin. Single source for both the emitted endpoint and the
`referral.json.parity.validate` check — the validator recomputes the expected
document through this builder, so drift means "the emitted bytes differ from
what the PBP facts say", never two hand-maintained shapes.
Closed shape: pending and retired partners emit exactly {type, slug, status}
— no identity, no economics.
</purpose>
<non-goals>
  <item>No PBP imports — facts arrive pre-resolved (ReferralProgramFacts), keeping this module pure and testable.</item>
  <item>No display-phrase economics — callers must resolve amounts from PBP entities (DNA-103).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1222: created — disclosure twin builder shared by the generated endpoint and the parity validator.</item>
  <item>RFC-1222 pending-landing amendment (operator, 2026-10-07): pending partners emit the nameless closed document — the route exists while consent is unrecorded, identity does not.</item>
</CHANGE_SUMMARY>
*/

import { referralDisclosureKind, type ReferralCompensation } from "./copy.ts";
import type { ReferralPartner } from "./partners.ts";

/** Program economics resolved from PBP entities — every field is absent
    rather than invented. */
export interface ReferralProgramFacts {
  readonly rewardAmount?: number;
  readonly rewardCurrency?: string;
  readonly rewardTrigger?: string;
  readonly qualifyingPeriod?: string;
  readonly benefit?: { readonly freePeriod?: string; readonly priorityStart?: boolean };
  readonly policyEffectiveFrom?: string;
}

/** The retired and pending documents are deliberately closed — three fields,
    no identity. Pending keeps the route alive while consent is unrecorded;
    retired preserves the historical slug after the active window. `paused` is
    in the union for completeness — paused partners emit no route, so the
    document never ships. */
export interface ReferralPartnerClosedDoc {
  readonly type: "referral-partner";
  readonly slug: string;
  readonly status: "retired" | "pending" | "paused";
}

export interface ReferralPartnerActiveDoc {
  readonly type: "referral-partner";
  readonly slug: string;
  readonly status: "active";
  readonly compensation: {
    readonly mode: ReferralCompensation;
    readonly reward?: { readonly currency: string; readonly amount: number };
    readonly trigger?: string;
    readonly qualifyingPeriod?: string;
  };
  readonly referredCustomerBenefit?: {
    readonly freePeriod?: string;
    readonly priorityStart?: boolean;
  };
  readonly customerPriceIncrease: false;
  readonly disclosure: "paid" | "unpaid";
  readonly referrerDisplayName: string;
  readonly policyEffectiveFrom?: string;
  readonly contactUrl: string;
}

export type ReferralPartnerDoc = ReferralPartnerActiveDoc | ReferralPartnerClosedDoc;

/**
 * Builds the emitted `/r/<slug>.json` document. Pending and retired partners
 * emit the closed nameless document — the route exists, identity does not.
 */
export function buildReferralPartnerDoc(
  partner: ReferralPartner,
  facts: ReferralProgramFacts,
): ReferralPartnerDoc | null {
  if (partner.status !== "active") {
    return { type: "referral-partner", slug: partner.slug, status: partner.status };
  }
  const reward =
    facts.rewardAmount !== undefined && facts.rewardCurrency
      ? { currency: facts.rewardCurrency, amount: facts.rewardAmount }
      : undefined;
  return {
    type: "referral-partner",
    slug: partner.slug,
    status: "active",
    compensation: {
      mode: partner.compensation,
      ...(reward ? { reward } : {}),
      ...(facts.rewardTrigger ? { trigger: facts.rewardTrigger } : {}),
      ...(facts.qualifyingPeriod ? { qualifyingPeriod: facts.qualifyingPeriod } : {}),
    },
    ...(facts.benefit ? { referredCustomerBenefit: facts.benefit } : {}),
    customerPriceIncrease: false,
    disclosure: referralDisclosureKind(partner.compensation),
    // The schema guarantees displayName on active partners (consent covers a
    // name that must exist) — the `?? ""` branch is unreachable but keeps the
    // builder total under the widened optional type.
    referrerDisplayName: partner.displayName ?? "",
    ...(facts.policyEffectiveFrom ? { policyEffectiveFrom: facts.policyEffectiveFrom } : {}),
    contactUrl: `/r/${partner.slug}`,
  };
}
