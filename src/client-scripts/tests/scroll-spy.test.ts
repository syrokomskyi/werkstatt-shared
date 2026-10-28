/*
<MODULE_CONTRACT>
<purpose>
Unit tests for scroll spy covering initScrollSpy. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1419: added first-section exemption cases — main-scoped exempt element, pre-main overlay, single-section page, id-less/modal exclusion, document-order fallback; mock closest() now tracks main ancestry.</item>
  <item>RFC-1311: Compass header sweep — declares the scroll suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initScrollSpy } from "../scroll-spy.ts";

interface MockRect {
  top: number;
}
interface MockElement {
  id: string;
  closest: (sel: string) => object | null;
  getBoundingClientRect: () => MockRect;
}
interface MockEntry {
  target: MockElement;
  isIntersecting: boolean;
  boundingClientRect: MockRect;
}
interface MockObserverInstance {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  takeRecords: ReturnType<typeof vi.fn>;
}
interface MockDocument {
  body: { innerHTML: string };
  readyState: string;
  querySelector: ReturnType<typeof vi.fn>;
  querySelectorAll: ReturnType<typeof vi.fn>;
  getElementById: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

let observerCallbacks: Array<(entries: MockEntry[]) => void>;
let observerInstances: MockObserverInstance[];
let mockHistory: { replaceState: ReturnType<typeof vi.fn> };
let mockDocument: MockDocument;
let sectionCache: Map<string, MockElement>;

function parseSections(html: string, selector: string): MockElement[] {
  if (selector !== "section[id]") return [];
  const sections: MockElement[] = [];
  const sectionRegex = /<section\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/gi;
  let match;
  while ((match = sectionRegex.exec(html)) !== null) {
    const modalBefore = html.substring(0, match.index);
    const lastModalOpen = modalBefore.lastIndexOf('class="wl-modal"');
    const lastModalClose = modalBefore.lastIndexOf("</div>");
    const inModal = lastModalOpen > lastModalClose;
    const lastMainOpen = modalBefore.lastIndexOf("<main");
    const lastMainClose = modalBefore.lastIndexOf("</main>");
    const inMain = lastMainOpen > lastMainClose;
    const el = {
      id: match[1],
      closest: (sel: string) => {
        if (sel === ".wl-modal") return inModal ? {} : null;
        if (sel === "main") return inMain ? {} : null;
        return null;
      },
      getBoundingClientRect: () => ({ top: 0 }),
    };
    sectionCache.set(match[1], el);
    sections.push(el);
  }
  return sections;
}

describe("initScrollSpy", () => {
  beforeEach(() => {
    observerCallbacks = [];
    observerInstances = [];
    sectionCache = new Map();

    class MockIntersectionObserver {
      constructor(cb: (entries: MockEntry[]) => void) {
        observerCallbacks.push(cb);
        const instance = {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
          takeRecords: vi.fn(() => []),
        };
        observerInstances.push(instance);
        return instance;
      }
    }

    mockHistory = { replaceState: vi.fn() };
    mockDocument = {
      body: { innerHTML: "" },
      readyState: "complete",
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn((selector: string) => {
        return parseSections(mockDocument.body.innerHTML, selector);
      }),
      getElementById: vi.fn((id: string) => sectionCache.get(id) ?? null),
      addEventListener: vi.fn(),
    };

    vi.stubGlobal("window", {
      IntersectionObserver: MockIntersectionObserver,
      addEventListener: vi.fn(),
    });
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("history", mockHistory);
    vi.stubGlobal("location", {
      pathname: "/page",
      search: "",
      hash: "",
    });
    vi.stubGlobal("document", mockDocument);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-1: updates URL hash via history.replaceState when a section is in view", () => {
    mockDocument.body.innerHTML =
      '<section id="hero">Hero</section><section id="approach">Content</section>';
    const cleanup = initScrollSpy();
    const section = sectionCache.get("approach")!;

    observerCallbacks[0]([
      {
        target: section,
        isIntersecting: true,
        boundingClientRect: { top: 100 },
      },
    ]);

    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "#approach");
    cleanup();
  });

  it("AC-2: clears URL hash when scrolled above the first section", () => {
    mockDocument.body.innerHTML =
      '<section id="hero">Hero</section><section id="details">Details</section>';
    const cleanup = initScrollSpy();
    const details = sectionCache.get("details")!;

    observerCallbacks[0]([
      {
        target: details,
        isIntersecting: true,
        boundingClientRect: { top: 100 },
      },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "#details");

    observerCallbacks[0]([
      {
        target: details,
        isIntersecting: false,
        boundingClientRect: { top: 500 },
      },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "/page");

    cleanup();
  });

  it("keeps a clean URL while the first section is in view", () => {
    mockDocument.body.innerHTML =
      '<section id="hero">Hero</section><section id="details">Details</section>';
    const cleanup = initScrollSpy();
    const hero = sectionCache.get("hero")!;
    const details = sectionCache.get("details")!;

    observerCallbacks[0]([
      {
        target: hero,
        isIntersecting: true,
        boundingClientRect: { top: 0 },
      },
    ]);
    expect(mockHistory.replaceState).not.toHaveBeenCalled();

    observerCallbacks[0]([
      {
        target: details,
        isIntersecting: true,
        boundingClientRect: { top: 50 },
      },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "#details");

    observerCallbacks[0]([
      {
        target: hero,
        isIntersecting: true,
        boundingClientRect: { top: 0 },
      },
      {
        target: details,
        isIntersecting: false,
        boundingClientRect: { top: 800 },
      },
    ]);
    expect(mockHistory.replaceState).toHaveBeenLastCalledWith(null, "", "/page");
    expect(mockHistory.replaceState).not.toHaveBeenCalledWith(null, "", "#hero");

    cleanup();
  });

  it("AC-3: returns a cleanup callback that disconnects the observer", () => {
    mockDocument.body.innerHTML = '<section id="test">Test</section>';
    const cleanup = initScrollSpy();

    expect(typeof cleanup).toBe("function");
    cleanup();

    expect(observerInstances[0].disconnect).toHaveBeenCalled();
  });

  it("AC-4: returns immediately without creating an observer when no section[id] elements exist", () => {
    mockDocument.body.innerHTML = "<div>No sections here</div>";
    const cleanup = initScrollSpy();

    expect(observerInstances.length).toBe(0);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("AC-5: returns silently without throwing when IntersectionObserver is not supported", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    vi.stubGlobal("history", mockHistory);
    vi.stubGlobal("location", { pathname: "/page", search: "", hash: "" });
    vi.stubGlobal("document", mockDocument);
    mockDocument.body.innerHTML = '<section id="test">Test</section>';
    sectionCache.clear();

    expect(() => initScrollSpy()).not.toThrow();
  });

  it("AC-9: is idempotent — calling twice disconnects the first observer before creating a new one", () => {
    mockDocument.body.innerHTML = '<section id="a">A</section><section id="b">B</section>';
    initScrollSpy();
    expect(observerInstances.length).toBe(1);

    initScrollSpy();
    expect(observerInstances.length).toBe(2);
    expect(observerInstances[0].disconnect).toHaveBeenCalled();
  });

  it("excludes sections inside .wl-modal elements", () => {
    mockDocument.body.innerHTML =
      '<div class="wl-modal"><section id="modal-section">Modal</section></div>' +
      '<section id="page-section">Page</section>';

    initScrollSpy();

    expect(observerInstances.length).toBe(1);
    expect(observerInstances[0].observe).toHaveBeenCalledTimes(1);
    expect(observerInstances[0].observe).toHaveBeenCalledWith(sectionCache.get("page-section"));
  });

  it("RFC-1419 AC-1/AC-2: exempts the first section[id] inside <main> regardless of slug", () => {
    mockDocument.body.innerHTML =
      '<main id="main-content"><section id="about-company">About</section>' +
      '<section id="faq-about">Faq</section></main>';
    const cleanup = initScrollSpy();
    const about = sectionCache.get("about-company")!;
    const faq = sectionCache.get("faq-about")!;

    observerCallbacks[0]([
      { target: about, isIntersecting: true, boundingClientRect: { top: 0 } },
    ]);
    expect(mockHistory.replaceState).not.toHaveBeenCalledWith(null, "", "#about-company");

    observerCallbacks[0]([
      { target: faq, isIntersecting: true, boundingClientRect: { top: 50 } },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "#faq-about");

    observerCallbacks[0]([
      { target: about, isIntersecting: true, boundingClientRect: { top: 0 } },
      { target: faq, isIntersecting: false, boundingClientRect: { top: 800 } },
    ]);
    expect(mockHistory.replaceState).toHaveBeenLastCalledWith(null, "", "/page");
    cleanup();
  });

  it("RFC-1419 AC-3: a section[id] before <main> does not steal the exemption", () => {
    mockDocument.body.innerHTML =
      '<section id="overlay-search">Overlay</section>' +
      '<main id="main-content"><section id="about">About</section>' +
      '<section id="faq">Faq</section></main>';
    const cleanup = initScrollSpy();
    const about = sectionCache.get("about")!;
    const faq = sectionCache.get("faq")!;

    observerCallbacks[0]([
      { target: about, isIntersecting: true, boundingClientRect: { top: 0 } },
    ]);
    expect(mockHistory.replaceState).not.toHaveBeenCalledWith(null, "", "#about");

    observerCallbacks[0]([
      { target: faq, isIntersecting: true, boundingClientRect: { top: 50 } },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "#faq");
    cleanup();
  });

  it("RFC-1419 AC-4: a single-section page never writes a fragment", () => {
    mockDocument.body.innerHTML =
      '<main id="main-content"><section id="privacy">Privacy</section></main>';
    const cleanup = initScrollSpy();
    const privacy = sectionCache.get("privacy")!;

    observerCallbacks[0]([
      { target: privacy, isIntersecting: true, boundingClientRect: { top: 0 } },
    ]);
    expect(mockHistory.replaceState).not.toHaveBeenCalledWith(null, "", "#privacy");
    cleanup();
  });

  it("RFC-1419 AC-5: id-less and .wl-modal sections do not count toward the exempt element", () => {
    mockDocument.body.innerHTML =
      '<main id="main-content">' +
      '<section class="breadcrumbs-section">Crumbs</section>' +
      '<div class="wl-modal"><section id="modal-first">Modal</section></div>' +
      '<section id="intro">Intro</section><section id="lines">Lines</section></main>';
    const cleanup = initScrollSpy();
    const intro = sectionCache.get("intro")!;
    const lines = sectionCache.get("lines")!;

    observerCallbacks[0]([
      { target: intro, isIntersecting: true, boundingClientRect: { top: 0 } },
    ]);
    expect(mockHistory.replaceState).not.toHaveBeenCalledWith(null, "", "#intro");

    observerCallbacks[0]([
      { target: lines, isIntersecting: true, boundingClientRect: { top: 50 } },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "#lines");
    cleanup();
  });

  it("RFC-1419 AC-2 fallback: without <main>, document order decides the exempt element", () => {
    mockDocument.body.innerHTML =
      '<section id="first">First</section><section id="second">Second</section>';
    const cleanup = initScrollSpy();
    const first = sectionCache.get("first")!;
    const second = sectionCache.get("second")!;

    observerCallbacks[0]([
      { target: first, isIntersecting: true, boundingClientRect: { top: 0 } },
    ]);
    expect(mockHistory.replaceState).not.toHaveBeenCalledWith(null, "", "#first");

    observerCallbacks[0]([
      { target: second, isIntersecting: true, boundingClientRect: { top: 50 } },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "#second");
    cleanup();
  });
});
