/*
<MODULE_CONTRACT>
<purpose>Kernel helper that runs a mutation only when a declared mutatingFlag is truthy — the ratchet-recognized guard form for flag-gated writes under mutatesState: false (RFC-1303).</purpose>
<non-goals>
  <item>Do not read argv or flags directly — the caller passes ctx so the flag resolves from input.flags.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>runMutating(ctx, "flag", fn) is the canonical flag-gated mutation guard — the registry-integrity ratchet recognizes writes inside its callback as guarded.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1303: initial — runMutating helper for flag-gated writes under mutatesState: false.</item>
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
