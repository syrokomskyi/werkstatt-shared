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
    const el = {
      id: match[1],
      closest: (sel: string) => (sel === ".wl-modal" && inModal ? {} : null),
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
    mockDocument.body.innerHTML = '<section id="approach">Content</section>';
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
    mockDocument.body.innerHTML = '<section id="hero">Hero</section>';
    const cleanup = initScrollSpy();
    const section = sectionCache.get("hero")!;

    observerCallbacks[0]([
      {
        target: section,
        isIntersecting: true,
        boundingClientRect: { top: 100 },
      },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "#hero");

    observerCallbacks[0]([
      {
        target: section,
        isIntersecting: false,
        boundingClientRect: { top: 500 },
      },
    ]);
    expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "/page");

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
});
