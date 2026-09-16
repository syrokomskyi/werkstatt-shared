/*
<MODULE_CONTRACT>
<purpose>
  OTLP transport port — abstracts the HTTP POST delivery of OTLP JSON.
  Extracted from pusher.ts so the transport can be mocked in tests
  without touching the network.
</purpose>
<non-goals>
  <item>Do not accumulate or convert metrics — that stays in pusher.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

export interface OtlpTransport {
  send(body: string, signal?: AbortSignal): Promise<{ delivered: boolean; reason?: string }>;
}

export interface OtlpHttpTransportOptions {
  endpoint: string;
  token: string;
  timeoutMs?: number;
}

export function createOtlpHttpTransport(options: OtlpHttpTransportOptions): OtlpTransport {
  const url = `${options.endpoint.replace(/\/$/, "")}/v1/metrics`;
  const timeoutMs = options.timeoutMs ?? 2000;

  return {
    async send(body, signal) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        // If caller provided a signal, link it
        if (signal) {
          signal.addEventListener("abort", () => controller.abort(), { once: true });
        }

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${options.token}`,
            },
            body,
            signal: controller.signal,
          });
          if (!response.ok) {
            return {
              delivered: false,
              reason: `HTTP ${response.status} ${response.statusText}`,
            };
          }
          return { delivered: true };
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { delivered: false, reason };
      }
    },
  };
}
