/*
<MODULE_CONTRACT>
<purpose>
[RFC-1198] Platform-owned locale copy for the referral-partner landing page
(/r/<slug>). The disclosure sentences are legal text — the platform owns the
sentence structure so the same disclosure shape ships on every site; the
site-varying phrases (reward amount, steward role term, audience clause,
legal pointer) arrive via ReferralLandingFacts resolved from partners.yaml
`landing` and the site's PBP partner-program policy. DE is the legally
binding version; UK is a synced reference translation.
</purpose>
<non-goals>
  <item>Do not interpolate anything beyond the declared facts — the copy is fixed contract text.</item>
  <item>Do not add storage/cookie strings — the page must be able to claim zero storage truthfully.</item>
  <item>Do not hardcode site names, prices, verticals, or document section numbers — they are site-authored facts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198: created — DE (binding) + UK (reference) landing copy per external brief WP2.</item>
  <item>RFC-1198: cookie-free referral attribution — /r/<slug> partner landings + voluntary referrer field

Replace the RFC-1191 wg_ref cookie capture with URL+form attribution:
static /r/<slug> and /<lang>/r/<slug> partner landings (noindex, zero JS,
consent-gated via publicNameConsentRef), ?ref prefill on the existing
referrerField rail, server-side slug resolution against the bundled
partners.yaml, referral_partner_slug/name on the Lagebild ingress contract,
legacy /?ref -> /r/<slug> 302 in the generated worker, and full removal of
the cookie capture module (wg_ref, referral.attribution entitlement,
payload.attribution).</item>
  <item>RFC-1198 fo-fix2: full de-siteification — reward/steward/audience/
conditionsNote phrases arrive via ReferralLandingFacts (partners.yaml `landing`),
the referred-customer benefit sentence derives from the site's PBP
partner-program policy, and the privacy line no longer cites a hardcoded
Datenschutz section number.</item>
  <item>RFC-1222: trust-handoff copy — paid/unpaid disclosure badge (§ 5a UWG),
proofs/price/no-promises blocks, recommendation receipt rows, retired status
copy, REFERRAL_DISCLOSURE_VERSION, and the corrected privacy line (the code
lives in the form field, not the contact-page address).</item>
  <item>RFC-1222 pending-landing amendment (operator, 2026-10-07): `anonymous`
copy group — pending partners emit the full landing minus identity strings
(name-free h1/lead/disclosure) while public-name consent is unrecorded.</item>
</CHANGE_SUMMARY>
*/

import type { ReferralLandingConfig } from "./partners.ts";

export type ReferralCompensation = "referral-fee" | "none" | "steward";

/** RFC-1222: disclosure-structure version stamped onto the submit payload.
    Manual constant — bump only when the disclosure sentence structure changes,
    never auto-incremented. */
export const REFERRAL_DISCLOSURE_VERSION = "v1";

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
  /** Reward display phrase per compensation variant. */
  readonly reward?: { readonly "referral-fee"?: string; readonly steward?: string };
  /** Steward role term (e.g. "Markt-Steward"). Fallback: "Partner". */
  readonly stewardRole?: string;
  /** Audience/product clause for the lead. Fallback: generic "Websites". */
  readonly audience?: string;
  /** Legal pointer appended to the benefit sentence (e.g. "(AGB § 3 Abs. 5)"). */
  readonly conditionsNote?: string;
  /** Referred-customer benefit from the PBP partner-program policy. Absent →
      the conditions line is omitted entirely (no invented benefit). */
  readonly benefit?: ReferralBenefitFacts;
  /** Site-authored proof points (RFC-1222 §landing item 3). Absent → the
      proofs block is omitted. */
  readonly proofs?: readonly string[];
  /** Site-authored open-price line — `{price:offering:charge}` markers are
      resolved upstream before reaching the copy (PBP is the only money
      source). Absent → the price block is omitted. */
  readonly priceLine?: string;
  /** Partner-program policy `governance.effectiveFrom` (ISO date) — the
      ruleset anchor rendered in the receipt's "Regelwerk" row. */
  readonly policyEffectiveFrom?: string;
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
  const pickList = (map: Record<string, string[]> | undefined): string[] | undefined =>
    map?.[lang] ?? map?.[fallbackLang] ?? Object.values(map ?? {})[0];
  return {
    stewardRole: pick(config.stewardRole),
    audience: pick(config.audiencePhrase),
    conditionsNote: pick(config.conditionsNote),
    priceLine: pick(config.priceLine),
    proofs: pickList(config.proofs),
    ...(referralFee || steward ? { reward: { "referral-fee": referralFee, steward } } : {}),
  };
}

/** RFC-1222: receipt block rows — labels are fixed contract text; values are
    resolved from the partner record + PBP facts by the component. */
export interface ReferralReceiptCopy {
  heading: string;
  labels: {
    recommendation: string;
    recommendedBy: string;
    compensationStatus: string;
    ruleset: string;
    captured: string;
  };
  /** "Vergütet · 70 €" / "Unvergütet" — the reward phrase resolves from the
      site-authored landing facts inside the copy closure, never invented. */
  compensationStatus: (compensation: ReferralCompensation) => string;
  /** "Partner Policy, Stand 01.01.2026" — takes the localized effectiveFrom. */
  ruleset: (effectiveFrom: string) => string;
  /** "Die Empfehlung verpflichtet Sie zu nichts." + the removable-code line. */
  closing: readonly [string, string];
}

/** RFC-1222: retired-partner status page copy — never carries the name. */
export interface ReferralRetiredCopy {
  title: string;
  status: string;
  home: string;
}

/** RFC-1222 pending-landing amendment: name-free variants for a partner whose
    public-name consent is not yet recorded. The landing emits the same
    document minus every string that would carry identity. */
export interface ReferralAnonymousCopy {
  /** Hero heading without the partner name ("Ihnen wurde X empfohlen"). */
  h1: string;
  /** Lead paragraph without the partner name. */
  lead: string;
  /** Compensation-variant disclosure with "the person who recommended" —
      § 5a UWG still discloses the commercial interest, the name stays out. */
  disclosure: (compensation: ReferralCompensation) => string;
}

export interface ReferralLandingCopy {
  eyebrow: string;
  /** Interpolates {displayName, siteName}. */
  h1: (displayName: string) => string;
  /** Interpolates {displayName, siteName, audience}. */
  lead: (displayName: string) => string;
  /** Disclosure badge token — VERGÜTETE/UNVERGÜTETE EMPFEHLUNG (§ 5a UWG). */
  disclosureBadge: (kind: ReferralDisclosureKind) => string;
  /** Compensation-variant disclosure — interpolates {displayName, siteName, reward, stewardRole}. */
  disclosure: (compensation: ReferralCompensation, displayName: string) => string;
  /** Proof block — null when the site authors no `landing.proofs`. */
  proofsHeading: string;
  proofs: readonly string[] | null;
  /** Open-price block — null when the site authors no `landing.priceLine`. */
  priceHeading: string;
  priceLine: string | null;
  priceLinkLabel: string;
  noPromisesHeading: string;
  noPromises: readonly string[];
  /** Referred-customer benefit line — null when the site declares no
      partner-program policy benefit (the component then hides the block). */
  conditions: string | null;
  ctaPrimary: string;
  ctaSecondary: string;
  programLink: string;
  formHeading: string;
  receipt: ReferralReceiptCopy;
  retired: ReferralRetiredCopy;
  anonymous: ReferralAnonymousCopy;
  privacy: string;
}

/** Condition clause for the known `terms.referralFreePeriodCondition` tokens. */
function freePeriodConditionClause(token: string | undefined, lang: "de" | "uk"): string {
  if (token === "active-in-second-month") {
    return lang === "uk"
      ? ", якщо підписка залишається активною на 2-й місяць"
      : ", sofern das Abonnement im 2. Monat aktiv bleibt";
  }
  return "";
}

function deConditions(benefit: ReferralBenefitFacts, note?: string): string | null {
  const predicates: string[] = [];
  if (benefit.priorityStart) {
    predicates.push("starten mit Priorität in der nächsten Welle");
  }
  if (benefit.freePeriod) {
    predicates.push(
      `erhalten ${benefit.freePeriod} Subscription kostenlos${freePeriodConditionClause(
        benefit.freePeriodCondition,
        "de",
      )}`,
    );
  }
  if (!predicates.length) return null;
  return `Empfohlene Betriebe ${predicates.join(" und ")}${note ? ` ${note}` : ""}.`;
}

function ukConditions(benefit: ReferralBenefitFacts, note?: string): string | null {
  const predicates: string[] = [];
  if (benefit.priorityStart) {
    predicates.push("стартують із пріоритетом у наступній хвилі");
  }
  if (benefit.freePeriod) {
    predicates.push(
      `отримують ${benefit.freePeriod} підписки безкоштовно${freePeriodConditionClause(
        benefit.freePeriodCondition,
        "uk",
      )}`,
    );
  }
  if (!predicates.length) return null;
  return `Рекомендовані підприємства ${predicates.join(" й ")}${note ? ` ${note}` : ""}.`;
}

function deCopy(siteName: string, facts: ReferralLandingFacts): ReferralLandingCopy {
  const audience = facts.audience ?? "Websites";
  return {
    eyebrow: "Empfohlen von",
    h1: (displayName) => `${displayName} empfiehlt ${siteName}`,
    lead: (displayName) =>
      `${displayName} hat Ihnen diese Seite geschickt, weil ${siteName} zu Ihrem Betrieb passen könnte. Wir bauen ${audience} — auf eigener Domain, mit schriftlichen Bedingungen und vorgesehenem Ausstieg.`,
    disclosureBadge: (kind) =>
      kind === "paid" ? "VERGÜTETE EMPFEHLUNG" : "UNVERGÜTETE EMPFEHLUNG",
    disclosure: (compensation, displayName) => {
      switch (compensation) {
        case "referral-fee":
          return `Offenlegung: Wenn Sie ein ${siteName}-Abonnement beginnen, erhält ${displayName} dafür ${facts.reward?.["referral-fee"] ?? "eine Vergütung"} von ${siteName}. Ihr Preis ändert sich dadurch nicht. Eine Empfehlung verpflichtet Sie zu nichts.`;
        case "none":
          return `Offenlegung: Zwischen ${displayName} und ${siteName} besteht eine Empfehlungspartnerschaft ohne monetäre Vergütung. Eine Empfehlung verpflichtet Sie zu nichts.`;
        case "steward":
          return `Offenlegung: ${displayName} ist als ${facts.stewardRole ?? "Partner"} für ${siteName} tätig und erhält dafür eine Vergütung${facts.reward?.steward ? `, unter anderem ${facts.reward.steward}` : ""}. Ihr Preis ändert sich dadurch nicht. Eine Empfehlung verpflichtet Sie zu nichts.`;
      }
    },
    proofsHeading: "Was Sie konkret bekommen",
    proofs: facts.proofs ?? null,
    priceHeading: "Der Preis — offen",
    priceLine: facts.priceLine ?? null,
    priceLinkLabel: "Leistungsumfang prüfen →",
    noPromisesHeading: "Was Ihnen hier niemand verspricht",
    noPromises: [
      "Keine garantierten Platzierungen.",
      "Keine garantierten Anfragen oder Umsätze.",
      "Kein Ergebnis ohne Ihre Mitwirkung.",
    ],
    conditions: facts.benefit ? deConditions(facts.benefit, facts.conditionsNote) : null,
    ctaPrimary: "Situation beschreiben",
    ctaSecondary: `Den ${siteName} Standard ansehen`,
    programLink: "So funktioniert das Empfehlungsprogramm",
    formHeading: "Beschreiben Sie Ihre Situation",
    receipt: {
      heading: "Ihre Empfehlungsquittung",
      labels: {
        recommendation: "Empfehlung",
        recommendedBy: "Empfohlen von",
        compensationStatus: "Vergütungsstatus",
        ruleset: "Regelwerk",
        captured: "Erfasst",
      },
      compensationStatus: (compensation) =>
        compensation === "none"
          ? "Unvergütet"
          : `Vergütet${
              facts.reward?.[compensation === "steward" ? "steward" : "referral-fee"]
                ? ` · ${facts.reward[compensation === "steward" ? "steward" : "referral-fee"]}`
                : ""
            }`,
      ruleset: (effectiveFrom) => `Partner Policy, Stand ${effectiveFrom}`,
      closing: [
        "Die Empfehlung verpflichtet Sie zu nichts.",
        "Den Empfehlungscode können Sie vor dem Absenden entfernen.",
      ],
    },
    retired: {
      title: "Diese Empfehlung ist nicht mehr aktiv",
      status: `${siteName} können Sie weiterhin unabhängig prüfen.`,
      home: "Zur Startseite",
    },
    anonymous: {
      h1: `Ihnen wurde ${siteName} empfohlen`,
      lead: `Diese Seite wurde Ihnen weitergegeben, weil ${siteName} zu Ihrem Betrieb passen könnte. Wir bauen ${audience} — auf eigener Domain, mit schriftlichen Bedingungen und vorgesehenem Ausstieg.`,
      disclosure: (compensation) => {
        switch (compensation) {
          case "referral-fee":
            return `Offenlegung: Wenn Sie ein ${siteName}-Abonnement beginnen, erhält die Person, die Ihnen diese Seite empfohlen hat, dafür ${facts.reward?.["referral-fee"] ?? "eine Vergütung"} von ${siteName}. Ihr Preis ändert sich dadurch nicht. Eine Empfehlung verpflichtet Sie zu nichts.`;
          case "none":
            return `Offenlegung: Zwischen der Person, die Ihnen diese Seite empfohlen hat, und ${siteName} besteht eine Empfehlungspartnerschaft ohne monetäre Vergütung. Eine Empfehlung verpflichtet Sie zu nichts.`;
          case "steward":
            return `Offenlegung: Die Person, die Ihnen diese Seite empfohlen hat, ist als ${facts.stewardRole ?? "Partner"} für ${siteName} tätig und erhält dafür eine Vergütung${facts.reward?.steward ? `, unter anderem ${facts.reward.steward}` : ""}. Ihr Preis ändert sich dadurch nicht. Eine Empfehlung verpflichtet Sie zu nichts.`;
        }
      },
    },
    privacy:
      "Auf dieser Seite setzen wir keine Cookies und speichern nichts in Ihrem Browser. Der Empfehlungscode steht nur im Formularfeld und wird mit Ihrer Anfrage übermittelt, solange Sie ihn nicht entfernen. Mehr in der Datenschutzerklärung.",
  };
}

function ukCopy(siteName: string, facts: ReferralLandingFacts): ReferralLandingCopy {
  const audience = facts.audience ?? "вебсайти";
  return {
    eyebrow: "Рекомендує",
    h1: (displayName) => `${displayName} рекомендує ${siteName}`,
    lead: (displayName) =>
      `${displayName} надіслав(ла) вам цю сторінку, бо ${siteName} може підійти вашому бізнесу. Ми робимо ${audience}: на власному домені, з письмовими умовами та передбаченим виходом.`,
    disclosureBadge: (kind) =>
      kind === "paid" ? "РЕКОМЕНДАЦІЯ З ВИНАГОРОДОЮ" : "РЕКОМЕНДАЦІЯ БЕЗ ВИНАГОРОДИ",
    disclosure: (compensation, displayName) => {
      switch (compensation) {
        case "referral-fee":
          return `Розкриття: якщо ви розпочнете підписку ${siteName}, ${displayName} отримає за це ${facts.reward?.["referral-fee"] ?? "винагороду"} від ${siteName}. Ваша ціна через це не змінюється. Рекомендація ні до чого вас не зобов'язує.`;
        case "none":
          return `Розкриття: між ${displayName} і ${siteName} діє партнерство з рекомендацій без грошової винагороди. Рекомендація ні до чого вас не зобов'язує.`;
        case "steward":
          return `Розкриття: ${displayName} працює для ${siteName} як ${facts.stewardRole ?? "партнер"} і отримує за це винагороду${facts.reward?.steward ? `, зокрема ${facts.reward.steward}` : ""}. Ваша ціна через це не змінюється. Рекомендація ні до чого вас не зобов'язує.`;
      }
    },
    proofsHeading: "Що ви конкретно отримуєте",
    proofs: facts.proofs ?? null,
    priceHeading: "Ціна — відкрито",
    priceLine: facts.priceLine ?? null,
    priceLinkLabel: "Перевірити обсяг послуг →",
    noPromisesHeading: "Чого вам тут ніхто не обіцяє",
    noPromises: [
      "Жодних гарантованих позицій.",
      "Жодних гарантованих звернень чи продажів.",
      "Жодного результату без вашої участі.",
    ],
    conditions: facts.benefit ? ukConditions(facts.benefit, facts.conditionsNote) : null,
    ctaPrimary: "Описати ситуацію",
    ctaSecondary: `Переглянути стандарт ${siteName}`,
    programLink: "Як працює програма рекомендацій",
    formHeading: "Опишіть вашу ситуацію",
    receipt: {
      heading: "Ваша квитанція рекомендації",
      labels: {
        recommendation: "Рекомендація",
        recommendedBy: "Рекомендує",
        compensationStatus: "Статус винагороди",
        ruleset: "Регламент",
        captured: "Зафіксовано",
      },
      compensationStatus: (compensation) =>
        compensation === "none"
          ? "Без винагороди"
          : `З винагородою${
              facts.reward?.[compensation === "steward" ? "steward" : "referral-fee"]
                ? ` · ${facts.reward[compensation === "steward" ? "steward" : "referral-fee"]}`
                : ""
            }`,
      ruleset: (effectiveFrom) => `Партнерська політика, станом на ${effectiveFrom}`,
      closing: [
        "Рекомендація ні до чого вас не зобов'язує.",
        "Код рекомендації можна вилучити перед надсиланням.",
      ],
    },
    retired: {
      title: "Ця рекомендація більше не активна",
      status: `${siteName} ви можете надалі перевіряти самостійно.`,
      home: "На головну",
    },
    anonymous: {
      h1: `Вам рекомендували ${siteName}`,
      lead: `Цю сторінку вам передали, бо ${siteName} може підійти вашому бізнесу. Ми робимо ${audience}: на власному домені, з письмовими умовами та передбаченим виходом.`,
      disclosure: (compensation) => {
        switch (compensation) {
          case "referral-fee":
            return `Розкриття: якщо ви розпочнете підписку ${siteName}, особа, яка рекомендувала вам цю сторінку, отримає за це ${facts.reward?.["referral-fee"] ?? "винагороду"} від ${siteName}. Ваша ціна через це не змінюється. Рекомендація ні до чого вас не зобов'язує.`;
          case "none":
            return `Розкриття: між особою, яка рекомендувала вам цю сторінку, і ${siteName} діє партнерство з рекомендацій без грошової винагороди. Рекомендація ні до чого вас не зобов'язує.`;
          case "steward":
            return `Розкриття: особа, яка рекомендувала вам цю сторінку, працює для ${siteName} як ${facts.stewardRole ?? "партнер"} і отримує за це винагороду${facts.reward?.steward ? `, зокрема ${facts.reward.steward}` : ""}. Ваша ціна через це не змінюється. Рекомендація ні до чого вас не зобов'язує.`;
        }
      },
    },
    privacy:
      "На цій сторінці ми не використовуємо cookie і нічого не зберігаємо у вашому браузері. Код рекомендації є лише в полі форми й передається разом із вашим запитом, доки ви його не приберете. Докладніше в політиці конфіденційності.",
  };
}

/**
 * Returns the landing copy for `lang`, with `siteName` (the site's public
 * business name from the PBP profile) and the site-authored `facts`
 * (partners.yaml `landing` + PBP partner-program benefit) interpolated
 * wherever they apply. The brand and economics are never hardcoded — this
 * module serves every workshop site.
 */
export function referralLandingCopy(
  lang: string,
  siteName: string,
  facts: ReferralLandingFacts = {},
): ReferralLandingCopy {
  return lang === "uk" ? ukCopy(siteName, facts) : deCopy(siteName, facts);
}
