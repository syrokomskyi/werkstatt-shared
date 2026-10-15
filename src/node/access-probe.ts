/*
<MODULE_CONTRACT>
<purpose>RFC-1284: unauthenticated live probe for access protection — fetches a
channel URL anonymously and reports the observed HTTP status. Consumed by
sternsystem.validate ACCESS-01 (expected-401 check); leitstand.verify may reuse
it for the same check.</purpose>

<non-goals>
  <item>Does not authenticate — the probe must observe the anonymous answer;
    a 401 is the pass signal.</item>
  <item>Does not retry or follow redirects — one GET, redirect: "manual".</item>
  <item>Does not distinguish channel health — only "does the edge demand auth".</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1284: initial — shared probe for ACCESS-01 desired-state reconciliation.</item>
  <history>RFC-1284</history>
</CHANGE_SUMMARY>
*/

export interface AccessProbeResult {
  /** "status" when the edge answered; "transport-error" on network failure/timeout. */
  outcome: "status" | "transport-error";
  /** HTTP status observed (present iff outcome === "status"). */
  status?: number;
  /** Error detail (present iff outcome === "transport-error"). */
  error?: string;
}

export const ACCESS_PROBE_DEFAULT_TIMEOUT_MS = 5000;

/**
 * Fetch `url` anonymously and report the edge answer. Transport failures and
 * timeouts return `transport-error` — never throw — so callers can downgrade
 * inconclusive probes to warnings instead of violations.
 */
export async function probeAccessProtection(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<AccessProbeResult> {
  const { timeoutMs = ACCESS_PROBE_DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = opts;
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Drain the body so the socket can be reused; ignore drain errors.
    try {
      await res.arrayBuffer();
    } catch {
      // body unreadable — status is still the answer
    }
    return { outcome: "status", status: res.status };
  } catch (err) {
    return {
      outcome: "transport-error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
