/*
<MODULE_CONTRACT>
<purpose>RFC-0950: tests for video-player runtime — conditional Plyr controls, viewport play/pause, HLS+autoplay timing.</purpose>
<keywords>RFC-0950, video-player, test</keywords>
</MODULE_CONTRACT>
<CHANGE_SUMMARY><item>RFC-0950: initial video-player tests.</item></CHANGE_SUMMARY>
*/

import { test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// ── Mock types ──────────────────────────────────────────────────────────────

interface MockVideo {
  dataset: Record<string, string>;
  canPlayType: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  insertBefore: ReturnType<typeof vi.fn>;
  firstChild: null;
}
interface MockHlsInstance {
  loadSource: ReturnType<typeof vi.fn>;
  attachMedia: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  on: Mock<(event: string, cb: () => void) => void>;
}
interface MockEntry {
  isIntersecting: boolean;
  target: MockVideo;
}
interface MockObserver {
  unobserve: () => void;
}
interface MockDocument {
  querySelectorAll: ReturnType<typeof vi.fn>;
  createElement: ReturnType<typeof vi.fn>;
}

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("plyr", () => ({
  default: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("hls.js/light", () => {
  const hlsRef = { current: null as MockHlsInstance | null };
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

function createMockVideo(attrs: Record<string, string | undefined> = {}): MockVideo {
  const video: MockVideo = {
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

let observerCallbacks: ((entries: MockEntry[], obs: MockObserver) => void)[] = [];
let observerOptions: { threshold?: number; rootMargin?: string }[] = [];
let mockDocument: MockDocument;

class MockIntersectionObserver {
  callback: (entries: MockEntry[], obs: MockObserver) => void;
  options: { threshold?: number; rootMargin?: string };
  constructor(
    cb: (entries: MockEntry[], obs: MockObserver) => void,
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
  mockDocument = {
    querySelectorAll: vi.fn(() => []),
    createElement: vi.fn((tag: string) => ({ tagName: tag.toUpperCase() })),
  };
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("document", mockDocument);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function triggerUpgrade(video: MockVideo): Promise<void> {
  const { initVideoPlayers } = await import("../video-player.ts");
  mockDocument.querySelectorAll.mockReturnValue([video]);
  await initVideoPlayers();

  expect(observerCallbacks.length).toBeGreaterThanOrEqual(1);
  observerCallbacks[0]!([{ isIntersecting: true, target: video }], { unobserve: vi.fn() });
  await new Promise((r) => setTimeout(r, 100));
}

// ── Tests ───────────────────────────────────────────────────────────────────

test("initVideoPlayers: returns early when no [data-video-player] elements", async () => {
  mockDocument.querySelectorAll.mockReturnValue([]);
  const { initVideoPlayers } = await import("../video-player.ts");
  await initVideoPlayers();
  expect(observerCallbacks.length).toBe(0);
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
  const Hls = (await import("hls.js/light")).default as unknown as {
    _hlsRef: { current: MockHlsInstance | null };
  };
  Hls._hlsRef.current = hlsInstance;

  await triggerUpgrade(video);

  expect(Hls).toHaveBeenCalled();
  expect(hlsInstance.attachMedia).toHaveBeenCalledWith(video);

  const attachedCall = hlsInstance.on.mock.calls.find((c) => c[0] === "hls.MEDIA_ATTACHED");
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
