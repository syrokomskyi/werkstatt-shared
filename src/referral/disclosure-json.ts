/*
<MODULE_CONTRACT>
<purpose>
[RFC-1222] Canonical builder for the `/r/<slug>.json` machine-readable
disclosure twin. Single source for both the emitted endpoint and the
`referral.json.parity.validate` check — the validator recomputes the expected
document through this builder, so drift means "the emitted bytes differ from
what the PBP facts say", never two hand-maintained shapes.
Closed shape: retired partners emit exactly {type, slug, status} — no
identity, no economics.
</purpose>
<non-goals>
  <item>No PBP imports — facts arrive pre-resolved (ReferralProgramFacts), keeping this module pure and testable.</item>
  <item>No display-phrase economics — callers must resolve amounts from PBP entities (DNA-103).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1222: created — disclosure twin builder shared by the generated endpoint and the parity validator.</item>
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

/** The retired document is deliberately closed — three fields, no identity. */
export interface ReferralPartnerRetiredDoc {
  readonly type: "referral-partner";
  readonly slug: string;
  readonly status: "retired";
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

export type ReferralPartnerDoc = ReferralPartnerActiveDoc | ReferralPartnerRetiredDoc;

/**
 * Builds the emitted `/r/<slug>.json` document. `pending` returns null —
 * pending partners emit nothing at all (same emission gate as the landing).
 */
export function buildReferralPartnerDoc(
  partner: ReferralPartner,
  facts: ReferralProgramFacts,
): ReferralPartnerDoc | null {
  if (partner.status === "pending") return null;
  if (partner.status === "retired") {
    return { type: "referral-partner", slug: partner.slug, status: "retired" };
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
    referrerDisplayName: partner.displayName,
    ...(facts.policyEffectiveFrom
      ? { policyEffectiveFrom: facts.policyEffectiveFrom }
      : {}),
    contactUrl: `/r/${partner.slug}`,
  };
}
