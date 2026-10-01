/*
<MODULE_CONTRACT>
<purpose>Provides a standard orchestration logic for layout-global scripts across all Warpgogol projects.</purpose>
<non-goals>
  <item>Do not handle project-specific feature logic directly.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
  <item>RFC-1175: initBackgroundVideos for video[data-bg-video] — capability-gated background autoplay (always-on step; the marker replaces the native autoplay attribute in media.astro).</item>
  <item>RFC-1175: close Lighthouse gaps — directive-allowlist robots (Schemamap retired, ROBOTS-SURFACE-01), capability-gated video (preload=none, data-bg-video, saveData/reduced-motion), single fetchpriority=high per page (IMG-DELIVERY-05), inlined shared texture token, 24px QR touch targets; RFC-1177 security-headers draft</item>
  <item>RFC-1175 AC-5: single-chunk orchestrator — all self-gating feature modules statically imported (scheduler, gsap-*, inline-number, live-photos, video-player, background-video, external-link-qr), so the entry script's one dynamic import resolves the whole dispatch graph; heavy deps stay lazy inside each init.</item>
  <item>warpgogol-m000170: initLenis moved behind scheduleTask — it was the only awaited feature init, pulling the lenis chunk into the critical request chain Lighthouse reported.</item>
  <history>RFC-1097</history>
</CHANGE_SUMMARY>
*/

// @ai-invariant: This is a high-risk module. Preserve its core logic and minimize external side effects during modification.

// RFC-1178: the werkstatt Trusted Types policy is a static side-effect
// import — it must evaluate before any feature module so the policy exists
// before the first sink write; never move it behind a dynamic import.
import "./trusted-types.ts";
// RFC-1175: self-gating modules are statically imported so the orchestrator
// is emitted as a single chunk — the only dynamic import after the entry
// script. Heavy third-party deps (gsap, plyr, hls.js, @lordicon/element,
// qrcode, lenis) stay lazy: each init loads them only when its trigger exists.
import { applyExternalLinkBehavior } from "./external-links.ts";
import { initLordIconOnDemand } from "./lordicon.ts";
import { initLenis } from "./lenis.ts";
import { initScrollSpy } from "./scroll-spy.ts";
import { initBackgroundVideos } from "./background-video.ts";
import { initExternalLinkQr } from "./external-link-qr.ts";
import { initGsapCounter } from "./gsap-counter.ts";
import { initGsapParallax } from "./gsap-parallax.ts";
import { initGsapReveal } from "./gsap-reveal.ts";
import { initGsapStagger } from "./gsap-stagger.ts";
import { initInlineNumberAnimation } from "./inline-number-animation.ts";
import { initLivePhotos } from "./live-photos.ts";
import { initVideoPlayers } from "./video-player.ts";
import { scheduleTask } from "./scheduler.ts";

export interface OrchestrationOptions {
  headerOffset?: number;
  /** RFC-0040: opt in to GSAP stat counter animation. Default false. */
  counters?: boolean;
  /** RFC-0041: opt in to GSAP inline number animation for prose sections. Default false. */
  inlineNumbers?: boolean;
  /** RFC-0106: opt in to GSAP scroll-triggered reveal animations. Default false. */
  reveal?: boolean;
  /** RFC-0106: opt in to GSAP parallax for [data-parallax-speed] elements. Default false. */
  parallax?: boolean;
  /** RFC-0106: opt in to GSAP stagger for [data-motion-stagger] parents. Default false. */
  stagger?: boolean;
  /** RFC-0202: opt in to the living-photos runtime for [data-live-photo] elements. Default false. */
  livePhotos?: boolean;
  /** RFC-0210: opt in to the lazy feature-video player (Plyr + hls.js) for [data-video-player]. Default false. */
  videoPlayers?: boolean;
  /** RFC-0205: opt in to Lenis smooth scroll. Default false — avoids loading the 17 KB bundle when not needed. */
  smoothScroll?: boolean;
  /** RFC-0932: entitlement state for external-link-qr module. Passed from layout. */
  externalLinkQrEntitled?: boolean;
}

const has = (selector: string) => document.querySelector(selector) instanceof Element;

/**
 * Runs the standard set of browser initializations required for all Warpgogol platform sites.
 */
export async function runStandardLayoutOrchestration(
  options: OrchestrationOptions = {},
): Promise<void> {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1. External links security (mandatory)
  if (has("a[href]")) {
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => applyExternalLinkBehavior({ externalLinkQrEntitled: options.externalLinkQrEntitled }),
        {
          once: true,
        },
      );
    } else {
      applyExternalLinkBehavior({ externalLinkQrEntitled: options.externalLinkQrEntitled });
    }
  }

  // 2. LordIcon hydration (deferred to load event to avoid blocking LCP)
  if (has("lord-icon")) {
    if (document.readyState === "complete") {
      initLordIconOnDemand();
    } else {
      window.addEventListener("load", () => initLordIconOnDemand(), { once: true });
    }
  }

  // 3. Lenis smooth scroll (opt-in via smoothScroll: true)
  // m000170: scheduled at idle like the other feature inits — awaiting it here
  // put the lenis chunk fetch inside the critical request chain.
  if (options.smoothScroll) {
    scheduleTask(async () => {
      await initLenis({
        prefersReducedMotion,
        headerOffset: options.headerOffset ?? 80,
      });
    });
  }

  // 4. GSAP stat counter (RFC-0040 — opt-in via counters: true)
  // Note: has() check removed; initGsapCounter internally guards against empty sections.
  if (options.counters) {
    scheduleTask(async () => {
      await initGsapCounter({ prefersReducedMotion });
    });
  }

  // 5. GSAP inline number animation (RFC-0041 — opt-in via inlineNumbers: true)
  if (options.inlineNumbers && has(".js-inline-number")) {
    scheduleTask(async () => {
      await initInlineNumberAnimation({ prefersReducedMotion });
    });
  }

  // 6. RFC-0106: reveal animations (opt-in via reveal: true).
  if (options.reveal && has("[data-motion-reveal]")) {
    scheduleTask(async () => {
      await initGsapReveal({ prefersReducedMotion });
    });
  }

  // 7. RFC-0106: parallax animations (opt-in via parallax: true).
  if (options.parallax && has("[data-parallax-speed]")) {
    scheduleTask(async () => {
      await initGsapParallax({ prefersReducedMotion });
    });
  }

  // 8. RFC-0106: stagger animations (opt-in via stagger: true).
  if (options.stagger && has("[data-motion-stagger]")) {
    scheduleTask(async () => {
      await initGsapStagger({ prefersReducedMotion });
    });
  }

  // 9. RFC-0202: living photos runtime (opt-in via livePhotos: true).
  // Only the in-viewport/tap triggers carry [data-trigger]; the autoplay path is native.
  if (options.livePhotos && has("[data-live-photo][data-trigger]")) {
    scheduleTask(async () => {
      await initLivePhotos({ prefersReducedMotion });
    });
  }

  // 10. RFC-0210: feature-video player (opt-in via videoPlayers: true).
  // Lazy Plyr + hls.js, gated on [data-video-player]; nothing loads without a feature video.
  if (options.videoPlayers && has("video[data-video-player]")) {
    scheduleTask(async () => {
      await initVideoPlayers({ prefersReducedMotion });
    });
  }

  // 10b. RFC-1175: background <video> loops — autoplay is capability-gated here
  // instead of via the HTML attribute, so bytes never fetch on saveData /
  // reduced-motion. Always-on: without this step the element can never play.
  if (has("video[data-bg-video]")) {
    scheduleTask(async () => {
      initBackgroundVideos({ prefersReducedMotion });
    });
  }

  // 11. RFC-0932: external-link QR code modal (opt-in via externalLinkQrEntitled: true).
  // The modal element is rendered by layout-component.astro only on entitled sites.
  if (options.externalLinkQrEntitled && has("[data-external-link-qr-modal]")) {
    initExternalLinkQr();
  }

  // 12. RFC-1061: scroll-spy URL hash updates (always-on, zero-dependency).
  initScrollSpy();
}
