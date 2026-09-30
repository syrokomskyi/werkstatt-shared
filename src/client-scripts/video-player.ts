/*
<MODULE_CONTRACT>
<purpose>
  [RFC-0210] Feature-video runtime. Lazily upgrades native <video controls> elements marked
  [data-video-player] into a branded Plyr player, attaching hls.js for adaptive HLS playback on
  browsers without native HLS. Follows the RFC-0175 click-to-load / in-viewport posture: nothing
  is imported until a feature video is near the viewport, so pages without a feature video (and
  the above-the-fold paint) ship zero player bytes. Resolves and records the playback mode
  (file|stream) + impl (native|hlsjs|progressive) on the element. Degrades to the native controls
  if Plyr/hls.js fail to load (progressive enhancement).
</purpose>
<non-goals>
  <item>Do not touch ambient/background <video> — those are native (handled by live-photos).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0210: introduced the lazy feature-video player runtime.</item>
  <item>RFC-0950: added viewport play/pause observer, conditional Plyr controls, and HLS+autoplay timing.</item>
  <item>RFC-1175: autoplay capability gate — prefers-reduced-motion / navigator.connection.saveData suppress data-autoplay playback (poster stays; manual play unaffected).</item>
  <item>RFC-1175: close Lighthouse gaps — directive-allowlist robots (Schemamap retired, ROBOTS-SURFACE-01), capability-gated video (preload=none, data-bg-video, saveData/reduced-motion), single fetchpriority=high per page (IMG-DELIVERY-05), inlined shared texture token, 24px QR touch targets; RFC-1177 security-headers draft</item>
  <item>RFC-1175 AC-5: plyr.css moved from top-level import into the Plyr branch — keeps the stylesheet lazy so the orchestrator single-chunk import carries no feature-player CSS.</item>
</CHANGE_SUMMARY>
*/

// RFC-1175: plyr.css is imported inside the Plyr branch below so the
// orchestrator chunk stays free of feature-player styles until a
// [data-video-player] element actually mounts.

export interface VideoPlayersOptions {
  prefersReducedMotion?: boolean;
}

function nativeHlsSupported(video: HTMLVideoElement): boolean {
  return video.canPlayType("application/vnd.apple.mpegurl") !== "";
}

// RFC-1175: the same capability contract as background-video.ts — an authored
// data-autoplay must not fetch/play stream bytes on constrained devices.
function mayAutoplay(prefersReducedMotion: boolean | undefined): boolean {
  if (prefersReducedMotion) return false;
  const connection =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData;
}

async function upgrade(video: HTMLVideoElement, options: VideoPlayersOptions = {}): Promise<void> {
  if (video.dataset.videoPlayerReady === "true") return;
  video.dataset.videoPlayerReady = "true";

  const hlsUrl = video.dataset.hls;
  const autoplay = video.dataset.autoplay === "true" && mayAutoplay(options.prefersReducedMotion);
  const controlsDisabled = video.dataset.controls === "false";
  let mode: "file" | "stream" = "file";
  let impl: "native" | "hlsjs" | "progressive" = "progressive";
  let hlsInstance: unknown = null;

  if (hlsUrl) {
    if (nativeHlsSupported(video)) {
      // Safari/iOS: native HLS — make the manifest the preferred source.
      const source = document.createElement("source");
      source.src = hlsUrl;
      source.type = "application/vnd.apple.mpegurl";
      video.insertBefore(source, video.firstChild);
      video.load();
      mode = "stream";
      impl = "native";
    } else {
      try {
        const { default: Hls } = await import("hls.js/light");
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hlsInstance = hls;
          mode = "stream";
          impl = "hlsjs";
        }
      } catch {
        /* hls.js unavailable — fall through to progressive MP4 sources */
      }
    }
  }

  video.dataset.playbackMode = mode;
  video.dataset.playbackImpl = impl;

  // Brand the UI with Plyr (the native controls remain the fallback if this fails).
  try {
    await import("plyr/dist/plyr.css");
    const { default: Plyr } = await import("plyr");
    const plyrControls = controlsDisabled
      ? ["mute"]
      : [
          "play-large",
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "captions",
          "fullscreen",
        ];
    const player = new Plyr(video, { controls: plyrControls });
    // Keep hls.js bound across Plyr's internal media swaps.
    void player;
    void hlsInstance;
  } catch {
    /* Plyr unavailable — native controls already present */
  }

  // RFC-0950: viewport play/pause for autoplay-enabled videos.
  if (autoplay) {
    await playWhenReady(
      video,
      hlsInstance as { on: (event: string, listener: () => void) => void } | null,
    );
    setupViewportObserver(video);
  }
}

async function playWhenReady(
  video: HTMLVideoElement,
  hls: { on: (event: string, listener: () => void) => void } | null,
): Promise<void> {
  if (hls) {
    // Wait for hls.js to attach media before calling play().
    await new Promise<void>((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 200);
      hls.on("hls.MEDIA_ATTACHED", () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }
  try {
    await video.play();
  } catch {
    /* Autoplay may be blocked by browser policy — user can interact via controls. */
  }
}

function setupViewportObserver(video: HTMLVideoElement): void {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    },
    { threshold: 0.5 },
  );
  observer.observe(video);
}

export async function initVideoPlayers(options: VideoPlayersOptions = {}): Promise<void> {
  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>("video[data-video-player]"),
  );
  if (videos.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    for (const v of videos) await upgrade(v, options);
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const video = entry.target as HTMLVideoElement;
        obs.unobserve(video);
        void upgrade(video, options);
      }
    },
    { rootMargin: "200px" },
  );
  for (const v of videos) observer.observe(v);
}
