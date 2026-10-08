/*
<MODULE_CONTRACT>
<purpose>
[referral-brief-v1] Platform-owned locale copy for the referral-partner
landing page (/r/<slug>), v3 — hero with calm labelled disclosure, leistung/
preis/zusagen/schritte sections, the transparency card before the form, the
referral form strings, the neutral mode-D variant, and the visitor auto-reply.
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
  <item>RFC-1198: created — DE (binding) + UK (reference) landing copy per external brief WP2.</item>
  <item>RFC-1222: trust-handoff copy — paid/unpaid disclosure badge (§ 5a UWG),
  proofs/price/no-promises blocks, recommendation receipt rows, retired status
  copy, REFERRAL_DISCLOSURE_VERSION, and the corrected privacy line.</item>
  <item>warpgogol-m000193: landing v3 rebuild — EMPFEHLUNG label hero with
  calm labelled disclosure (60-day trigger named), fixed leistung list,
  structured price cells, two-column commitments, four-step process, verbatim
  quote block, transparency card (code/art/preis/scope/exclusions/regelwerk),
  referral form strings (email/name/message/ref), neutral mode-D copy, and
  visitor auto-reply templates.</item>
  <item>REVIEW-CODE-2026-10-08-02: endpreise/SLA/leistung numbers (priceFixMonths,
  cancellationDays, downtimeHours, smallChangesPerMonth) interpolate PBP-derived
  facts instead of literals; absent support-response policy no longer fabricates
  a 24h promise — numberless sentence instead.</item>
  <item>warpgogol-m000193: copy refinement pass — UK visitor address capitalized
  (Ви/Ваш/Вам/Вас, Клієнт), zusagen rows lowercase, transparency heading shortened
  (Transparenz/Прозорість), closing trimmed to one sentence, disclosure.code slot
  exposes the slug for code-font rendering, privacy label «Політика
  конфіденційності.».</item>
</CHANGE_SUMMARY>
*/

import type { ReferralLandingConfig } from "./partners.ts";
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
  /** Site-authored "Gilt für" line — the scope of the recommendation
      (e.g. "Digitales Fundament: Website, Domain, Hosting, Betrieb"). */
  readonly scopeLine?: string;
  /** Site-authored "Nicht Bestandteil" line — the exclusion list. */
  readonly exclusionsLine?: string;
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
    scopeLine: pick(config.scopeLine),
    exclusionsLine: pick(config.exclusionsLine),
    ...(referralFee || steward ? { reward: { "referral-fee": referralFee, steward } } : {}),
    ...(anchorsRaw ? { anchors: anchorsRaw as ReferralAgbAnchors } : {}),
  };
}

/** One hero fact chip — `anchorKey` resolves against `facts.anchors`; absent
    anchor → the chip renders unlinked. */
export interface ReferralHeroFact {
  readonly label: string;
  readonly anchorKey: ReferralAgbAnchorKey;
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
  labels: {
    code: string;
    recommendedBy: string;
    kind: string;
    yourPrice: string;
    scope: string;
    excluded: string;
    ruleset: string;
  };
  /** "vergütet (70 €, nach 60 Tagen aktiver, bezahlter Subscription)" /
      "ohne Geldvergütung" — resolved per compensation + facts. */
  kind: (compensation: ReferralCompensation) => string;
  yourPrice: string;
  scope: string;
  excluded: string;
  /** "AGB, § 3 Abs. 5 und § 12 (Fassung 4.2)" — the version arrives from the
      AGB document metadata, never hardcoded. */
  rulesetLabel: (version: string | undefined) => string;
  partnerbedingungenLabel: string;
  closing: string;
}

export interface ReferralFormCopy {
  heading: string;
  refLabel: string;
  refHelp: string;
  emailLabel: string;
  nameLabel: string;
  optionalHint: string;
  messageLabel: string;
  messageHelp: string;
  submitLabel: string;
  sendingLabel: string;
  privacyNote: string;
  privacyLinkLabel: string;
  successMessage: string;
  errorSummary: string;
  /** Per-field errors on the native re-rendered error document. */
  emailRequired: string;
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
  /** The disclosure line — label + text resolved per compensation and identity. */
  disclosure: (
    compensation: ReferralCompensation,
    displayName: string | null,
    slug: string,
  ) => ReferralDisclosureLine;
  heroFacts: readonly ReferralHeroFact[];
  ctaPrimary: string;
  ctaPreis: string;
  leistungHeading: string;
  leistung: readonly string[];
  preisHeading: string;
  /** Three resolved price cells; a missing PBP charge renders "—"… no wait —
      a missing charge omits the cell entirely. */
  priceCells: readonly { amount: string; unit: string }[];
  endpreiseLine: string;
  vorteilHeading: string;
  vorteilText: string | null;
  riskLine: string;
  zusagenHeading: string;
  zusagenLeftTitle: string;
  zusagenRightTitle: string;
  zusagenLeft: readonly ReferralCommitmentRow[];
  zusagenRight: readonly { text: string; anchorKey?: ReferralAgbAnchorKey }[];
  zusagenFootnote: string;
  stepsHeading: string;
  steps: readonly { text: string; anchorKey?: ReferralAgbAnchorKey }[];
  writtenLine: string;
  b2bLine: string;
  b2bAnchorKey: ReferralAgbAnchorKey;
  quoteAriaLabel: string;
  transparency: ReferralTransparencyCopy;
  form: ReferralFormCopy;
  autoReply: ReferralAutoReplyCopy;
  programLink: string;
  standardLink: string;
  /** aria-label of the secondary-links nav under the form. */
  secondaryNavLabel: string;
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

function priceCellsDe(facts: ReferralLandingFacts): { amount: string; unit: string }[] {
  const s = facts.service;
  const cells: { amount: string; unit: string }[] = [];
  if (s?.activationPrice !== undefined) {
    cells.push({
      amount: referralMoney(s.activationPrice, s.priceCurrency, "de"),
      unit: "einmalig (Aktivierung)",
    });
  }
  if (s?.monthlyPrice !== undefined) {
    cells.push({
      amount: referralMoney(s.monthlyPrice, s.priceCurrency, "de"),
      unit: "pro Monat",
    });
  }
  if (s?.yearlyPrice !== undefined) {
    cells.push({
      amount: referralMoney(s.yearlyPrice, s.priceCurrency, "de"),
      unit: "pro Jahr — Alternative zum Monatspreis",
    });
  }
  return cells;
}

function priceCellsUk(facts: ReferralLandingFacts): { amount: string; unit: string }[] {
  const s = facts.service;
  const cells: { amount: string; unit: string }[] = [];
  if (s?.activationPrice !== undefined) {
    cells.push({
      amount: referralMoney(s.activationPrice, s.priceCurrency, "uk"),
      unit: "одноразово (активація)",
    });
  }
  if (s?.monthlyPrice !== undefined) {
    cells.push({
      amount: referralMoney(s.monthlyPrice, s.priceCurrency, "uk"),
      unit: "на місяць",
    });
  }
  if (s?.yearlyPrice !== undefined) {
    cells.push({
      amount: referralMoney(s.yearlyPrice, s.priceCurrency, "uk"),
      unit: "на рік — альтернатива місячній оплаті",
    });
  }
  return cells;
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
  const sla = s?.availabilityPercent;
  const downtime = s?.downtimeHours;
  const priceFix = s?.priceFixMonths;
  const cancel = s?.cancellationDays;
  const perMonth = s?.smallChangesPerMonth;
  const small = s?.smallChangeHours;
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
  const activationMoney =
    s?.activationPrice !== undefined
      ? referralMoney(s.activationPrice, s.priceCurrency, "de")
      : undefined;

  return {
    headerCta: "Situation beschreiben",
    heroLabel: "EMPFEHLUNG",
    h1Named: (name) => `${name} empfiehlt Ihnen ${siteName}.`,
    h1Anonymous: `Man hat Ihnen ${siteName} empfohlen.`,
    lead: `${siteName} baut Websites für kleine Unternehmen, Handwerksbetriebe und Selbständige: auf Ihrer eigenen Domain, mit schriftlichen Bedingungen und einem festen Ausstieg.`,
    disclosure: (compensation, displayName, slug) =>
      disclosureDe(facts, compensation, displayName, slug, siteName),
    heroFacts: [
      { label: "Anfrage unverbindlich", anchorKey: "inquiryNonBinding" },
      {
        label:
          response !== undefined
            ? `Antwort in ${response} Stunden (Werktage)`
            : "Antwort an Werktagen",
        anchorKey: "responseHours",
      },
      {
        label:
          launchDays !== undefined
            ? `Launch in ${launchDays} Werktagen ab Projektstart`
            : "Launch ab Projektstart",
        anchorKey: "launchWorkdays",
      },
    ],
    ctaPrimary: "Situation beschreiben",
    ctaPreis: "Preis und Zusagen ansehen",
    leistungHeading: "Was Sie bekommen",
    leistung: [
      "Website, entwickelt und online gestellt",
      "Domain auf Ihren Namen — Sie sind von Beginn an Inhaber",
      sla !== undefined
        ? `Hosting mit ${sla} % Verfügbarkeit pro Monat`
        : "Hosting mit Verfügbarkeitszusage",
      "Technische Umsetzung von Impressum und Datenschutz (keine Rechtsberatung)",
      "Auffindbarkeit für KI-Systeme (strukturierte Daten)",
      perMonth !== undefined
        ? `${perMonth} kleine ${perMonth === 1 ? "Änderung" : "Änderungen"} pro Monat inklusive`
        : "Kleine Änderung pro Monat inklusive",
      "Quartalsauswertung zu Besuchern und Traffic-Quellen",
      handover !== undefined
        ? `Vollständige Übergabe innerhalb von ${handover} Stunden, wenn Sie gehen`
        : "Vollständige Übergabe, wenn Sie gehen",
    ],
    preisHeading: "Preis — offen",
    priceCells: priceCellsDe(facts),
    endpreiseLine: [
      "Endpreise, keine Umsatzsteuer (Kleinunternehmer, § 19 UStG).",
      priceFix !== undefined ? `Preis ${priceFix} Monate festgeschrieben.` : "",
      cancel !== undefined ? `Kündigung: ${cancel} Tage zum Monatsende.` : "",
    ]
      .filter((p) => p.length > 0)
      .join(" "),
    vorteilHeading: "Ihr Empfehlungsvorteil",
    vorteilText: vorteilDe(facts, siteName),
    riskLine:
      activationMoney !== undefined
        ? `Die Aktivierungsgebühr von ${activationMoney} zahlen Sie erst nach der Erstprüfung, zusammen mit der Auftragsbestätigung. Lehnen wir Ihr Projekt ab, entfällt sie.`
        : "Die Aktivierungsgebühr zahlen Sie erst nach der Erstprüfung, zusammen mit der Auftragsbestätigung. Lehnen wir Ihr Projekt ab, entfällt sie.",
    zusagenHeading: "Was verbindlich zugesagt ist",
    // Lowercase accusative objects under the verb frame — the right column is
    // lowercase too, and none of these items carries a full stop.
    zusagenLeftTitle: `${siteName} sagt verbindlich zu`,
    zusagenRightTitle: `${siteName} verspricht nicht`,
    zusagenLeft: [
      {
        text:
          launchDays !== undefined
            ? `den Launch in ${launchDays} Werktagen ab Projektstart${launchDelayClause}`
            : `den Launch ab Projektstart${launchDelayClause}`,
        anchorKey: "launchWorkdays",
      },
      {
        text:
          sla !== undefined
            ? `die Einhaltung von ${sla} % Verfügbarkeit pro Monat${downtime !== undefined ? `; bei über ${downtime} Stunden Ausfall` : "; bei längerem Ausfall"} ist der nächste Monat kostenlos`
            : "die Einhaltung der Verfügbarkeit — bei längerem Ausfall ist der nächste Monat kostenlos",
        anchorKey: "availabilitySla",
      },
      {
        text:
          small !== undefined
            ? `kleine Änderungen in ${small} Stunden`
            : "kleine Änderungen in kurzer Frist",
        anchorKey: "smallChangeHours",
      },
      {
        text:
          response !== undefined
            ? `eine Antwort in ${response} Stunden an Werktagen`
            : "eine Antwort an Werktagen",
        anchorKey: "responseHours",
      },
      {
        text:
          handover !== undefined
            ? `die vollständige Übergabe in ${handover} Stunden nach Vertragsende`
            : "die vollständige Übergabe nach Vertragsende",
        anchorKey: "handoverHours",
      },
    ],
    zusagenRight: [
      { text: "eine bestimmte Position bei Google" },
      { text: "eine bestimmte Zahl von Anfragen oder Aufträgen" },
      { text: "Umsatz oder wirtschaftlichen Erfolg" },
      { text: "Ergebnisse ohne Ihre Mitwirkung" },
      {
        text: "Rechtsberatung, SEO-Kampagnen, bezahlte Werbung",
        anchorKey: "excludedServices",
      },
    ],
    zusagenFootnote: "Fristen gelten unter den Voraussetzungen der AGB.",
    stepsHeading: "So geht es weiter",
    steps: [
      { text: "Sie beschreiben Ihre Situation schriftlich." },
      {
        text:
          response !== undefined
            ? `Wir antworten innerhalb von ${response} Stunden an Werktagen.`
            : "Wir antworten an Werktagen.",
      },
      {
        text: "Erstprüfung: Sie erhalten das Ergebnis in Textform; wir lehnen z. B. rechtswidrige oder nicht belegbare Tätigkeiten ab.",
        anchorKey: "unsupportedProjects",
      },
      {
        text: "Bei positivem Ergebnis: Auftragsbestätigung mit Umfang, Preis und Start; erst dann ist die Aktivierungsgebühr fällig.",
      },
    ],
    writtenLine: "Wir arbeiten schriftlich.",
    b2bLine:
      "Dieses Angebot gilt für Unternehmer, Selbständige und Freiberufler (§ 14 BGB), nicht für Verbraucher.",
    b2bAnchorKey: "b2b",
    quoteAriaLabel: "Wörtliche Empfehlung",
    transparency: {
      heading: "Transparenz",
      labels: {
        code: "Empfehlungscode",
        recommendedBy: "Empfohlen von",
        kind: "Art",
        yourPrice: "Ihr Preis",
        scope: "Gilt für",
        excluded: "Nicht Bestandteil der Empfehlung",
        ruleset: "Regelwerk",
      },
      kind: (compensation) => {
        if (compensation === "none") return "ohne Geldvergütung";
        const reward = rewardPhrase(facts, compensation);
        const days = s?.qualifyingDays;
        if (compensation === "steward") {
          return reward ? `vergütet (Tätigkeit, ${reward})` : "vergütet (Tätigkeit)";
        }
        return reward && days !== undefined
          ? `vergütet (${reward}, nach ${days} Tagen aktiver, bezahlter Subscription)`
          : reward
            ? `vergütet (${reward})`
            : "vergütet";
      },
      yourPrice: "Listenpreis unverändert; Vorteil siehe Preisblock",
      scope: facts.scopeLine ?? "",
      excluded: facts.exclusionsLine ?? "",
      rulesetLabel: (version) =>
        version ? `AGB, § 3 Abs. 5 und § 12 (Fassung ${version})` : "AGB, § 3 Abs. 5 und § 12",
      partnerbedingungenLabel: "Partnerbedingungen",
      closing: "Die Empfehlung verpflichtet Sie zu nichts.",
    },
    form: {
      heading: "Situation beschreiben",
      refLabel: "Empfehlungscode",
      refHelp: "Vorausgefüllt. Sie können ihn löschen.",
      emailLabel: "E-Mail",
      nameLabel: "Name oder Betrieb",
      optionalHint: "optional",
      messageLabel: "Nachricht",
      messageHelp: "Was haben Sie heute, was fehlt, wie erreichen wir Sie am besten?",
      submitLabel: `Prüfen lassen, ob ${siteName} passt`,
      sendingLabel: "Wird gesendet …",
      privacyNote:
        "Wir nutzen auf dieser Seite keine Cookies und speichern nichts auf Ihrem Gerät. Der Empfehlungscode wird nur mit Ihrer Anfrage übermittelt.",
      privacyLinkLabel: "Datenschutzerklärung",
      successMessage: `Danke. Ihre Anfrage ist angekommen. ${responseSentence} Schauen Sie bei Bedarf im Spam-Ordner nach.`,
      errorSummary: "Einige Angaben fehlen oder sind ungültig.",
      emailRequired: "Bitte geben Sie eine gültige E-Mail-Adresse an.",
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
    programLink: "Wie das Empfehlungsprogramm funktioniert",
    standardLink: `Den ${siteName}-Standard ansehen`,
    secondaryNavLabel: "Weiterführende Links",
    neutral: {
      title: `Ihre Anfrage an ${siteName}`,
      lead:
        response !== undefined
          ? `Beschreiben Sie kurz Ihre Situation — wir antworten innerhalb von ${response} Stunden an Werktagen.`
          : "Beschreiben Sie kurz Ihre Situation — wir antworten an Werktagen.",
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
  const sla = s?.availabilityPercent;
  const downtime = s?.downtimeHours;
  const priceFix = s?.priceFixMonths;
  const cancel = s?.cancellationDays;
  const perMonth = s?.smallChangesPerMonth;
  const small = s?.smallChangeHours;
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
  const activationMoney =
    s?.activationPrice !== undefined
      ? referralMoney(s.activationPrice, s.priceCurrency, "uk")
      : undefined;

  return {
    headerCta: "Описати ситуацію",
    heroLabel: "РЕКОМЕНДАЦІЯ",
    h1Named: (name) => `${name} рекомендує Вам ${siteName}.`,
    h1Anonymous: `Вам рекомендували ${siteName}.`,
    lead: `${siteName} робить вебсайти для малого бізнесу, ремесла та самозайнятих: на Вашому власному домені, з письмовими умовами та передбаченим виходом.`,
    disclosure: (compensation, displayName, slug) =>
      disclosureUk(facts, compensation, displayName, slug, siteName),
    heroFacts: [
      { label: "Запит необов'язковий", anchorKey: "inquiryNonBinding" },
      {
        label:
          response !== undefined
            ? `Відповідь за ${response} години (робочі дні)`
            : "Відповідь у робочі дні",
        anchorKey: "responseHours",
      },
      {
        label:
          launchDays !== undefined
            ? `Запуск за ${launchDays} робочих днів від старту проєкту`
            : "Запуск від старту проєкту",
        anchorKey: "launchWorkdays",
      },
    ],
    ctaPrimary: "Описати ситуацію",
    ctaPreis: "Ціна й зобов'язання",
    leistungHeading: "Що Ви отримуєте",
    leistung: [
      "Вебсайт — розроблений і запущений онлайн",
      "Домен на Ваше ім'я — Ви власник із першого дня",
      sla !== undefined
        ? `Хостинг із доступністю ${sla} % на місяць`
        : "Хостинг із гарантією доступності",
      "Технічна реалізація Impressum і Datenschutz (без юридичної консультації)",
      "Доступність для ШІ-систем (структуровані дані)",
      perMonth !== undefined
        ? `${perMonth} ${perMonth === 1 ? "незначна зміна" : "незначні зміни"} на місяць включно`
        : "Незначна зміна на місяць включно",
      "Квартальний звіт про відвідувачів і джерела трафіку",
      handover !== undefined
        ? `Повна передача протягом ${handover} годин, якщо Ви йдете`
        : "Повна передача, якщо Ви йдете",
    ],
    preisHeading: "Ціна — відкрито",
    priceCells: priceCellsUk(facts),
    endpreiseLine: [
      "Кінцеві ціни, без ПДВ (малий підприємець, § 19 UStG).",
      priceFix !== undefined ? `Ціна зафіксована на ${priceFix} місяців.` : "",
      cancel !== undefined ? `Розірвання: за ${cancel} днів до кінця місяця.` : "",
    ]
      .filter((p) => p.length > 0)
      .join(" "),
    vorteilHeading: "Ваша перевага за рекомендацією",
    vorteilText: vorteilUk(facts, siteName),
    riskLine:
      activationMoney !== undefined
        ? `Внесок ${activationMoney} Ви сплачуєте лише після первинної перевірки разом із підтвердженням замовлення. Якщо ми відмовимо Вашому проєкту, внесок не стягуватиметься.`
        : "Внесок за активацію Ви сплачуєте лише після первинної перевірки разом із підтвердженням замовлення. Якщо ми відмовимо Вашому проєкту, внесок не стягуватиметься.",
    zusagenHeading: "Зобов'язання",
    // Infinitive items under the verb frame — same lowercase style as the
    // right column; none of the items ends in a full stop.
    zusagenLeftTitle: `${siteName} зобов'язується`,
    zusagenRightTitle: `${siteName} не обіцяє`,
    zusagenLeft: [
      {
        text:
          launchDays !== undefined
            ? `запустити за ${launchDays} робочих днів від старту проєкту${launchDelayClause}`
            : `запустити від старту проєкту${launchDelayClause}`,
        anchorKey: "launchWorkdays",
      },
      {
        text:
          sla !== undefined
            ? `забезпечити доступність ${sla} % на місяць; ${downtime !== undefined ? `за простою понад ${downtime} годин` : "за тривалого простою"} наступний місяць безкоштовний`
            : "забезпечити доступність із компенсацією простою",
        anchorKey: "availabilitySla",
      },
      {
        text:
          small !== undefined
            ? `вносити незначні зміни за ${small} годин`
            : "вносити незначні зміни в короткий строк",
        anchorKey: "smallChangeHours",
      },
      {
        text:
          response !== undefined
            ? `відповідати за ${response} годин у робочі дні`
            : "відповідати в робочі дні",
        anchorKey: "responseHours",
      },
      {
        text:
          handover !== undefined
            ? `передати все за ${handover} годин після завершення договору`
            : "передати все після завершення договору",
        anchorKey: "handoverHours",
      },
    ],
    zusagenRight: [
      { text: "певну позицію в Google" },
      { text: "певну кількість звернень чи замовлень" },
      { text: "продажі чи економічний успіх" },
      { text: "результат без Вашої участі" },
      {
        text: "юридичні консультації, SEO-кампанії, платна реклама",
        anchorKey: "excludedServices",
      },
    ],
    zusagenFootnote: "Строки діють за умов AGB.",
    stepsHeading: "Що буде далі",
    steps: [
      { text: "Ви описуєте свою ситуацію письмово." },
      {
        text:
          response !== undefined
            ? `Ми відповідаємо протягом ${response} годин у робочі дні.`
            : "Ми відповідаємо в робочі дні.",
      },
      {
        text: "Первинна перевірка: Ви отримуєте результат у текстовій формі; ми відмовляємо, наприклад, неправомірній або недоказовій діяльності.",
        anchorKey: "unsupportedProjects",
      },
      {
        text: "За позитивного результату: підтвердження замовлення з обсягом, ціною та стартом; лише тоді Ви оплачуєте внесок за активацію.",
      },
    ],
    writtenLine: "Ми працюємо письмово.",
    b2bLine:
      "Ця пропозиція діє для підприємців, самозайнятих і вільних професій (§ 14 BGB), не для споживачів.",
    b2bAnchorKey: "b2b",
    quoteAriaLabel: "Дослівна рекомендація",
    transparency: {
      heading: "Прозорість",
      labels: {
        code: "Код рекомендації",
        recommendedBy: "Рекомендує",
        kind: "Тип",
        yourPrice: "Ваша ціна",
        scope: "Діє для",
        excluded: "Не входить у рекомендацію",
        ruleset: "Регламент",
      },
      kind: (compensation) => {
        if (compensation === "none") return "без грошової винагороди";
        const reward = rewardPhrase(facts, compensation);
        const days = s?.qualifyingDays;
        if (compensation === "steward") {
          return reward ? `з винагородою (діяльність, ${reward})` : "з винагородою (діяльність)";
        }
        return reward && days !== undefined
          ? `з винагородою (${reward}, після ${days} днів активної оплаченої підписки)`
          : reward
            ? `з винагородою (${reward})`
            : "з винагородою";
      },
      yourPrice: "Ціна за прайсом незмінна; перевагу див. у блоці ціни",
      scope: facts.scopeLine ?? "",
      excluded: facts.exclusionsLine ?? "",
      rulesetLabel: (version) =>
        version ? `AGB, § 3 абз. 5 і § 12 (версія ${version})` : "AGB, § 3 абз. 5 і § 12",
      partnerbedingungenLabel: "Партнерські умови",
      closing: "Рекомендація Вас ні до чого не зобов'язує.",
    },
    form: {
      heading: "Опишіть Вашу ситуацію",
      refLabel: "Код рекомендації",
      refHelp: "Заповнено автоматично. Ви можете його вилучити.",
      emailLabel: "Електронна пошта",
      nameLabel: "Ім'я або бізнес",
      optionalHint: "необов'язково",
      messageLabel: "Повідомлення",
      messageHelp: "Що у Вас є сьогодні, чого бракує, як нам найкраще з Вами зв'язатися?",
      submitLabel: `Перевірити, чи підходить ${siteName}`,
      sendingLabel: "Надсилаємо …",
      privacyNote:
        "Ми не використовуємо на цій сторінці cookie і нічого не зберігаємо на Вашому пристрої. Код рекомендації передається лише разом із Вашим запитом.",
      privacyLinkLabel: "Політика конфіденційності",
      successMessage: `Дякуємо. Ваш запит надійшов. ${responseSentence} За потреби перевірте папку «Спам».`,
      errorSummary: "Деякі поля не заповнені або містять помилки.",
      emailRequired: "Будь ласка, вкажіть дійсну адресу електронної пошти.",
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
    programLink: "Як працює програма рекомендацій",
    standardLink: `Переглянути стандарт ${siteName}`,
    secondaryNavLabel: "Додаткові посилання",
    neutral: {
      title: `Ваш запит до ${siteName}`,
      lead:
        response !== undefined
          ? `Коротко опишіть Вашу ситуацію — ми відповідаємо протягом ${response} годин у робочі дні.`
          : "Коротко опишіть Вашу ситуацію — ми відповідаємо в робочі дні.",
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
