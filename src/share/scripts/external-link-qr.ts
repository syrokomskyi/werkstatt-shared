/*
<MODULE_CONTRACT>
<purpose>RFC-0932: Client-side QR code modal for external links. Attaches click/keyboard
handlers to [data-qr-trigger] elements, lazy-loads the qrcode library on first activation,
and manages the modal lifecycle (open, close, focus trap, body scroll lock).</purpose>
<non-goals>
  <item>Do not generate QR codes for internal links or non-HTTP links.</item>
  <item>Do not manage entitlement state — the orchestrator only calls initExternalLinkQr() when entitled.</item>
  <item>Do not create the modal DOM — the modal element is rendered by layout-component.astro.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0932: initial implementation — QR modal lifecycle, dynamic qrcode import, focus trap, body scroll lock.</item>
</CHANGE_SUMMARY>
*/

export interface ExternalLinkQrOptions {
  /** CSS selector for the modal container element. Default: "[data-external-link-qr-modal]" */
  modalSelector?: string;
  /** QR code error correction level. Default: "M" */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

const DEFAULT_MODAL_SELECTOR = "[data-external-link-qr-modal]";
const DEFAULT_ERROR_CORRECTION = "M" as const;

let initialized = false;

export function initExternalLinkQr(options?: ExternalLinkQrOptions): void {
  if (initialized) return;
  initialized = true;

  const modalSelector = options?.modalSelector ?? DEFAULT_MODAL_SELECTOR;
  const errorCorrectionLevel = options?.errorCorrectionLevel ?? DEFAULT_ERROR_CORRECTION;

  const modalEl = document.querySelector<HTMLElement>(modalSelector);
  if (!modalEl) return;
  const modal: HTMLElement = modalEl;

  const overlay = modal.querySelector<HTMLElement>("[data-qr-overlay]");
  const canvas = modal.querySelector<HTMLCanvasElement>("[data-qr-canvas]");
  const closeBtnEl = modal.querySelector<HTMLButtonElement>("[data-qr-close]");
  const openLinkBtn = modal.querySelector<HTMLAnchorElement>("[data-qr-open-link]");
  const titleEl = modal.querySelector<HTMLElement>("[data-qr-title]");
  const errorEl = modal.querySelector<HTMLElement>("[data-qr-error]");

  if (!overlay || !closeBtnEl) return;
  const closeBtn: HTMLButtonElement = closeBtnEl;

  let lastFocused: HTMLElement | null = null;

  function openModal(href: string, trigger: HTMLElement): void {
    lastFocused = trigger;

    if (titleEl) {
      try {
        const url = new URL(href);
        titleEl.textContent = url.hostname + url.pathname;
      } catch {
        titleEl.textContent = href;
      }
    }

    if (openLinkBtn) {
      openLinkBtn.setAttribute("href", href);
    }

    if (errorEl) {
      errorEl.hidden = true;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";

    if (canvas) {
      generateQr(href).catch(() => {
        if (errorEl) {
          errorEl.hidden = false;
        }
      });
    }

    closeBtn.focus();
  }

  async function generateQr(href: string): Promise<void> {
    if (!canvas) return;
    const { toCanvas } = await import("qrcode");
    await toCanvas(canvas, href, {
      width: 256,
      margin: 2,
      errorCorrectionLevel,
    });
  }

  function closeModal(): void {
    modal.hidden = true;
    document.body.style.overflow = "";

    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (lastFocused) {
      lastFocused.focus();
      lastFocused = null;
    }
  }

  function isModalOpen(): boolean {
    return !modal.hidden;
  }

  function handleTriggerClick(e: Event): void {
    const trigger = e.currentTarget as HTMLElement;
    const anchor = trigger.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    e.preventDefault();
    e.stopPropagation();
    openModal(href, trigger);
  }

  function handleTriggerKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    const trigger = e.currentTarget as HTMLElement;
    const anchor = trigger.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    openModal(href, trigger);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!isModalOpen()) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === "Tab") {
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  function attachTriggers(): void {
    const triggers = document.querySelectorAll<HTMLElement>("[data-qr-trigger]");
    for (const trigger of triggers) {
      trigger.addEventListener("click", handleTriggerClick);
      trigger.addEventListener("keydown", handleTriggerKeydown);
    }
  }

  overlay.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);
  document.addEventListener("keydown", handleKeydown);

  attachTriggers();
}
