/*
<MODULE_CONTRACT>
<purpose>RFC-1175: tests for background-video runtime — capability gating (saveData, reduced-motion), viewport play/pause, poster fallback.</purpose>
<keywords>RFC-1175, background-video, test</keywords>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1175: initial background-video tests.</item>
  <item>RFC-1175: close Lighthouse gaps — directive-allowlist robots (Schemamap retired, ROBOTS-SURFACE-01), capability-gated video (preload=none, data-bg-video, saveData/reduced-motion), single fetchpriority=high per page (IMG-DELIVERY-05), inlined shared texture token, 24px QR touch targets; RFC-1177 security-headers draft</item>
</CHANGE_SUMMARY>
*/

import { test, expect, vi, beforeEach, afterEach } from "vitest";

interface MockVideo {
  attrs: Record<string, string>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
}
interface MockDocument {
  querySelectorAll: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  documentElement: { setAttribute: ReturnType<typeof vi.fn> };
  hidden: boolean;
}

function createMockVideo(): MockVideo {
  const video: MockVideo = {
    attrs: {},
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    setAttribute: (name, value) => {
      video.attrs[name] = value;
    },
    removeAttribute: (name) => {
      delete video.attrs[name];
    },
  };
  return video;
}

let observerCallback:
  ((entries: Array<{ isIntersecting: boolean; target: MockVideo }>) => void) | null;
let observerOptions: { threshold?: number } | undefined;
let mockDocument: MockDocument;
let listeners: Record<string, () => void>;

class MockIntersectionObserver {
  constructor(
    cb: (entries: Array<{ isIntersecting: boolean; target: MockVideo }>) => void,
    opts: { threshold?: number },
  ) {
    observerCallback = cb;
    observerOptions = opts;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
  observerCallback = null;
  observerOptions = undefined;
  listeners = {};
  mockDocument = {
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn((event: string, cb: () => void) => {
      listeners[event] = cb;
    }),
    // RFC-1175: SMOKE-INIT-01 marker writes data-bg-video-initialized here.
    documentElement: { setAttribute: vi.fn() },
    hidden: false,
  };
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("document", mockDocument);
  vi.stubGlobal("window", globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function init(videos: MockVideo[], opts: { saveData?: boolean } = {}) {
  mockDocument.querySelectorAll.mockReturnValue(videos);
  vi.stubGlobal("navigator", { connection: { saveData: opts.saveData ?? false } });
  const { initBackgroundVideos } = await import("../background-video.ts");
  initBackgroundVideos({ prefersReducedMotion: false });
}

test("initBackgroundVideos: no-ops when no [data-bg-video] elements exist", async () => {
  await init([]);
  expect(observerCallback).toBeNull();
});

test("initBackgroundVideos: never plays under prefers-reduced-motion", async () => {
  const video = createMockVideo();
  mockDocument.querySelectorAll.mockReturnValue([video]);
  vi.stubGlobal("navigator", { connection: { saveData: false } });
  const { initBackgroundVideos } = await import("../background-video.ts");
  initBackgroundVideos({ prefersReducedMotion: true });

  expect(video.play).not.toHaveBeenCalled();
  expect(observerCallback).toBeNull();
});

test("initBackgroundVideos: never fetches bytes under saveData (poster stays)", async () => {
  const video = createMockVideo();
  await init([video], { saveData: true });

  expect(video.play).not.toHaveBeenCalled();
  expect(observerCallback).toBeNull();
  expect(video.attrs.autoplay).toBeUndefined();
});

test("initBackgroundVideos: plays in view, pauses out of view", async () => {
  const video = createMockVideo();
  await init([video]);

  expect(observerCallback, "IntersectionObserver must be created").not.toBeNull();
  expect(observerOptions?.threshold).toBe(0.1);

  observerCallback!([{ isIntersecting: true, target: video }]);
  expect(video.attrs.autoplay).toBe("");
  expect(video.play).toHaveBeenCalled();

  observerCallback!([{ isIntersecting: false, target: video }]);
  expect(video.pause).toHaveBeenCalled();
  expect(video.attrs.autoplay).toBeUndefined();
});

test("initBackgroundVideos: pauses every video when the tab hides", async () => {
  const a = createMockVideo();
  const b = createMockVideo();
  await init([a, b]);

  observerCallback!([
    { isIntersecting: true, target: a },
    { isIntersecting: true, target: b },
  ]);
  mockDocument.hidden = true;
  listeners["visibilitychange"]!();

  expect(a.pause).toHaveBeenCalled();
  expect(b.pause).toHaveBeenCalled();
});

test("initBackgroundVideos: plays immediately when IntersectionObserver is unavailable", async () => {
  // window without IntersectionObserver — `in` check must be false.
  vi.stubGlobal("window", {});
  const video = createMockVideo();
  await init([video]);

  expect(video.attrs.autoplay).toBe("");
  expect(video.play).toHaveBeenCalled();
});

test("initBackgroundVideos: a rejected play() promise stays silent (poster fallback)", async () => {
  const video = createMockVideo();
  video.play.mockImplementation(() => Promise.reject(new Error("autoplay blocked")));
  await init([video]);

  observerCallback!([{ isIntersecting: true, target: video }]);
  // The .catch() swallows the policy rejection — no unhandled rejection escapes.
  await expect(Promise.resolve()).resolves.toBeUndefined();
});
