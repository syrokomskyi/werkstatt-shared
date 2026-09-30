/*
<MODULE_CONTRACT>
<purpose>
  RFC-1175: capability-gated autoplay for decorative background <video> loops.
  media.astro emits `data-bg-video` instead of the native `autoplay` attribute so
  no video bytes are fetched before this runtime decides — suppressed entirely on
  prefers-reduced-motion and navigator.connection.saveData (poster stays), and
  viewport-gated via IntersectionObserver otherwise (play in view, pause out of
  view, pause on hidden tab).
</purpose>
<non-goals>
  <item>Do not handle feature-video playback — that is video-player.ts (Plyr + hls.js).</item>
  <item>Do not handle living photos — live-photos.ts owns [data-live-photo].</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1175: initial implementation — saveData/reduced-motion/viewport-gated background autoplay.</item>
  <item>RFC-1175: close Lighthouse gaps — directive-allowlist robots (Schemamap retired, ROBOTS-SURFACE-01), capability-gated video (preload=none, data-bg-video, saveData/reduced-motion), single fetchpriority=high per page (IMG-DELIVERY-05), inlined shared texture token, 24px QR touch targets; RFC-1177 security-headers draft</item>
</CHANGE_SUMMARY>
*/

export interface BackgroundVideosOptions {
  prefersReducedMotion?: boolean;
}

function mayAutoplay(prefersReducedMotion: boolean): boolean {
  if (prefersReducedMotion) return false;
  const connection =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}

function play(video: HTMLVideoElement): void {
  // iOS Safari respects the autoplay attribute more than programmatic play()
  // (live-photos.ts precedent) — set it before calling play().
  video.setAttribute("autoplay", "");
  void video.play().catch(() => {
    /* Autoplay may still be rejected by browser policy — the poster stays. */
  });
}

function pause(video: HTMLVideoElement): void {
  video.removeAttribute("autoplay");
  video.pause();
}

export function initBackgroundVideos(options: BackgroundVideosOptions = {}): void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video[data-bg-video]"));
  if (videos.length === 0) return;

  const prefersReducedMotion =
    options.prefersReducedMotion ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!mayAutoplay(prefersReducedMotion)) return;

  if (!("IntersectionObserver" in window)) {
    for (const video of videos) play(video);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          play(video);
        } else {
          pause(video);
        }
      }
    },
    { threshold: 0.1 },
  );
  for (const video of videos) observer.observe(video);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    for (const video of videos) pause(video);
  });

  // RFC-1175: smoke-test init marker (SMOKE-INIT-01) — set after the last
  // addEventListener so component-smoke can synchronize on init completion.
  document.documentElement.setAttribute("data-bg-video-initialized", "true");
}
