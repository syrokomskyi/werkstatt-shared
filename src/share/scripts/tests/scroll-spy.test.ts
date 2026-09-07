import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initScrollSpy } from "../scroll-spy.ts";

describe("initScrollSpy", () => {
  let observerCallbacks: Array<(entries: any[]) => void>;
  let observerInstances: any[];
  let mockHistory: { replaceState: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    observerCallbacks = [];
    observerInstances = [];

    const MockObserver = vi.fn().mockImplementation((cb: any) => {
      observerCallbacks.push(cb);
      const instance = {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        takeRecords: vi.fn(() => []),
      };
      observerInstances.push(instance);
      return instance;
    });

    vi.stubGlobal("IntersectionObserver", MockObserver);

    mockHistory = { replaceState: vi.fn() };
    vi.stubGlobal("history", mockHistory);
    vi.stubGlobal("location", {
      pathname: "/page",
      search: "",
      hash: "",
    });

    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("AC-1: updates URL hash via history.replaceState when a section is in view", () => {
    document.body.innerHTML = '<section id="approach">Content</section>';
    const cleanup = initScrollSpy();
    const section = document.getElementById("approach")!;

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
    document.body.innerHTML = '<section id="hero">Hero</section>';
    const cleanup = initScrollSpy();
    const section = document.getElementById("hero")!;

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
    document.body.innerHTML = '<section id="test">Test</section>';
    const cleanup = initScrollSpy();

    expect(typeof cleanup).toBe("function");
    cleanup();

    expect(observerInstances[0].disconnect).toHaveBeenCalled();
  });

  it("AC-4: returns immediately without creating an observer when no section[id] elements exist", () => {
    document.body.innerHTML = '<div>No sections here</div>';
    const cleanup = initScrollSpy();

    expect(observerInstances.length).toBe(0);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("AC-5: returns silently without throwing when IntersectionObserver is not supported", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("history", mockHistory);
    vi.stubGlobal("location", { pathname: "/page", search: "", hash: "" });

    document.body.innerHTML = '<section id="test">Test</section>';

    expect(() => initScrollSpy()).not.toThrow();
  });

  it("AC-9: is idempotent — calling twice disconnects the first observer before creating a new one", () => {
    document.body.innerHTML = '<section id="a">A</section><section id="b">B</section>';
    initScrollSpy();
    expect(observerInstances.length).toBe(1);

    initScrollSpy();
    expect(observerInstances.length).toBe(2);
    expect(observerInstances[0].disconnect).toHaveBeenCalled();
  });

  it("excludes sections inside .wl-modal elements", () => {
    document.body.innerHTML =
      '<div class="wl-modal"><section id="modal-section">Modal</section></div>' +
      '<section id="page-section">Page</section>';

    initScrollSpy();

    expect(observerInstances.length).toBe(1);
    expect(observerInstances[0].observe).toHaveBeenCalledTimes(1);
    expect(observerInstances[0].observe).toHaveBeenCalledWith(
      document.getElementById("page-section"),
    );
  });
});
