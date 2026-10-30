/*
<MODULE_CONTRACT>
<purpose>
  [RFC-0174] Binding-language policy resolver for legal documents.
  Pure functions that turn a page's authored `translation` frontmatter block into
  a render-time decision: is this the binding-language version, what is the locale's
  translation status (including RFC-1425 "untranslated" — the locale serves the
  binding document itself), must the mandatory language notice + indicator be
  shown, and where does the binding document live.
</purpose>
<non-goals>
  <item>Do not read content or the route registry — the binding URL is injected by the caller.</item>
  <item>Do not render markup — that is @warpgogol/werkstatt-site/ui's translation-notice component.</item>
  <item>Do not translate copy — the notice component owns localized microcopy.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0174: initial binding-language policy resolver.</item>
  <item>RFC-1425: `untranslated` status — locale serves the binding document itself, deliberately untranslated (neutral notice, never a redirect).</item>
  <item>RFC-1425 review r1: JURISDICTION_BINDING_LANG moved here — single source consumed by emitter (legal.scaffold) and validator (legal.translation.validate) doors; showIndicator doc covers untranslated.</item>
  <item>RFC-1437: footer legal-identity panel in the binding legal language</item>
</CHANGE_SUMMARY>
*/

/** Per-locale translation status for a legal document. */
export type TranslationStatus = "official" | "unofficial" | "untranslated" | "disabled";

export const TRANSLATION_STATUSES: readonly TranslationStatus[] = [
  "official",
  "unofficial",
  "untranslated",
  "disabled",
] as const;

/**
 * RFC-1329: the binding language a `system.md` `legalJurisdiction` (ISO 3166-1
 * alpha-2) implies. Sites carrying one of these jurisdictions scaffold
 * Impressum + Datenschutz on every supported locale — the binding text is
 * inline, so no binding-language page file is required. Single source consumed
 * by both the emitter (legal.scaffold) and the validator
 * (legal.translation.validate) — duplicating the set in checks/codegen makes
 * the two doors diverge silently.
 */
export const JURISDICTION_BINDING_LANG: Readonly<Record<string, string>> = {
  DE: "de",
  AT: "de",
  CH: "de",
};

/**
 * RFC-1437: canonical accessor for the jurisdiction→binding-language map —
 * the footer's legal panel resolves the same binding language as the
 * scaffold/validator doors without a second copy of the table.
 */
export function bindingLanguageFor(
  legalJurisdiction: string | undefined,
): string | undefined {
  return legalJurisdiction === undefined
    ? undefined
    : JURISDICTION_BINDING_LANG[legalJurisdiction];
}

/**
 * Authored `translation` block, declared once in the binding-language page file
 * (e.g. `pages/de/datenschutz.md`). Lives in the client-editable `pages` surface
 * (DNA-22) so the client toggles it without engineering.
 */
export interface PageTranslationPolicy {
  /** Legally binding language code for this page (e.g. "de"). */
  binding: string;
  /** pageId of the binding document; defaults to the declaring page's id. */
  bindingPageId?: string;
  /** Localized display name of the binding document, e.g. "Datenschutzerklärung". */
  bindingDocLabel?: string;
  /**
   * Mandatory language notice. Default true. The validator forbids `false` while
   * any non-binding locale is `unofficial`.
   */
  notice?: boolean;
  /** Persistent translation-status indicator chip. Default true. */
  indicator?: boolean;
  /**
   * Per-locale status. A locale absent here that has a translation file is treated
   * as "unofficial". The binding language itself is always treated as official.
   * "untranslated" means the locale serves the binding document itself,
   * deliberately untranslated (RFC-1425) — it still carries the language notice.
   */
  locales?: Record<string, TranslationStatus>;
}

/** Render-time decision for the current (lang, pageId). */
export interface ResolvedTranslationContext {
  /** Is the current render the binding-language version? */
  isBinding: boolean;
  /** Effective status of the current locale. */
  status: TranslationStatus;
  /** Binding language code (for dual-language notice copy). */
  bindingLang: string;
  /** Localized name of the binding document for the notice link text. */
  bindingDocLabel?: string;
  /** Absolute or localized URL of the binding document (notice link + redirect target). */
  bindingUrl: string;
  /** Inject the mandatory language-notice banner. */
  showNotice: boolean;
  /** Render the persistent translation-status indicator (unofficial or untranslated). */
  showIndicator: boolean;
  /**
   * When set, this locale is `disabled` and the route should redirect to the
   * binding-language document instead of serving the untrusted translation.
   */
  redirectTo?: string;
}

function normalizeStatus(value: unknown): TranslationStatus | undefined {
  return TRANSLATION_STATUSES.includes(value as TranslationStatus)
    ? (value as TranslationStatus)
    : undefined;
}

/**
 * Resolve the binding-language decision for one render.
 *
 * Returns `null` when the page declares no `translation.binding` (i.e. it is not a
 * legal page under policy) — callers then render normally with no notice.
 *
 * @param resolveBindingUrl Callback that maps (bindingPageId, bindingLang) to the
 *        binding document's URL. Injected so this module stays free of the route
 *        registry / content dependencies.
 */
export function resolveTranslationContext(args: {
  lang: string;
  pageId: string;
  policy: PageTranslationPolicy | undefined | null;
  resolveBindingUrl: (bindingPageId: string, bindingLang: string) => string | null;
}): ResolvedTranslationContext | null {
  const { lang, pageId, policy, resolveBindingUrl } = args;
  if (!policy || typeof policy.binding !== "string" || policy.binding.length === 0) {
    return null;
  }

  const bindingLang = policy.binding;
  const bindingPageId = policy.bindingPageId ?? pageId;
  const isBinding = lang === bindingLang;

  // The binding-language render is the authoritative text — never gets a notice.
  const status: TranslationStatus = isBinding
    ? "official"
    : (normalizeStatus(policy.locales?.[lang]) ?? "unofficial");

  const bindingUrl = resolveBindingUrl(bindingPageId, bindingLang) ?? "";
  const noticeEnabled = policy.notice !== false;
  const indicatorEnabled = policy.indicator !== false;

  // RFC-1425: the mandatory notice + indicator cover every locale that is NOT
  // a vetted translation — unofficial service translations and deliberately
  // untranslated binding-document renders alike.
  const noticed = status === "unofficial" || status === "untranslated";
  const showNotice = !isBinding && noticed && noticeEnabled;
  const showIndicator = !isBinding && noticed && indicatorEnabled;
  const redirectTo = !isBinding && status === "disabled" ? bindingUrl : undefined;

  return {
    isBinding,
    status,
    bindingLang,
    bindingDocLabel: policy.bindingDocLabel,
    bindingUrl,
    showNotice,
    showIndicator,
    ...(redirectTo ? { redirectTo } : {}),
  };
}
