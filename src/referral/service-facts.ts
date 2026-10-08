/*
<MODULE_CONTRACT>
<purpose>
[referral-brief-v1] Service-fact contract for the referral landing v3 — the
numbers and ruleset anchors the page may cite (prices, service commitments,
qualifying period, AGB version). All values are derived upstream from PBP
entities (offerings, policies, publicDocuments); every field is optional so a
missing policy drops only its own claim — the copy layer must degrade
truthfully rather than invent digits (DNA-103).
</purpose>
<non-goals>
  <item>No PBP imports — this is the pure contract consumed by the copy module and produced by the site-side derivation.</item>
  <item>No display strings — amounts/durations stay numeric; formatting happens in copy.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>referral-brief-v1: created — single typed fact set replacing per-copy literal economics.</item>
</CHANGE_SUMMARY>
*/

/** Canonical fact keys whose values link a landing row to a section anchor on
    the site's AGB page. Site-authored per language — the platform declares
    only the vocabulary. */
export const REFERRAL_AGB_ANCHOR_KEYS = [
  "inquiryNonBinding",
  "responseHours",
  "launchWorkdays",
  "availabilitySla",
  "smallChangeHours",
  "handoverHours",
  "priorityReferral",
  "partnerProgram",
  "excludedServices",
  "unsupportedProjects",
  "smallBusiness",
  "priceFix",
  "cancellation",
  "b2b",
  "productScope",
  "activationFee",
  "reviewResult",
] as const;
export type ReferralAgbAnchorKey = (typeof REFERRAL_AGB_ANCHOR_KEYS)[number];
export type ReferralAgbAnchors = Partial<Record<ReferralAgbAnchorKey, string>>;

/** Landing v3 service facts — all derived from PBP entities. */
export interface ReferralServiceFacts {
  /** Activation price (one-time, e.g. 200). */
  readonly activationPrice?: number;
  /** Monthly subscription (e.g. 70). */
  readonly monthlyPrice?: number;
  /** Yearly subscription (e.g. 700). */
  readonly yearlyPrice?: number;
  readonly priceCurrency?: string;
  /** Launch window in working days (delivery-guarantee threshold). */
  readonly launchWorkdays?: number;
  /** Delay remedy type (delivery-guarantee remedy.type, e.g.
      "continued-performance" — the copy maps known tokens to truthful
      clauses; unknown tokens are omitted). */
  readonly launchRemedy?: string;
  /** Delay credit per day (delivery-guarantee terms.delayCreditPerDay). */
  readonly delayCreditPerDay?: number;
  /** Availability objective percent (availability-sla threshold). */
  readonly availabilityPercent?: number;
  /** Small-changes window in hours (small-changes threshold). */
  readonly smallChangeHours?: number;
  /** Support response window in hours (support-response threshold). */
  readonly responseHours?: number;
  /** Exit handover window in hours (exit-package deliveryTarget). */
  readonly handoverHours?: number;
  /** Reward qualifying period in days (partner-program qualifyingPeriod). */
  readonly qualifyingDays?: number;
  /** Studio intake wave slots (digital-foundation availability.slotRange). */
  readonly waveSlots?: { readonly min: number; readonly max: number };
  /** AGB document version (documents/terms presentation.version). */
  readonly termsVersion?: string;
  /** AGB document effective date (documents/terms governance.effectiveFrom). */
  readonly termsEffectiveFrom?: string;
}
