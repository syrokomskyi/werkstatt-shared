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
</CHANGE_SUMMARY>
*/

export function selectRendition(wrapper: HTMLElement, lang: string): void {
  const renditions = wrapper.querySelectorAll<HTMLElement>(".section-languages__rendition");
  for (const rendition of renditions) {
    const match = rendition.dataset.renditionLang === lang;
    if (match) rendition.removeAttribute("hidden");
    else rendition.setAttribute("hidden", "");
  }
  const tabs = wrapper.querySelectorAll<HTMLButtonElement>(".lang-switcher__section-tab");
  for (const tab of tabs) {
    const active = tab.dataset.renditionLang === lang;
    tab.setAttribute("aria-selected", active ? "true" : "false");
    if (active) tab.dataset.current = "true";
    else delete tab.dataset.current;
  }
}

export function initSectionLanguages(root: Document | HTMLElement): void {
  const wrappers = root.querySelectorAll<HTMLElement>("[data-section-languages]");
  for (const wrapper of wrappers) {
    const tabs = wrapper.querySelectorAll<HTMLButtonElement>(".lang-switcher__section-tab");
    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        const lang = tab.dataset.renditionLang;
        if (lang) selectRendition(wrapper, lang);
      });
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const next = tabs[(index + direction + tabs.length) % tabs.length];
        next.focus();
        const lang = next.dataset.renditionLang;
        if (lang) selectRendition(wrapper, lang);
      });
    });
  }
  // Deep link: #<blockId>-<lang> selects that rendition on load.
  const hash = window.location.hash.slice(1);
  const hashMatch = hash.match(/^(.+)-([a-z]{2,3}(?:-[A-Za-z]+)?)$/);
  if (hashMatch) {
    const [, blockId, lang] = hashMatch;
    const wrapper = document.getElementById(blockId);
    if (wrapper?.hasAttribute("data-section-languages")) {
      selectRendition(wrapper, lang);
    }
  }
}

