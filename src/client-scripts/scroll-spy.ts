/*
<MODULE_CONTRACT>
<purpose>scroll-spy — watches section elements via IntersectionObserver and updates the URL hash via history.replaceState as the user scrolls (RFC-1061).</purpose>
<singleton-state>
  <item>Module-level `activeObserver` and `activeCleanup` enforce single-instance idempotency (AC-9). Calling `initScrollSpy` twice disconnects the previous observer before creating a new one.</item>
</singleton-state>
<non-goals>
  <item>Do not add navigation highlight UI — that is a separate concern.</item>
  <item>Do not use pushState — replaceState only to avoid history pollution.</item>
  <item>Do not modify section rendering or section id resolution.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1061: Created scroll-spy script with IntersectionObserver-based section tracking and URL hash updates.</item>
  <item>RFC-1097: sweep — tail packages clean

Sweep batch 3: rewrote ~95 purposes across werkstatt-knowledge, werkstatt-shared, godot-game, phaser-game, lifecycle-core, projektarchiv-*, portal-*, billing-*, typescript (CONTRACT-02/PURPOSE-02). Real KEY_DECISIONS on 5 godot utils, non-goals on 5 CONTRACT-03 files, headers on 4 headerless files, CS-07 history literal fix on 2 files. Policy: vitest.config.ts + test-fixtures testPatterns, worker-configuration.d.ts excludedPath. All non-site/engine packages now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

export interface ScrollSpyOptions {
  /** CSS selector for elements to observe. Default: "section[id]" */
  selector?: string;
  /** IntersectionObserver rootMargin. Default: "-20% 0px -80% 0px" */
  rootMargin?: string;
  /** IntersectionObserver threshold. Default: 0 */
  threshold?: number;
  /** Whether to clear the hash when scrolled above the first section. Default: true */
  clearAtTop?: boolean;
}

let activeObserver: IntersectionObserver | null = null;
let activeCleanup: (() => void) | null = null;

export function initScrollSpy(options?: ScrollSpyOptions): () => void {
  const {
    selector = "section[id]",
    rootMargin = "-20% 0px -80% 0px",
    threshold = 0,
    clearAtTop = true,
  } = options ?? {};

  if (activeCleanup) {
    activeCleanup();
    activeObserver = null;
    activeCleanup = null;
  }

  if (!("IntersectionObserver" in window)) {
    return () => {};
  }

  const sections = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.closest(".wl-modal"),
  );

  if (sections.length === 0) {
    return () => {};
  }

  let currentId: string | null = null;

  const updateHash = (id: string | null) => {
    if (id === currentId) return;
    currentId = id;
    if (id) {
      history.replaceState(null, "", `#${id}`);
    } else if (clearAtTop) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      let topmostVisible: HTMLElement | null = null;
      let topmostTop = Infinity;

      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const rect = el.getBoundingClientRect();
        if (rect.top < topmostTop) {
          topmostTop = rect.top;
          topmostVisible = el;
        }
      }

      if (topmostVisible) {
        updateHash(topmostVisible.id);
      } else if (clearAtTop) {
        updateHash(null);
      }
    },
    { rootMargin, threshold },
  );

  for (const section of sections) {
    observer.observe(section);
  }

  activeObserver = observer;

  const cleanup = () => {
    observer.disconnect();
    activeObserver = null;
    activeCleanup = null;
  };

  activeCleanup = cleanup;
  return cleanup;
}
