/*
<MODULE_CONTRACT>
<purpose>
Implements run mutating exposing RunMutatingResult, runMutating for the workspace package surface.
</purpose>
<non-goals>
  <item>Do not read argv directly — the caller passes input so the flag resolves from input.flags.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>runMutating(input, "flag", fn) is the canonical flag-gated mutation guard — the registry-integrity ratchet recognizes writes inside its callback as guarded.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1303: initial — runMutating helper for flag-gated writes under mutatesState: false.</item>
  <item>RFC-1303: review REVIEW-CODE-2026-10-16-02 — scanner moves to werkstatt-shared/node (IO-01), workpieceEnv hashes into envDigest, saveCache tolerates KERNEL-META-01, ENV-INPUT-02 coverage notice, ratchet path-arg tightening</item>
</CHANGE_SUMMARY>
*/

import type { KernelCommandInput } from "./types.ts";

export interface RunMutatingResult<T> {
  ran: boolean;
  result: T | undefined;
}

/**
 * RFC-1303: execute `fn` only when `input.flags[flag]` is truthy — the
 * ratchet-recognized guard for flag-gated writes under `mutatesState: false`
 * commands (declared in `mutatingFlags`). Returns `{ ran: false }` when the
 * flag is unset/false so callers can report a skipped mode honestly.
 */
export async function runMutating<T>(
  input: KernelCommandInput,
  flag: string,
  fn: () => Promise<T> | T,
): Promise<RunMutatingResult<T>> {
  if (!input.flags[flag]) return { ran: false, result: undefined };
  return { ran: true, result: await fn() };
}
