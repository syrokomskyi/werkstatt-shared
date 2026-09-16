/*
<MODULE_CONTRACT>
<purpose>Applies security attributes to external anchor elements on the page. When the
external-link-qr entitlement is active, also injects a QR trigger span into each external link.</purpose>
<non-goals>
  <item>Do not handle internal navigation or routing.</item>
  <item>Do not modify non-HTTP links (mailto:, tel:, etc.).</item>
  <item>Do not generate QR codes — that is the responsibility of external-link-qr.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0011 Phase 2: Extracted from layout.astro inline script into src/scripts canonical pattern.</item>
  <item>RFC-0932: accept ExternalLinkBehaviorOptions, inject QR trigger span when entitled.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

export interface ExternalLinkBehaviorOptions {
  /** Whether the external-link-qr entitlement is resolved. Default false (fail-closed). */
  externalLinkQrEntitled?: boolean;
}

// @ai-invariant: This function must only modify external HTTP/HTTPS links. Never touch mailto:, tel:, or internal links.
export function applyExternalLinkBehavior(options?: ExternalLinkBehaviorOptions): void {
  const anchors = document.querySelectorAll("a[href]");
  const qrEntitled = options?.externalLinkQrEntitled === true;

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");

    if (!href) {
      continue;
    }

    let resolvedUrl;

    try {
      resolvedUrl = new URL(href, window.location.href);
    } catch {
      continue;
    }

    const isHttpLink = resolvedUrl.protocol === "http:" || resolvedUrl.protocol === "https:";
    const isExternalLink = isHttpLink && resolvedUrl.origin !== window.location.origin;

    if (!isExternalLink) {
      continue;
    }

    anchor.setAttribute("data-external-link", "1");
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");

    if (qrEntitled && anchor.getAttribute("data-external-link-qr") !== "off") {
      // Skip QR trigger for anchors wrapping media elements — a text arrow
      // appended after an image/SVG/canvas looks visually wrong.
      const hasMediaChild = anchor.querySelector("img, svg, canvas, picture");
      if (hasMediaChild) {
        continue;
      }
      if (!anchor.querySelector("[data-qr-trigger]")) {
        const trigger = document.createElement("span");
        trigger.className = "external-link-qr-trigger";
        trigger.setAttribute("role", "button");
        trigger.setAttribute("tabindex", "0");
        trigger.setAttribute("aria-label", "QR-Code anzeigen");
        trigger.setAttribute("data-qr-trigger", "");
        trigger.textContent = "\u2197";
        anchor.appendChild(trigger);
      }
    }
  }
}
