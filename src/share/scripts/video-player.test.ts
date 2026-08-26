/*
<MODULE_CONTRACT>
<purpose>RFC-0950: tests for video-player runtime — conditional Plyr controls, viewport play/pause, HLS+autoplay timing.</purpose>
<keywords>RFC-0950, video-player, test</keywords>
</MODULE_CONTRACT>
<CHANGE_SUMMARY><item>RFC-0950: initial video-player tests.</item></CHANGE_SUMMARY>
*/

import { test, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("plyr", () => ({
  default: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("hls.js/light", () => {
  const hlsRef = { current: null as any };
  const fn = vi.fn(function Hls() {
    return hlsRef.current;
  });
  const Hls = Object.assign(fn, {
    isSupported: vi.fn(() => true),
    _hlsRef: hlsRef,
  });
  return { default: Hls };
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function createMockVideo(attrs: Record<string, string | undefined> = {}): any {
  const video: any = {
    dataset: {},
    canPlayType: vi.fn(() => ""),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    load: vi.fn(),
    insertBefore: vi.fn(),
    firstChild: null,
  };
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) video.dataset[k] = v;
  }
  return video;
}

let observerCallbacks: ((
  entries: { isIntersecting: boolean; target: any }[],
  obs: { unobserve: () => void },
) => void)[] = [];
let observerOptions: { threshold?: number; rootMargin?: string }[] = [];

class MockIntersectionObserver {
  callback: (
    entries: { isIntersecting: boolean; target: any }[],
    obs: { unobserve: () => void },
  ) => void;
  options: { threshold?: number; rootMargin?: string };
  constructor(
    cb: (
      entries: { isIntersecting: boolean; target: any }[],
      obs: { unobserve: () => void },
    ) => void,
    opts: { threshold?: number; rootMargin?: string },
  ) {
    this.callback = cb;
    this.options = opts;
    observerCallbacks.push(cb);
    observerOptions.push(opts);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// ── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  observerCallbacks = [];
  observerOptions = [];
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
  (globalThis as any).window = globalThis;
  (globalThis as any).document = {
    querySelectorAll: vi.fn(() => []),
    createElement: vi.fn((tag: string) => ({ tagName: tag.toUpperCase() })),
  };
});

afterEach(() => {
  delete (globalThis as any).IntersectionObserver;
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  vi.restoreAllMocks();
});

async function triggerUpgrade(video: any): Promise<void> {
  const { initVideoPlayers } = await import("../scripts/video-player.ts");
  vi.spyOn(globalThis.document as any, "querySelectorAll").mockReturnValue([video]);
  await initVideoPlayers();

  expect(observerCallbacks.length).toBeGreaterThanOrEqual(1);
  observerCallbacks[0]!([{ isIntersecting: true, target: video }], { unobserve: vi.fn() });
  await new Promise((r) => setTimeout(r, 100));
}

// ── Tests ───────────────────────────────────────────────────────────────────

test("initVideoPlayers: returns early when no [data-video-player] elements", async () => {
  const querySelectorAll = vi.spyOn(globalThis.document as any, "querySelectorAll");
  querySelectorAll.mockReturnValue([]);
  const { initVideoPlayers } = await import("../scripts/video-player.ts");
  await initVideoPlayers();
  expect(observerCallbacks.length).toBe(0);
  querySelectorAll.mockRestore();
});

test("upgrade: data-controls='false' configures Plyr with only ['mute']", async () => {
  const video = createMockVideo({ controls: "false" });
  await triggerUpgrade(video);

  const Plyr = (await import("plyr")).default;
  expect(Plyr).toHaveBeenCalledWith(video, expect.objectContaining({ controls: ["mute"] }));
});

test("upgrade: without data-controls uses full Plyr controls list", async () => {
  const video = createMockVideo({});
  await triggerUpgrade(video);

  const Plyr = (await import("plyr")).default;
  expect(Plyr).toHaveBeenCalledWith(
    video,
    expect.objectContaining({
      controls: expect.arrayContaining([
        "play-large",
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "captions",
        "fullscreen",
      ]),
    }),
  );
});

test("upgrade: data-autoplay='true' sets up viewport play/pause observer with threshold 0.5", async () => {
  const video = createMockVideo({ autoplay: "true" });
  await triggerUpgrade(video);

  const playPauseOpts = observerOptions.find((o) => o.threshold === 0.5);
  expect(
    playPauseOpts,
    "play/pause observer with threshold 0.5 must be created when data-autoplay is true",
  ).toBeDefined();
});

test("upgrade: data-autoplay='true' with HLS waits for MEDIA_ATTACHED before play()", async () => {
  const video = createMockVideo({ autoplay: "true", hls: "https://example.com/stream.m3u8" });

  const hlsInstance = {
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
  };
  const Hls = (await import("hls.js/light")).default as any;
  Hls._hlsRef.current = hlsInstance;

  await triggerUpgrade(video);

  expect(Hls).toHaveBeenCalled();
  expect(hlsInstance.attachMedia).toHaveBeenCalledWith(video);

  const attachedCall = hlsInstance.on.mock.calls.find((c: any[]) => c[0] === "hls.MEDIA_ATTACHED");
  expect(attachedCall, "Hls must register a MEDIA_ATTACHED listener before play()").toBeDefined();
  attachedCall![1]();

  await new Promise((r) => setTimeout(r, 20));
  expect(video.play).toHaveBeenCalled();
});

test("upgrade: data-autoplay='true' without HLS calls play() directly", async () => {
  const video = createMockVideo({ autoplay: "true" });
  await triggerUpgrade(video);

  expect(video.play).toHaveBeenCalled();
});

test("upgrade: skip already-upgraded videos (data-video-player-ready='true')", async () => {
  const video = createMockVideo({ videoPlayerReady: "true" });
  await triggerUpgrade(video);

  const Plyr = (await import("plyr")).default;
  expect(Plyr).not.toHaveBeenCalled();
});

test("upgrade: viewport observer pauses video when scrolled out", async () => {
  const video = createMockVideo({ autoplay: "true" });
  await triggerUpgrade(video);

  const playPauseIdx = observerOptions.findIndex((o) => o.threshold === 0.5);
  expect(playPauseIdx).toBeGreaterThan(-1);

  observerCallbacks[playPauseIdx]!([{ isIntersecting: false, target: video }], {
    unobserve: vi.fn(),
  });
  expect(video.pause).toHaveBeenCalled();
});
