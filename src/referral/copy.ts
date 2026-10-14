/*
<MODULE_CONTRACT>
<purpose>
[referral-brief-v1] Platform-owned locale copy for the referral-partner
landing page (/r/<slug>), v7 — recommendation-first order: hero (label,
name, about line, consented links — no CTA row, no chips, no disclosure
block), statement/confirms (consent-gated), vorteil, the single conditions
section, the person-first transparency card, and the referral form strings
— the § 5a UWG disclosure is the closing footnote under the submit button
(warpgogol-m000200); plus the neutral mode-D variant and the visitor
auto-reply.
The disclosure sentences are legal text — the platform owns the sentence
structure so the same disclosure shape ships on every site; site-varying
phrases (reward amount, scope/exclusion lines, AGB anchor map) arrive via
ReferralLandingFacts resolved from partners.yaml `landing`, and every number
traces to ReferralServiceFacts derived from PBP entities (DNA-103). DE is the
legally binding version; UK is a synced reference translation.
</purpose>
<non-goals>
  <item>Do not interpolate anything beyond the declared facts — the copy is fixed contract text.</item>
  <item>Do not add storage/cookie strings — the page must be able to claim zero storage truthfully.</item>
  <item>Do not hardcode site names, prices, verticals, or document section numbers — they are site-authored facts or PBP-derived.</item>
  <item>No "verified"/"geprüft"/"zertifiziert"/"garantiert" claims about the recommendation, no SEO/ROI promises.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1278: agbLinkLabel — the "(AGB)" conditions-commitment anchor label moved out of referral-partner-page.astro markup into the copy contract (shared-ui.thin-copy now scans ui/components).</item>
  <item>RFC-1258: two-voice copy — statement/basis/confirms sections, capacityLine + validUntilLine (dated facts), transparency learns row (site-authored recommenderLearnsLine), verifyLinks (nachweise/notausgang); recommenderLearnsLine fact plumbed through resolveReferralLandingFacts.</item>
  <item>REVIEW-CODE-2026-10-11-01 fixes: uk phrase-guard patterns + explicit-delimiter uk negation (JS \b is ASCII-only), lang-aware sentence splitting, thousands-separator-safe money parsing, confirms aria-label, photo leading-slash contract, sectionNavItems statement/passtnicht anchors.</item>
  <item>RFC-1273: v5 recommendation-first copy — leistungSummary (≤3 PBP-interpolated lines) + leistungMoreLink replace the 8-item leistung; freedomLine for the raised verify section; refWithLabel becomes (displayName | null) => string; transparency code label demoted to "(technisch)"; secondaryNavLabel removed (verify is a section now). fo-review F6/F7: referralNameVisible/referralVorteilVisible/referralVerifyVisible — the section-visibility predicates shared by the component and the route handler's nav.</item>
  <item>RFC-1277: v6 copy — brief v3 phase 1 removes the five generic sections (leistung/preis/zusagen/passtnicht/steps) in favour of one "conditions" block (studio paragraph + interpolated price line + three AGB-anchored commitments + not-for line + full-standard link); transparency keeps exactly five rows; ctaPreis removed (single CTA); new keys: conditions*, fitsHeading, statementDisclosure, clientStatusLine, recommenderInstagramLabel, agbBindingNote (uk-only non-empty); referralSentenceDate fixes the uk "р.." double period; display-aware voice predicates (statement/basis/fits/confirms/heroAbout/links/photo).</item>
  <item>RFC-1277: review fixes: JSON-twin honors display.*; drop orphaned landing: copy facts; heroAbout requires statement gate; CSS class + dead ghost CTA; v6 wording in validators/docs; REVIEW_TOKENS word boundaries; schema-gate tests (81+73 green)</item>
  <history>REVIEW-CODE-2026, RFC-1198, RFC-1222, RFC-1249, warpgogol-m000193</history>
</CHANGE_SUMMARY>
*/

import type { ReferralLandingConfig, ReferralPartner } from "./partners.ts";
import type {
  ReferralAgbAnchorKey,
  ReferralAgbAnchors,
  ReferralServiceFacts,
} from "./service-facts.ts";

export type ReferralCompensation = "referral-fee" | "none" | "steward";

/** RFC-1222: disclosure-structure version stamped onto the submit payload.
    Manual constant — bump only when the disclosure sentence structure changes,
    never auto-incremented. */
export const REFERRAL_DISCLOSURE_VERSION = "v2";

/** RFC-1222: the § 5a Abs. 4 UWG binary — "is there a commercial interest".
    `referral-fee` and `steward` are paid; `none` is unpaid. The finer
    distinction stays in `compensation.mode`; this answers only the binary. */
export type ReferralDisclosureKind = "paid" | "unpaid";
export function referralDisclosureKind(compensation: ReferralCompensation): ReferralDisclosureKind {
  return compensation === "none" ? "unpaid" : "paid";
}

/** Localized long date for receipt rows ("Erfasst", "Stand"). */
export function referralLocalDate(isoDate: string, lang: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "de-DE", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

/** RFC-1277 (brief v3 2.2): sentence-safe date — some locales end the long
    form with their own period (uk-UA: "13 квітня 2027 р."), so templates
    that append a sentence period would double it ("р.."). Strips the
    terminal dot for mid- and end-of-sentence interpolation. */
export function referralSentenceDate(isoDate: string, lang: string): string {
  return referralLocalDate(isoDate, lang).replace(/\.$/, "");
}

/** Localized money phrase — "200 €" (integer amounts stay fraction-free). */
export function referralMoney(amount: number, currency: string | undefined, lang: string): string {
  const formatted = new Intl.NumberFormat(lang === "uk" ? "uk-UA" : "de-DE", {
    style: "currency",
    currency: currency ?? "EUR",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
  return formatted;
}

/** Referred-customer benefit derived from the site's PBP partner-program
    policy (`referredCustomerBenefit` + `terms.referralFreePeriodCondition`).
    All fields already localized/formatted by the caller. */
export interface ReferralBenefitFacts {
  /** Localized free-period phrase (e.g. "1 Monat"). */
  readonly freePeriod?: string;
  /** Whether the program promises a priority start slot. */
  readonly priorityStart?: boolean;
  /** Free-period condition token (e.g. "active-in-second-month") — known
      tokens map to a localized clause, unknown tokens are omitted. */
  readonly freePeriodCondition?: string;
}

/** Site-varying landing phrases, already resolved for one language. Every
    field is optional — absent facts degrade to truthful generic wording. */
export interface ReferralLandingFacts {
  /** Reward display phrase per compensation variant (e.g. "70 €"). */
  readonly reward?: { readonly "referral-fee"?: string; readonly steward?: string };
  /** Steward role term (e.g. "Markt-Steward"). Fallback: "Partner". */
  readonly stewardRole?: string;
  /** Referred-customer benefit from the PBP partner-program policy. */
  readonly benefit?: ReferralBenefitFacts;
  /** PBP-derived service facts (prices, commitments, qualifying period,
      AGB version). */
  readonly service?: ReferralServiceFacts;
  /** Site-authored AGB section anchors for this language. */
  readonly anchors?: ReferralAgbAnchors;
}

/**
 * Resolves the site-authored `landing` block (lang → phrase maps) into the
 * per-language facts the copy module consumes. Missing languages fall back
 * to `fallbackLang`, then to the first authored phrase.
 */
export function resolveReferralLandingFacts(
  config: ReferralLandingConfig | null | undefined,
  lang: string,
  fallbackLang = "de",
): ReferralLandingFacts {
  if (!config) return {};
  const pick = (map: Record<string, string> | undefined): string | undefined =>
    map?.[lang] ?? map?.[fallbackLang] ?? Object.values(map ?? {})[0];
  const referralFee = pick(config.rewardPhrases?.["referral-fee"]);
  const steward = pick(config.rewardPhrases?.steward);
  const anchorsRaw = config.agbAnchors?.[lang] ?? config.agbAnchors?.[fallbackLang];
  return {
    stewardRole: pick(config.stewardRole),
    ...(referralFee || steward ? { reward: { "referral-fee": referralFee, steward } } : {}),
    ...(anchorsRaw ? { anchors: anchorsRaw as ReferralAgbAnchors } : {}),
  };
}

/** One left-column commitment row — anchored to the owning AGB section. */
export interface ReferralCommitmentRow {
  readonly text: string;
  readonly anchorKey: ReferralAgbAnchorKey;
}

/** The disclosure split: bold label + calm sentence(s), mode-aware. */
export interface ReferralDisclosureLine {
  readonly label: string;
  readonly text: string;
  /** The referral code embedded verbatim in `text` (anonymous phrasing only)
      — the renderer wraps it in <code> so the slug reads as a token, not a
      name. Absent when a consented display name carries the sentence. */
  readonly code?: string;
}

export interface ReferralTransparencyCopy {
  heading: string;
  /** warpgogol-m000200: exactly four rows — recommendedBy + yourPrice +
      ruleset + code (the kind row is gone; the compensation disclosure
      lives in the closing footnote under the form). */
  labels: {
    code: string;
    recommendedBy: string;
    yourPrice: string;
    ruleset: string;
  };
  yourPrice: string;
  /** "AGB, § 3 Abs. 5 und § 12 (Fassung 4.2)" — the version arrives from the
      AGB document metadata, never hardcoded. */
  rulesetLabel: (version: string | undefined) => string;
  closing: string;
}

export interface ReferralFormCopy {
  heading: string;
  /** Prefix the enhanced client's mailto fallback puts before the code. */
  refPrefix: string;
  /** Visible label of the textarea on the native error re-render. */
  messageLabel: string;
  /** Textarea placeholder — must ask for a reachable contact inside the text. */
  messageHelp: string;
  submitLabel: string;
  sendingLabel: string;
  /** Live checklist labels (enhanced path) — the contact item mirrors the
      same requirement `contactRequired` states on the native error doc. */
  checklistTitle: string;
  checklistReadyLabel: string;
  checklistLengthLabel: string;
  checklistContactLabel: string;
  privacyNote: string;
  privacyLinkLabel: string;
  successMessage: string;
  errorSummary: string;
  /** Per-field errors on the native re-rendered error document — the
      one-field form keeps only the message plus the extracted-contact hint. */
  contactRequired: string;
  messageRequired: string;
}

/** Visitor auto-reply — the same response promise as the success message,
    the visitor's own message copy, and the referral code when one applied.
    Compensation is never restated differently than on the page. */
export interface ReferralAutoReplyCopy {
  subject: string;
  body: (args: { message: string; code?: string }) => string;
}

/** Mode-D neutral document — no referral mention anywhere. */
export interface ReferralNeutralCopy {
  title: string;
  lead: string;
  /** Form privacy sentence — deliberately free of any referral-code mention. */
  privacyNote: string;
}

/** RFC-1222: retired-partner status page copy — never carries the name. */
export interface ReferralRetiredCopy {
  title: string;
  status: string;
  home: string;
}

export interface ReferralLandingCopy {
  /** Header CTA → #referral-form. */
  headerCta: string;
  heroLabel: string;
  /** Interpolates {displayName, siteName} — mode A only. */
  h1Named: (displayName: string) => string;
  /** Modes B/C — name-free. */
  h1Anonymous: string;
  lead: string;
  /** The disclosure line — label + text resolved per compensation and identity.
      warpgogol-m000200: renders as the closing footnote under the submit
      button, no longer as the hero block. */
  disclosure: (
    compensation: ReferralCompensation,
    displayName: string | null,
    slug: string,
  ) => ReferralDisclosureLine;
  vorteilHeading: string;
  vorteilText: string | null;
  /** RFC-1277 (brief v3 2.5): the single generic-terms section replacing the
      five former blocks (leistung/preis/zusagen/passtnicht/steps) — the
      studio paragraph is the former hero `lead`, prices/commitments stay
      PBP- and AGB-anchored. */
  conditionsHeading: string;
  /** One interpolated price line: activation + monthly (+ yearly option),
      UStG note, cancellation term. Missing facts drop their clause. */
  conditionsPriceLine: string;
  /** Exactly three anchored commitments: launch window, handover, response. */
  conditionsCommitments: readonly ReferralCommitmentRow[];
  /** The single not-a-fit line — anchored to the AGB exclusions section. */
  conditionsNotFor: { text: string; anchorKey: ReferralAgbAnchorKey };
  /** Link label to the full Digitales-Fundament page (href = the former
      leistungMoreHref target). */
  conditionsFullLink: string;
  b2bLine: string;
  b2bAnchorKey: ReferralAgbAnchorKey;
  /** RFC-1278: "(AGB)" — the conditions-commitment anchor link label; a law
      document abbreviation, identical in de/uk, but never a markup literal. */
  agbLinkLabel: string;
  quoteAriaLabel: string;
  /** RFC-1258: the recommender's voice section headings. */
  statementHeading: string;
  basisHeading: string;
  /** RFC-1277 (brief v3 3.3): heading of the standalone fits block —
      first-person voice like the statement heading. */
  fitsHeading: string;
  /** RFC-1277 (brief v3 3.2): the basis-block client-status line — renders
      for both answers ("… ist (k)ein Kunde von …"), absent data = no line. */
  clientStatusLine: (displayName: string, isClient: boolean) => string;
  /** RFC-1258: the bounded-assertion block — what the recommender confirms
      and does not confirm (platform-fixed sentences). warpgogol-m000200:
      the per-column name titles are gone — the check/cross list markers
      carry the contrast, the section aria-label names the frame. */
  confirms: {
    ariaLabel: string;
    left: readonly string[];
    right: readonly string[];
  };
  /** RFC-1258: dated wave-capacity line — pre-rendered from the PBP capacity
      fact; null when the fact is absent (the landing then shows the static
      waveSlots range line only). Freshness is the validator's job. */
  capacityText: string | null;
  /** RFC-1258: expiry line — "Empfehlung gültig bis …". */
  validUntilLine: (isoDate: string) => string;
  /** RFC-1258: headings of the recommender's own fit lists (scope data). */
  scopeFitsHeading: string;
  scopeDoesNotFitHeading: string;
  /** aria-label of the hero nav wrapping the recommender's consented
      external links (website/instagram). warpgogol-m000200: own key —
      the former verify-heading reuse is gone with the verify section. */
  recommenderLinksLabel: string;
  /** RFC-1258: label of the consent-gated link to the recommender's website.
      warpgogol-m000200: plain short label — the nav's aria-label already
      names the recommender. */
  recommenderWebsiteLabel: string;
  /** RFC-1277: label of the consent-gated Instagram link (hero). */
  recommenderInstagramLabel: string;
  /** RFC-1277 (brief v3 2.8): the note under the transparency card naming
      the binding AGB language version — non-empty only on locales whose
      AGB is a reference translation (UK: "Обов'язковою є німецька версія
      AGB."). DE stays empty — the German page IS the binding version. */
  agbBindingNote: string;
  transparency: ReferralTransparencyCopy;
  form: ReferralFormCopy;
  autoReply: ReferralAutoReplyCopy;
  neutral: ReferralNeutralCopy;
  retired: ReferralRetiredCopy;
}

// ---------------------------------------------------------------------------
// Fact interpolation helpers — every placeholder resolves from facts, never
// from literals. Missing facts degrade to truthful phrasing.
// ---------------------------------------------------------------------------

function whoPhrase(
  displayName: string | null,
  slug: string,
  lang: "de" | "uk",
  capitalized: boolean,
): string {
  if (displayName) return displayName;
  if (lang === "uk") {
    return capitalized ? `Володар коду рекомендації ${slug}` : `володар коду рекомендації ${slug}`;
  }
  return capitalized
    ? `Der Inhaber des Empfehlungscodes ${slug}`
    : `der Inhaber des Empfehlungscodes ${slug}`;
}

function rewardPhrase(facts: ReferralLandingFacts, compensation: ReferralCompensation): string {
  return (
    (compensation === "steward" ? facts.reward?.steward : facts.reward?.["referral-fee"]) ?? ""
  );
}

function qualifyingDaysText(facts: ReferralServiceFacts | undefined, lang: "de" | "uk"): string {
  const days = facts?.qualifyingDays;
  if (days === undefined) {
    return lang === "uk"
      ? "протягом передбаченого строку активності та оплати"
      : "für die vereinbarte Qualifizierungszeit aktiv und bezahlt";
  }
  return lang === "uk"
    ? `протягом ${days} днів активною та оплаченою`
    : `${days} Tage aktiv und bezahlt`;
}

function disclosureDe(
  facts: ReferralLandingFacts,
  compensation: ReferralCompensation,
  displayName: string | null,
  slug: string,
  siteName: string,
): ReferralDisclosureLine {
  switch (compensation) {
    case "referral-fee": {
      const who = whoPhrase(displayName, slug, "de", false);
      const reward = rewardPhrase(facts, compensation) || "eine Vergütung";
      return {
        label: "Vergütete Empfehlung.",
        text: `Wird aus dieser Empfehlung ein Kunde und bleibt dessen Subscription ${qualifyingDaysText(facts.service, "de")}, erhält ${who} ${reward} von ${siteName}. Ihr Listenpreis ändert sich dadurch nicht.`,
        ...(displayName ? {} : { code: slug }),
      };
    }
    case "none":
      return {
        label: "Empfehlung ohne Geldvergütung.",
        text: `${whoPhrase(displayName, slug, "de", true)} erhält für diese Empfehlung keine Zahlung von ${siteName}.`,
        ...(displayName ? {} : { code: slug }),
      };
    case "steward": {
      const who = whoPhrase(displayName, slug, "de", true);
      const extra = facts.reward?.steward ? `, unter anderem ${facts.reward.steward}` : "";
      return {
        label: "Vergütete Empfehlung.",
        text: `${who} ist als ${facts.stewardRole ?? "Partner"} für ${siteName} tätig und erhält dafür eine Vergütung${extra}. Ihr Listenpreis ändert sich dadurch nicht.`,
        ...(displayName ? {} : { code: slug }),
      };
    }
  }
}

function disclosureUk(
  facts: ReferralLandingFacts,
  compensation: ReferralCompensation,
  displayName: string | null,
  slug: string,
  siteName: string,
): ReferralDisclosureLine {
  switch (compensation) {
    case "referral-fee": {
      const who = whoPhrase(displayName, slug, "uk", false);
      const reward = rewardPhrase(facts, compensation) || "винагороду";
      return {
        label: "Рекомендація з винагородою.",
        text: `Якщо з цієї рекомендації з'явиться Клієнт і його підписка залишатиметься ${qualifyingDaysText(facts.service, "uk")}, ${who} отримає ${reward} від ${siteName}. Ваша ціна за прайсом через це не змінюється.`,
        ...(displayName ? {} : { code: slug }),
      };
    }
    case "none":
      return {
        label: "Рекомендація без грошової винагороди.",
        text: `${whoPhrase(displayName, slug, "uk", true)} не отримує жодної виплати від ${siteName} за цю рекомендацію.`,
        ...(displayName ? {} : { code: slug }),
      };
    case "steward": {
      const who = whoPhrase(displayName, slug, "uk", true);
      const extra = facts.reward?.steward ? `, зокрема ${facts.reward.steward}` : "";
      return {
        label: "Рекомендація з винагородою.",
        text: `${who} працює для ${siteName} як ${facts.stewardRole ?? "партнер"} і отримує за це винагороду${extra}. Ваша ціна за прайсом через це не змінюється.`,
        ...(displayName ? {} : { code: slug }),
      };
    }
  }
}

/** RFC-1277 (brief v3 2.5): the one-line price clause — activation +
    monthly (+ yearly alternative), UStG note, cancellation term. Every
    amount is PBP-derived; a missing fact drops its clause instead of
    inventing a number. */
function conditionsPriceLineDe(facts: ReferralLandingFacts): string {
  const s = facts.service;
  const cur = s?.priceCurrency;
  const activation =
    s?.activationPrice !== undefined ? referralMoney(s.activationPrice, cur, "de") : undefined;
  const monthly =
    s?.monthlyPrice !== undefined ? referralMoney(s.monthlyPrice, cur, "de") : undefined;
  const yearly = s?.yearlyPrice !== undefined ? referralMoney(s.yearlyPrice, cur, "de") : undefined;
  const price =
    activation && monthly
      ? `${activation} Aktivierung + ${monthly} im Monat${yearly ? ` (oder ${yearly} im Jahr)` : ""}`
      : monthly
        ? `${monthly} im Monat`
        : "Preise nach dem veröffentlichten Standard";
  const cancel =
    s?.cancellationDays !== undefined
      ? ` Kündigung: ${s.cancellationDays} Tage zum Monatsende.`
      : "";
  return `${price}, Endpreise ohne Umsatzsteuer (§ 19 UStG).${cancel}`;
}

function conditionsPriceLineUk(facts: ReferralLandingFacts): string {
  const s = facts.service;
  const cur = s?.priceCurrency;
  const activation =
    s?.activationPrice !== undefined ? referralMoney(s.activationPrice, cur, "uk") : undefined;
  const monthly =
    s?.monthlyPrice !== undefined ? referralMoney(s.monthlyPrice, cur, "uk") : undefined;
  const yearly = s?.yearlyPrice !== undefined ? referralMoney(s.yearlyPrice, cur, "uk") : undefined;
  const price =
    activation && monthly
      ? `${activation} активація + ${monthly} на місяць${yearly ? ` (або ${yearly} на рік)` : ""}`
      : monthly
        ? `${monthly} на місяць`
        : "ціни за опублікованим стандартом";
  const cancel =
    s?.cancellationDays !== undefined
      ? ` Розірвання: за ${s.cancellationDays} днів до кінця місяця.`
      : "";
  return `${price}, без ПДВ (§ 19 UStG).${cancel}`;
}

function vorteilDe(facts: ReferralLandingFacts, siteName: string): string | null {
  const benefit = facts.benefit;
  if (!benefit || (!benefit.freePeriod && !benefit.priorityStart)) return null;
  const parts: string[] = [];
  if (benefit.priorityStart) {
    const wave =
      facts.service?.waveSlots && `${facts.service.waveSlots.min}–${facts.service.waveSlots.max}`;
    parts.push(
      wave
        ? `starten Sie mit Priorität in der nächsten Welle (${siteName} nimmt ${wave} Websites pro Monat auf)`
        : `starten Sie mit Priorität in der nächsten Welle`,
    );
  }
  if (benefit.freePeriod) {
    const condition =
      benefit.freePeriodCondition === "active-in-second-month"
        ? ", sofern Sie im 2. Monat aktiv bleiben"
        : "";
    parts.push(`erhalten ${benefit.freePeriod} Subscription kostenlos${condition}`);
  }
  const activation =
    facts.service?.activationPrice !== undefined
      ? ` Die Aktivierungsgebühr von ${referralMoney(facts.service.activationPrice, facts.service.priceCurrency, "de")} bleibt unverändert.`
      : " Die Aktivierungsgebühr bleibt unverändert.";
  return `Als empfohlener Betrieb ${parts.join(" und ")}.${activation}`;
}

function vorteilUk(facts: ReferralLandingFacts, siteName: string): string | null {
  const benefit = facts.benefit;
  if (!benefit || (!benefit.freePeriod && !benefit.priorityStart)) return null;
  const parts: string[] = [];
  if (benefit.priorityStart) {
    const wave =
      facts.service?.waveSlots && `${facts.service.waveSlots.min}–${facts.service.waveSlots.max}`;
    parts.push(
      wave
        ? `стартуєте з пріоритетом у наступній хвилі (${siteName} бере ${wave} вебсайти на місяць)`
        : `стартуєте з пріоритетом у наступній хвилі`,
    );
  }
  if (benefit.freePeriod) {
    const condition =
      benefit.freePeriodCondition === "active-in-second-month"
        ? ", якщо Ви залишаєтесь активними на 2-й місяць"
        : "";
    parts.push(`отримуєте ${benefit.freePeriod} підписки безкоштовно${condition}`);
  }
  const activation =
    facts.service?.activationPrice !== undefined
      ? ` Внесок за активацію ${referralMoney(facts.service.activationPrice, facts.service.priceCurrency, "uk")} не змінюється.`
      : " Внесок за активацію не змінюється.";
  return `Як рекомендований бізнес Ви ${parts.join(" і ")}.${activation}`;
}

function deCopy(siteName: string, facts: ReferralLandingFacts): ReferralLandingCopy {
  const s = facts.service;
  const launchDays = s?.launchWorkdays;
  const response = s?.responseHours;
  const handover = s?.handoverHours;
  // REVIEW-CODE-2026-10-08-02: no invented digits — an absent support-response
  // policy degrades to a numberless sentence, never a guessed "24".
  const responseSentence =
    response !== undefined
      ? `Wir antworten innerhalb von ${response} Stunden an Werktagen per E-Mail.`
      : "Wir antworten an Werktagen per E-Mail.";
  const launchDelayClause =
    s?.launchRemedy === "continued-performance"
      ? "; bei Verzug durch uns arbeiten wir kostenlos weiter bis zum Launch"
      : "";

  return {
    headerCta: "Situation beschreiben",
    heroLabel: "EMPFEHLUNG",
    h1Named: (name) => `${name} empfiehlt Ihnen ${siteName}`,
    h1Anonymous: `Man hat Ihnen ${siteName} empfohlen`,
    lead: `${siteName} baut Websites für kleine Unternehmen, Handwerksbetriebe und Selbständige: auf Ihrer eigenen Domain, mit schriftlichen Bedingungen und einem festen Ausstieg.`,
    disclosure: (compensation, displayName, slug) =>
      disclosureDe(facts, compensation, displayName, slug, siteName),
    vorteilHeading: "Ihr Empfehlungsvorteil",
    vorteilText: vorteilDe(facts, siteName),
    // RFC-1277 (brief v3 2.5): the single conditions section — the studio
    // paragraph (former hero lead) renders in the component, the price line
    // and commitments stay PBP/AGB-anchored; the launch delay clause keeps
    // its home in the launch commitment row.
    conditionsHeading: "Die Konditionen kurz",
    conditionsPriceLine: conditionsPriceLineDe(facts),
    conditionsCommitments: [
      {
        text:
          launchDays !== undefined
            ? `Launch in ${launchDays} Werktagen ab Projektstart${launchDelayClause}`
            : `Launch ab Projektstart${launchDelayClause}`,
        anchorKey: "launchWorkdays",
      },
      {
        text:
          handover !== undefined
            ? `vollständige Übergabe in ${handover} Stunden nach Vertragsende`
            : "vollständige Übergabe nach Vertragsende",
        anchorKey: "handoverHours",
      },
      {
        text:
          response !== undefined
            ? `Antwort in ${response} Stunden an Werktagen`
            : "Antwort an Werktagen",
        anchorKey: "responseHours",
      },
    ],
    conditionsNotFor: {
      text: "Nicht für Onlineshops mit Warenpositionen und Lagerbeständen, Portale und SEO-Garantien",
      anchorKey: "unsupportedProjects",
    },
    conditionsFullLink: "Vollständiger Standard und alle Bedingungen",
    b2bLine:
      "Dieses Angebot gilt für Unternehmer, Selbständige und Freiberufler (§ 14 BGB), nicht für Verbraucher.",
    b2bAnchorKey: "b2b",
    agbLinkLabel: "(AGB)",
    quoteAriaLabel: "Wörtliche Empfehlung",
    statementHeading: "Warum ich das empfehle",
    basisHeading: "Was ich selbst geprüft habe",
    fitsHeading: "Wem ich das empfehle — und wem nicht",
    clientStatusLine: (displayName, isClient) =>
      isClient
        ? `${displayName} ist Kunde von ${siteName}.`
        : `${displayName} ist kein Kunde von ${siteName}.`,
    confirms: {
      ariaLabel: "Was diese Empfehlung bedeutet — und was nicht",
      left: [
        "dass sie die schriftlichen Bedingungen des Studios kennt",
        "dass sie das Angebot für eine Aufgabe wie Ihre für passend hält",
      ],
      right: [
        "bestimmte Ergebnisse, Positionen in der Suche oder Anfragen",
        "dass Sie etwas unterschreiben oder buchen müssen",
        "die Richtigkeit jeder einzelnen Angabe des Studios",
      ],
    },
    capacityText: s?.capacity
      ? `Nächste Welle: ${s.capacity.month}, ${s.capacity.free} von ${s.capacity.total} Plätzen frei.`
      : null,
    validUntilLine: (isoDate) =>
      `Diese Empfehlung gilt bis ${referralSentenceDate(isoDate, "de")}.`,
    scopeFitsHeading: "Wofür das passt",
    scopeDoesNotFitHeading: "Wofür das nicht passt",
    recommenderLinksLabel: "Die Empfehlungsgeberin prüfen",
    recommenderWebsiteLabel: "Website",
    recommenderInstagramLabel: "Instagram",
    agbBindingNote: "",
    transparency: {
      heading: "Transparenz",
      labels: {
        code: "Empfehlungscode (technisch)",
        recommendedBy: "Empfohlen von",
        yourPrice: "Ihr Preis",
        ruleset: "Regelwerk",
      },
      yourPrice: "Listenpreis unverändert; Vorteil siehe Bedingungen",
      rulesetLabel: (version) =>
        version ? `AGB, § 3 Abs. 5 und § 12 (Fassung ${version})` : "AGB, § 3 Abs. 5 und § 12",
      closing: "Die Empfehlung verpflichtet Sie zu nichts.",
    },
    form: {
      heading: "Situation beschreiben",
      refPrefix: "Empfohlen von: ",
      messageLabel: "Nachricht",
      messageHelp:
        "Was haben Sie heute, was fehlt — und wie erreichen wir Sie (E-Mail oder Telefon)?",
      submitLabel: `Prüfen lassen, ob ${siteName} passt`,
      sendingLabel: "Wird gesendet …",
      checklistTitle: "Zum Senden fehlt:",
      checklistReadyLabel: "Alles bereit — senden Sie Ihre Anfrage",
      checklistLengthLabel: "Mindestens 24 Zeichen geschrieben",
      checklistContactLabel: "E-Mail-Adresse oder Telefonnummer im Text hinterlassen",
      privacyNote:
        "Wir nutzen auf dieser Seite keine Cookies und speichern nichts auf Ihrem Gerät. Der Empfehlungscode wird nur mit Ihrer Anfrage übermittelt.",
      privacyLinkLabel: "Datenschutzerklärung",
      successMessage: `Danke. Ihre Anfrage ist angekommen. ${responseSentence} Schauen Sie bei Bedarf im Spam-Ordner nach.`,
      errorSummary: "Einige Angaben fehlen oder sind ungültig.",
      contactRequired:
        "Bitte hinterlassen Sie eine E-Mail-Adresse oder Telefonnummer in der Nachricht.",
      messageRequired: "Bitte schreiben Sie eine Nachricht.",
    },
    autoReply: {
      subject: `Ihre Anfrage bei ${siteName}`,
      body: ({ message, code }) =>
        [
          `Danke für Ihre Anfrage bei ${siteName}.`,
          "",
          "Ihre Nachricht (Kopie):",
          message,
          "",
          ...(code ? [`Empfehlungscode: ${code}`, ""] : []),
          `${responseSentence} Schauen Sie bei Bedarf im Spam-Ordner nach.`,
        ].join("\n"),
    },
    neutral: {
      title: `Ihre Anfrage an ${siteName}`,
      lead:
        response !== undefined
          ? `Beschreiben Sie kurz Ihre Situation — wir antworten innerhalb von ${response} Stunden an Werktagen.`
          : "Beschreiben Sie kurz Ihre Situation — wir antworten an Werktagen.",
      privacyNote:
        "Wir nutzen auf dieser Seite keine Cookies und speichern nichts auf Ihrem Gerät.",
    },
    retired: {
      title: "Diese Empfehlung ist nicht mehr aktiv",
      status: `${siteName} können Sie weiterhin unabhängig prüfen.`,
      home: "Zur Startseite",
    },
  };
}

function ukCopy(siteName: string, facts: ReferralLandingFacts): ReferralLandingCopy {
  const s = facts.service;
  const launchDays = s?.launchWorkdays;
  const response = s?.responseHours;
  const handover = s?.handoverHours;
  const responseSentence =
    response !== undefined
      ? `Ми відповідаємо протягом ${response} годин у робочі дні електронною поштою.`
      : "Ми відповідаємо в робочі дні електронною поштою.";
  const launchDelayClause =
    s?.launchRemedy === "continued-performance"
      ? "; при зволіканні з нашого боку працюємо безкоштовно до запуску"
      : "";

  return {
    headerCta: "Описати ситуацію",
    heroLabel: "РЕКОМЕНДАЦІЯ",
    h1Named: (name) => `${name} рекомендує Вам ${siteName}`,
    h1Anonymous: `Вам рекомендували ${siteName}`,
    lead: `${siteName} робить вебсайти для малого бізнесу, ремесла та самозайнятих: на Вашому власному домені, з письмовими умовами та передбаченим виходом.`,
    disclosure: (compensation, displayName, slug) =>
      disclosureUk(facts, compensation, displayName, slug, siteName),
    vorteilHeading: "Ваша перевага за рекомендацією",
    vorteilText: vorteilUk(facts, siteName),
    // RFC-1277 (brief v3 2.5): одна секція «Умови коротко» замість п'яти
    // колишніх блоків — абзац про студію (колишній hero lead) рендерить
    // компонент; ціни й зобов'язання лишаються PBP/AGB-заякореними.
    conditionsHeading: "Умови коротко",
    conditionsPriceLine: conditionsPriceLineUk(facts),
    conditionsCommitments: [
      {
        text:
          launchDays !== undefined
            ? `запуск за ${launchDays} робочих днів від старту проєкту${launchDelayClause}`
            : `запуск від старту проєкту${launchDelayClause}`,
        anchorKey: "launchWorkdays",
      },
      {
        text:
          handover !== undefined
            ? `повна передача за ${handover} годин після завершення договору`
            : "повна передача після завершення договору",
        anchorKey: "handoverHours",
      },
      {
        text:
          response !== undefined
            ? `відповідь за ${response} годин у робочі дні`
            : "відповідь у робочі дні",
        anchorKey: "responseHours",
      },
    ],
    conditionsNotFor: {
      text: "Не підходить: інтернет-магазини з товарними позиціями та залишками, портали, SEO-гарантії",
      anchorKey: "unsupportedProjects",
    },
    conditionsFullLink: "Повний стандарт і всі умови",
    b2bLine:
      "Ця пропозиція діє для підприємців, самозайнятих і вільних професій (§ 14 BGB), не для споживачів.",
    b2bAnchorKey: "b2b",
    agbLinkLabel: "(AGB)",
    quoteAriaLabel: "Дослівна рекомендація",
    statementHeading: "Чому я це рекомендую",
    basisHeading: "Що я перевірила особисто",
    fitsHeading: "Кому я це раджу — і кому ні",
    clientStatusLine: (displayName, isClient) =>
      isClient
        ? `${displayName} — клієнт ${siteName}.`
        : `${displayName} не є клієнтом ${siteName}.`,
    confirms: {
      ariaLabel: "Що означає ця рекомендація — і що ні",
      left: [
        "що вона знає письмові умови студії",
        "що вона вважає пропозицію придатною для завдання, схожого на Ваше",
      ],
      right: [
        "певних результатів, позицій у пошуку чи звернень",
        "що Ви мусите щось підписати чи забронювати",
        "правильності кожної окремої умови студії",
      ],
    },
    capacityText: s?.capacity
      ? `Наступна хвиля: ${s.capacity.month}, ${s.capacity.free} з ${s.capacity.total} місць вільно.`
      : null,
    validUntilLine: (isoDate) => `Ця рекомендація діє до ${referralSentenceDate(isoDate, "uk")}.`,
    scopeFitsHeading: "Кому це підходить",
    scopeDoesNotFitHeading: "Кому не підходить",
    recommenderLinksLabel: "Перевірити автора рекомендації",
    recommenderWebsiteLabel: "Сайт",
    recommenderInstagramLabel: "Instagram",
    agbBindingNote: "Обов'язковою є німецька версія AGB.",
    transparency: {
      heading: "Прозорість",
      labels: {
        code: "Код рекомендації (технічний)",
        recommendedBy: "Рекомендує",
        yourPrice: "Ваша ціна",
        ruleset: "Регламент",
      },
      yourPrice: "Ціна за прайсом незмінна; перевагу див. в умовах",
      rulesetLabel: (version) =>
        version ? `AGB, § 3 абз. 5 і § 12 (версія ${version})` : "AGB, § 3 абз. 5 і § 12",
      closing: "Рекомендація Вас ні до чого не зобов'язує.",
    },
    form: {
      heading: "Опишіть Вашу ситуацію",
      refPrefix: "Рекомендовано: ",
      messageLabel: "Повідомлення",
      messageHelp:
        "Що у Вас є сьогодні, чого бракує — і як нам з Вами зв'язатися (електронна пошта або телефон)?",
      submitLabel: `Перевірити, чи підходить ${siteName}`,
      sendingLabel: "Надсилаємо …",
      checklistTitle: "Для відправки не вистачає:",
      checklistReadyLabel: "Усе готово — надсилайте запит",
      checklistLengthLabel: "Мінімум 24 символи написано",
      checklistContactLabel: "Електронну пошту або телефон у тексті повідомлення",
      privacyNote:
        "Ми не використовуємо на цій сторінці cookie і нічого не зберігаємо на Вашому пристрої. Код рекомендації передається лише разом із Вашим запитом.",
      privacyLinkLabel: "Політика конфіденційності",
      successMessage: `Дякуємо. Ваш запит надійшов. ${responseSentence} За потреби перевірте папку «Спам».`,
      errorSummary: "Деякі поля не заповнені або містять помилки.",
      contactRequired:
        "Будь ласка, залиште в повідомленні адресу електронної пошти або номер телефону.",
      messageRequired: "Будь ласка, напишіть повідомлення.",
    },
    autoReply: {
      subject: `Ваш запит до ${siteName}`,
      body: ({ message, code }) =>
        [
          `Дякуємо за Ваш запит до ${siteName}.`,
          "",
          "Ваше повідомлення (копія):",
          message,
          "",
          ...(code ? [`Код рекомендації: ${code}`, ""] : []),
          `${responseSentence} За потреби перевірте папку «Спам».`,
        ].join("\n"),
    },
    neutral: {
      title: `Ваш запит до ${siteName}`,
      lead:
        response !== undefined
          ? `Коротко опишіть Вашу ситуацію — ми відповідаємо протягом ${response} годин у робочі дні.`
          : "Коротко опишіть Вашу ситуацію — ми відповідаємо в робочі дні.",
      privacyNote:
        "Ми не використовуємо на цій сторінці cookie і нічого не зберігаємо на Вашому пристрої.",
    },
    retired: {
      title: "Ця рекомендація більше не активна",
      status: `${siteName} Ви можете надалі перевіряти самостійно.`,
      home: "На головну",
    },
  };
}

/**
 * Returns the landing copy for `lang`, with `siteName` (the site's public
 * business name from the PBP profile) and the resolved `facts` (partners.yaml
 * `landing` phrases + PBP-derived service facts) interpolated wherever they
 * apply. The brand and economics are never hardcoded — this module serves
 * every workshop site.
 */
export function referralLandingCopy(
  lang: string,
  siteName: string,
  facts: ReferralLandingFacts = {},
): ReferralLandingCopy {
  return lang === "uk" ? ukCopy(siteName, facts) : deCopy(siteName, facts);
}

/** RFC-1273: public-name consent gate — every identity-bearing render site
    (h1, role, statement attribution, website/photo, the transparency
    recommendedBy row, the name-aware form label) reads this predicate. */
export function referralNameVisible(partner: ReferralPartner): boolean {
  return partner.status === "active" && !!partner.displayName;
}

/** The vorteil section renders only when at least one of its facts exists —
    an empty heading would disclose nothing. */
export function referralVorteilVisible(
  partner: ReferralPartner,
  copy: ReferralLandingCopy,
): boolean {
  return (
    copy.vorteilText !== null ||
    copy.capacityText !== null ||
    (partner.status === "active" && partner.validUntil !== undefined)
  );
}

/** RFC-1277: the recommender's voice block — data + recorded consent +
    confirmation date + active status, AND the operator's display switch.
    Every gated block reads through this chain so a `display` flag can only
    hide, never reveal. */
export function referralStatementVisible(partner: ReferralPartner): boolean {
  return (
    partner.status === "active" &&
    !!partner.statement &&
    !!partner.statementConsent &&
    !!partner.statementConfirmedAt &&
    partner.display?.statement !== false
  );
}

/** brief 3.2 — the basis block renders when the statement does AND at
    least one item exists (a basis fact or the answered isClient status). */
export function referralBasisVisible(partner: ReferralPartner): boolean {
  return (
    referralStatementVisible(partner) &&
    partner.display?.basis !== false &&
    ((partner.basis?.length ?? 0) > 0 || partner.isClient !== undefined)
  );
}

/** brief 3.3 — her own fit view (scope.fits/doesNotFit). */
export function referralFitsVisible(partner: ReferralPartner): boolean {
  return referralStatementVisible(partner) && partner.display?.fits !== false && !!partner.scope;
}

/** brief 3.4 — the fixed confirms/not-confirms block. */
export function referralConfirmsVisible(partner: ReferralPartner): boolean {
  return referralStatementVisible(partner) && partner.display?.confirms !== false;
}

/** brief 1.2 — the relation phrase under the hero role (voice data — her
    authored words publish only under the full statement bar: data + consent
    + confirmation + display.statement, plus its own display.heroAbout
    switch). */
export function referralHeroAboutVisible(partner: ReferralPartner): boolean {
  return (
    referralStatementVisible(partner) &&
    !!partner.relationToClientWorld &&
    partner.display?.heroAbout !== false
  );
}

/** brief 3.5 — the consented verification links (website/instagram) in the
    hero. Per-link consent is checked separately at the render site. */
export function referralLinksVisible(partner: ReferralPartner): boolean {
  return referralNameVisible(partner) && partner.display?.links !== false;
}

/** brief 3.5 — the consent-gated portrait. */
export function referralPhotoVisible(partner: ReferralPartner): boolean {
  return (
    referralNameVisible(partner) &&
    !!partner.photo &&
    !!partner.photoConsent &&
    partner.display?.photo !== false
  );
}
