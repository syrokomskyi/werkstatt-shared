import { describe, expect, it } from "vitest";
import { runMutating } from "../run-mutating.ts";
import type { KernelCommandInput } from "../types.ts";

/*
<MODULE_CONTRACT>
<purpose>
  RFC-1303: runMutating(input, flag, fn) — the ratchet-recognized guard for
  flag-gated writes under mutatesState: false commands.
</purpose>
</MODULE_CONTRACT>
*/

const input = (flags: Record<string, unknown>): KernelCommandInput =>
  ({ flags }) as unknown as KernelCommandInput;

describe("runMutating (RFC-1303)", () => {
  it("runs fn only when the flag is truthy", async () => {
    let ran = 0;
    const off = await runMutating(input({ "write-baseline": false }), "write-baseline", async () => {
      ran++;
      return "x";
    });
    expect(off).toEqual({ ran: false, result: undefined });
    expect(ran).toBe(0);

    const on = await runMutating(input({ "write-baseline": true }), "write-baseline", async () => {
      ran++;
      return "x";
    });
    expect(on).toEqual({ ran: true, result: "x" });
    expect(ran).toBe(1);
  });

  it("treats a missing flag as unset", async () => {
    const res = await runMutating(input({}), "auto-accept", () => 1);
    expect(res.ran).toBe(false);
    expect(res.result).toBeUndefined();
  });

  it("propagates fn's return value and errors", async () => {
    const res = await runMutating(input({ apply: 1 }), "apply", () => 42);
    expect(res).toEqual({ ran: true, result: 42 });
    await expect(
      runMutating(input({ apply: true }), "apply", () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
