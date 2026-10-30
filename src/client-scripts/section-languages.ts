/*
<MODULE_CONTRACT>
<purpose>
  RFC-1444: section-scoped language switcher behavior — toggles rendition
  visibility inside a `data-section-languages` wrapper. Tab buttons
  (`role="tab"`) flip `hidden`/`aria-selected`; arrow keys move between tabs;
  `#<blockId>-<lang>` deep links select that rendition on load. No storage,
  no network — the markup ships all renditions.
</purpose>
<non-goals>
  <item>Do not fetch content — all renditions are server-rendered.</item>
  <item>Do not touch page-level language — the page locale never changes.</item>
  <item>Do not self-execute — the layout orchestrator calls initSectionLanguages when [data-section-languages] is present.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1444: initial client script — tab toggle, arrow keys, hash deep link.</item>
  <item>RFC-1444: replace companion renditions with section-scoped languages (RFC-1444)</item>
  <item>RFC-1444: section-language switcher in the section header — styled code tabs with endonym labels, switch alternates keep heading look (h1-only demotion), unique ids, SECTION-LANG-03 covers rendition prose</item>
  <item>RFC-1444: scroll to a section-language deep-link target once its rendition is shown</item>
</CHANGE_SUMMARY>
*/

export function selectRendition(wrapper: HTMLElement, lang: string): void {
  const renditions = wrapper.querySelectorAll<HTMLElement>(".section-languages__rendition");
  for (const rendition of renditions) {
    const match = rendition.dataset.renditionLang === lang;
    if (match) rendition.removeAttribute("hidden");
    else rendition.setAttribute("hidden", "");
  }
  // Every rendition carries its own switcher (it lives in the section header
  // slot); keep all tab copies in sync so the visible one is always correct.
  const tabs = wrapper.querySelectorAll<HTMLButtonElement>(".lang-switcher__section-tab");
  for (const tab of tabs) {
    const active = tab.dataset.renditionLang === lang;
    tab.setAttribute("aria-selected", active ? "true" : "false");
    if (active) {
      tab.dataset.current = "true";
      tab.removeAttribute("tabindex");
    } else {
      delete tab.dataset.current;
      tab.setAttribute("tabindex", "-1");
    }
  }
}

/** The switcher control for `lang` inside the currently visible rendition. */
function visibleControl(wrapper: HTMLElement, lang: string): HTMLButtonElement | null {
  const visible = wrapper.querySelector<HTMLElement>(".section-languages__rendition:not([hidden])");
  if (!visible) return null;
  return (
    visible.querySelector<HTMLButtonElement>(
      `.lang-switcher__section-tab[data-rendition-lang="${lang}"]`,
    ) ?? visible.querySelector<HTMLButtonElement>(".lang-switcher__section-pill")
  );
}

export function initSectionLanguages(root: Document | HTMLElement): void {
  const wrappers = root.querySelectorAll<HTMLElement>("[data-section-languages]");
  for (const wrapper of wrappers) {
    const controls = wrapper.querySelectorAll<HTMLButtonElement>(
      ".lang-switcher__section-tab, .lang-switcher__section-pill",
    );
    for (const control of controls) {
      control.addEventListener("click", () => {
        const lang = control.dataset.renditionLang;
        if (!lang) return;
        const hadFocus = document.activeElement === control;
        selectRendition(wrapper, lang);
        if (hadFocus) visibleControl(wrapper, lang)?.focus();
      });
    }
    for (const tablist of wrapper.querySelectorAll<HTMLElement>("[role=tablist]")) {
      const tabs = [...tablist.querySelectorAll<HTMLButtonElement>(".lang-switcher__section-tab")];
      tabs.forEach((tab, index) => {
        tab.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const next = tabs[(index + direction + tabs.length) % tabs.length];
          const lang = next?.dataset.renditionLang;
          if (!lang) return;
          selectRendition(wrapper, lang);
          visibleControl(wrapper, lang)?.focus();
        });
      });
    }
  }
  // Deep link: #<blockId>-<lang> selects that rendition on load.
  const hash = window.location.hash.slice(1);
  const hashMatch = hash.match(/^(.+)-([a-z]{2,3}(?:-[A-Za-z]+)?)$/);
  if (hashMatch) {
    const [, blockId, lang] = hashMatch;
    // The wrapper carries no id (the primary section already owns
    // id=<blockId>); it is addressed by data-block-id instead.
    const wrapper = document.querySelector<HTMLElement>(
      `[data-section-languages][data-block-id="${CSS.escape(blockId)}"]`,
    );
    if (wrapper) {
      selectRendition(wrapper, lang);
      // The target rendition was hidden at load, so the browser's own
      // fragment scroll found nothing — scroll once it is visible.
      document.getElementById(hash)?.scrollIntoView();
    }
  }
}
