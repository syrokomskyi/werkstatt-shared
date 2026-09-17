/***************************************************************
<MODULE_CONTRACT>
<purpose>Facilitates task scheduling and processing in a non-blocking manner, optimizing idle time for execution.</purpose>
<non-goals>
  <item>Do not handle task prioritization or dependencies between tasks.</item>
  <item>Do not parse raw content or manage data fetching here.</item>
  <item>Do not own transport or configuration orchestration for tasks.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
***************************************************************/

// @ai-invariant: This is a high-risk module. Preserve its core logic and minimize external side effects during modification.
// --- Scheduler Start ---
type Task = () => Promise<void> | void;

const taskQueue: Task[] = [];
let isTaskRunnerScheduled = false;
function processTasks(deadline?: { timeRemaining: () => number; didTimeout: boolean }) {
  isTaskRunnerScheduled = false;

  // If no deadline (setTimeout fallback), simulate a budget
  const timeRemaining = deadline ? () => deadline.timeRemaining() : () => 16;

  while (taskQueue.length > 0 && (timeRemaining() > 1 || (deadline?.didTimeout ?? false))) {
    const task = taskQueue.shift();
    if (task) {
      void task();
    }
  }

  if (taskQueue.length > 0) {
    isTaskRunnerScheduled = true;
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(processTasks, { timeout: 1000 });
    } else {
      setTimeout(processTasks, 50);
    }
  }
}
export function scheduleTask(task: Task) {
  taskQueue.push(task);
  if (!isTaskRunnerScheduled) {
    isTaskRunnerScheduled = true;
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(processTasks, { timeout: 1000 });
    } else {
      setTimeout(processTasks, 50);
    }
  }
} // --- Scheduler End ---
