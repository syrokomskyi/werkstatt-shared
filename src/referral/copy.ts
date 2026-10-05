/*
<MODULE_CONTRACT>
<purpose>
[RFC-1198] Platform-owned locale copy for the referral-partner landing page
(/r/<slug>). The disclosure sentences are legal text — identical across all
sites by design, so they live in shared code, not site content. DE is the
legally binding version; UK is a synced reference translation.
</purpose>
<non-goals>
  <item>Do not interpolate anything beyond {displayName} — the copy is fixed contract text.</item>
  <item>Do not add storage/cookie strings — the page must be able to claim zero storage truthfully.</item>
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
</CHANGE_SUMMARY>
*/

export type ReferralCompensation = "referral-fee" | "none" | "steward";

export interface ReferralLandingCopy {
  eyebrow: string;
  /** Interpolates {displayName}. */
  h1: (displayName: string) => string;
  /** Interpolates {displayName}. */
  lead: (displayName: string) => string;
  /** Compensation-variant disclosure — interpolates {displayName}. */
  disclosure: (compensation: ReferralCompensation, displayName: string) => string;
  expectationsHeading: string;
  expectations: readonly string[];
  conditions: string;
  ctaPrimary: string;
  ctaSecondary: string;
  programLink: string;
  programLinkPath: string;
  privacy: string;
}

const DE_COPY: ReferralLandingCopy = {
  eyebrow: "Persönliche Empfehlung",
  h1: (displayName) => `${displayName} empfiehlt Warpgogol`,
  lead: (displayName) =>
    `${displayName} hat Ihnen diese Seite geschickt, weil Warpgogol zu Ihrem Betrieb passen könnte. Wir bauen Firmenwebsites für Handwerk und lokales Gewerbe - auf eigener Domain, mit schriftlichen Bedingungen und vorgesehenem Ausstieg.`,
  disclosure: (compensation, displayName) => {
    switch (compensation) {
      case "referral-fee":
        return `Offenlegung: Wenn Sie ein Warpgogol-Abonnement beginnen, erhält ${displayName} dafür 70 € von Warpgogol. Ihr Preis ändert sich dadurch nicht. Eine Empfehlung verpflichtet Sie zu nichts.`;
      case "none":
        return `Offenlegung: Zwischen ${displayName} und Warpgogol besteht eine Empfehlungspartnerschaft ohne monetäre Vergütung. Eine Empfehlung verpflichtet Sie zu nichts.`;
      case "steward":
        return `Offenlegung: ${displayName} ist als Markt-Steward für Warpgogol tätig und erhält dafür eine Vergütung, unter anderem 70 € für jedes neue Abonnement. Ihr Preis ändert sich dadurch nicht. Eine Empfehlung verpflichtet Sie zu nichts.`;
    }
  },
  expectationsHeading: "Was Sie erwartet",
  expectations: [
    "Sie beschreiben Ihre Situation in wenigen Sätzen.",
    "Wir antworten persönlich und schriftlich.",
    "Ein Vertrag entsteht erst nach separater schriftlicher Vereinbarung.",
  ],
  conditions:
    "Empfohlene Betriebe starten mit Priorität in der nächsten Welle und erhalten 1 Monat Subscription kostenlos, sofern das Abonnement im 2. Monat aktiv bleibt (AGB § 3 Abs. 5).",
  ctaPrimary: "Situation beschreiben",
  ctaSecondary: "Den Warpgogol Standard ansehen",
  programLink: "So funktioniert das Empfehlungsprogramm",
  programLinkPath: "/verantwortungsvolle-empfehlungen",
  privacy:
    "Auf dieser Seite setzen wir keine Cookies und speichern nichts in Ihrem Browser. Der Empfehlungscode steht nur in der Adresse der Kontaktseite und wird mit Ihrer Anfrage übermittelt, solange Sie ihn nicht entfernen. Mehr in der Datenschutzerklärung (Abschnitt 5.3).",
};

const UK_COPY: ReferralLandingCopy = {
  eyebrow: "Особиста рекомендація",
  h1: (displayName) => `${displayName} рекомендує Warpgogol`,
  lead: (displayName) =>
    `${displayName} надіслав(ла) вам цю сторінку, бо Warpgogol може підійти вашому бізнесу. Ми робимо вебсайти для ремесла та місцевого бізнесу: на власному домені, з письмовими умовами та передбаченим виходом.`,
  disclosure: (compensation, displayName) => {
    switch (compensation) {
      case "referral-fee":
        return `Розкриття: якщо ви розпочнете підписку Warpgogol, ${displayName} отримає за це 70 € від Warpgogol. Ваша ціна через це не змінюється. Рекомендація ні до чого вас не зобов'язує.`;
      case "none":
        return `Розкриття: між ${displayName} і Warpgogol діє партнерство з рекомендацій без грошової винагороди. Рекомендація ні до чого вас не зобов'язує.`;
      case "steward":
        return `Розкриття: ${displayName} працює для Warpgogol як Markt-Steward і отримує за це винагороду, зокрема 70 € за кожну нову підписку. Ваша ціна через це не змінюється. Рекомендація ні до чого вас не зобов'язує.`;
    }
  },
  expectationsHeading: "Що вас чекає",
  expectations: [
    "Ви описуєте свою ситуацію кількома реченнями.",
    "Ми відповідаємо особисто і письмово.",
    "Договір виникає лише після окремої письмової домовленості.",
  ],
  conditions:
    "Рекомендовані підприємства стартують із пріоритетом у наступній хвилі й отримують 1 місяць підписки безкоштовно, якщо підписка залишається активною на 2-й місяць (AGB § 3 абз. 5).",
  ctaPrimary: "Описати ситуацію",
  ctaSecondary: "Переглянути стандарт Warpgogol",
  programLink: "Як працює програма рекомендацій",
  programLinkPath: "/uk/vidpovidalni-rekomendatsiyi",
  privacy:
    "На цій сторінці ми не використовуємо cookie і нічого не зберігаємо у вашому браузері. Код рекомендації є лише в адресі сторінки контактів і передається разом із вашим запитом, доки ви його не приберете. Докладніше в політиці конфіденційності (розділ 5.3).",
};

export function referralLandingCopy(lang: string): ReferralLandingCopy {
  return lang === "uk" ? UK_COPY : DE_COPY;
}
