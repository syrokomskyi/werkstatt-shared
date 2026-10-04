/*
<MODULE_CONTRACT>
<purpose>RFC-1192: the conditional cookie-consent surface. initCookieConsent() self-gates on
the [data-cookie-consent-host] node that the layout renders only when the site has an
entitled COOKIE_MODULES entry, renders the accept/decline surface, and persists the
visitor's choice via writeConsentFlag(). Dispatches the `wg:cookie-consent` CustomEvent so
consent-gated modules can react on the same page (no reload).</purpose>
<non-goals>
  <item>Never re-prompt after a recorded choice — both accept and decline are durable.</item>
  <item>Never write cookies itself — the surface only records the consent flag.</item>
  <item>No innerHTML sinks — DOM is built via createElement/textContent (Trusted Types, RFC-1178).</item>
  <item>Do not style beyond the minimal fixed-position shell — theming is a site concern.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1192: initial consent surface module (accept/decline -> wg_consent flag + wg:cookie-consent event).</item>
</CHANGE_SUMMARY>
*/

import { COOKIE_MODULES } from "../policy/cookies.ts";
import { readConsentFlag, writeConsentFlag } from "./cookie-write-gate.ts";

/** CustomEvent name dispatched on window after a consent choice is recorded. */
export const COOKIE_CONSENT_EVENT = "wg:cookie-consent";

const SURFACE_TEXT = {
  title: "Cookies auf dieser Website",
  body: "Diese Website setzt eigene Cookies für folgende Zwecke:",
  accept: "Akzeptieren",
  decline: "Ablehnen",
} as const;

/**
 * Self-gating init. No-ops when: no host node exists, a consent flag is
 * already recorded, or no catalog modules are active for the site.
 * `moduleIds` — the entitled COOKIE_MODULES ids resolved server-side
 * (orchestrator option `cookieModules`).
 */
export function initCookieConsent(moduleIds: readonly string[] = []): void {
  const host = document.querySelector("[data-cookie-consent-host]");
  if (!host) return;
  if (readConsentFlag() !== null) return;

  const active = COOKIE_MODULES.filter((m) => moduleIds.includes(m.moduleId));
  if (active.length === 0) return;

  const banner = document.createElement("div");
  banner.setAttribute("data-cookie-consent", "");
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", SURFACE_TEXT.title);
  banner.style.cssText =
    "position:fixed;inset:auto 0 0 0;z-index:9999;padding:1rem;" +
    "background:var(--ds-color-surface,#fff);color:var(--ds-color-text,#111);" +
    "border-top:1px solid currentColor;display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;";

  const text = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = SURFACE_TEXT.title;
  const body = document.createElement("p");
  body.textContent = SURFACE_TEXT.body;
  body.style.margin = "0";
  const purposes = document.createElement("ul");
  purposes.style.margin = "0";
  for (const mod of active) {
    for (const cookie of mod.cookies) {
      const li = document.createElement("li");
      li.textContent = cookie.purpose;
      purposes.appendChild(li);
    }
  }
  text.appendChild(title);
  text.appendChild(body);
  text.appendChild(purposes);
  banner.appendChild(text);

  const close = (granted: boolean) => {
    writeConsentFlag(granted);
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { granted } }));
    banner.remove();
  };

  const accept = document.createElement("button");
  accept.type = "button";
  accept.textContent = SURFACE_TEXT.accept;
  accept.addEventListener("click", () => close(true), { once: true });
  const decline = document.createElement("button");
  decline.type = "button";
  decline.textContent = SURFACE_TEXT.decline;
  decline.addEventListener("click", () => close(false), { once: true });
  banner.appendChild(accept);
  banner.appendChild(decline);

  host.appendChild(banner);
  host.setAttribute("data-cookie-consent-initialized", "true");
}
