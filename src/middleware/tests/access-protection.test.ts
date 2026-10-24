/*
<MODULE_CONTRACT>
  <purpose>RFC-0899: Unit tests for access protection middleware logic — constant-time comparison, host matching, PIN gating.</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Fixtures stay inline and minimal so each case states its own setup.</item>
</KEY_DECISIONS>

<CHANGE_SUMMARY>
  <item>RFC-1249: wire werkstatt.commands.validate into packages.check + retire CMD-OUTPUT debt</item>
  <item>RFC-0899: protect workers.dev dev and alt channels with the PIN and noindex</item>
  <item>RFC-1325: provisional workers.dev as first-class site host

Single host predicate module in werkstatt-shared; provisional registration derives dev/alt/main workers.dev channels from the account subdomain; first dev deploy auto-protects provisional hosts; provisional main responses carry noindex; dns-aid skips provisional sites; site.domain.adopt cuts over to a custom domain.</item>
  <item>RFC-1340</item>
  <item>RFC-1390: close review findings on invariant binding machinery</item>
  <history>RFC-0899</history>
</CHANGE_SUMMARY>
*/
// @ai-invariant: fixtures must not couple to internals beyond the public surface under test

import { describe, expect, it, vi } from "vitest";

const mockEnv: Record<string, unknown> = {};
vi.mock("cloudflare:workers", () => ({
  env: mockEnv,
}));
vi.mock("astro:middleware", () => ({
  defineMiddleware: (handler: unknown) => handler,
}));

describe("RFC-0899: access protection middleware", () => {
  async function loadMiddleware() {
    return (await import("../access-protection.ts")).accessProtectionMiddleware as (
      context: unknown,
      next: () => Promise<Response>,
    ) => Promise<Response>;
  }

  function makeContext(host: string, authHeader?: string, pathname = "/") {
    const headers = new Map<string, string>();
    headers.set("host", host);
    if (authHeader) headers.set("authorization", authHeader);
    return {
      request: {
        headers: {
          get: (name: string) => headers.get(name.toLowerCase()) ?? null,
        },
        url: `https://${host}${pathname}`,
      },
    };
  }

  async function runMiddleware(
    handler: (context: unknown, next: () => Promise<Response>) => Promise<Response>,
    host: string,
    authHeader?: string,
    pathname = "/",
  ): Promise<Response & { _nextCalled: boolean }> {
    let nextCalled = false;
    const nextResponse = new Response("page content", { status: 200 });
    const result = await handler(makeContext(host, authHeader, pathname), async () => {
      nextCalled = true;
      return nextResponse;
    });
    return Object.assign(result, { _nextCalled: nextCalled });
  }

  it("passes through for main domain (no dev/alt prefix)", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "example.com");
    expect(res._nextCalled).toBe(true);
    expect(res.status).toBe(200);
  });

  it("returns 401 for dev.* without auth header when PIN is set", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "dev.example.com");
    expect(res._nextCalled).toBe(false);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe('Basic realm="Staging Access"');
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noai, noimageai");
  });

  it("returns 401 for alt.* without auth header when PIN is set", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "alt.example.com");
    expect(res._nextCalled).toBe(false);
    expect(res.status).toBe(401);
  });

  it("returns 401 for a workers.dev dev channel (dev-<site>.<account>.workers.dev)", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "dev-dp7.syrokomskyi.workers.dev");
    expect(res._nextCalled).toBe(false);
    expect(res.status).toBe(401);
  });

  it("returns 401 for a workers.dev alt channel", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "alt-dp7.syrokomskyi.workers.dev");
    expect(res.status).toBe(401);
  });

  it("passes through the workers.dev main channel and look-alike hosts", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    expect((await runMiddleware(handler, "dp7.syrokomskyi.workers.dev"))._nextCalled).toBe(true);
    expect((await runMiddleware(handler, "devtools.example.com"))._nextCalled).toBe(true);
  });

  it("RFC-1325: noindexes the unprotected workers.dev main channel (public preview, never indexed)", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "dp7.syrokomskyi.workers.dev");
    expect(res._nextCalled).toBe(true);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noai, noimageai");
    // A real custom domain still carries no noindex.
    const prod = await runMiddleware(handler, "dp7.example.com");
    expect(prod.headers.get("X-Robots-Tag")).toBe(null);
  });

  it("passes through dev.* with correct Basic Auth", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const expected = `Basic ${btoa("warp:1234")}`;
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "dev.example.com", expected);
    expect(res._nextCalled).toBe(true);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noai, noimageai");
  });

  it("returns 401 for dev.* with wrong PIN", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const wrong = `Basic ${btoa("warp:9999")}`;
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "dev.example.com", wrong);
    expect(res._nextCalled).toBe(false);
    expect(res.status).toBe(401);
  });

  it("passes through dev.* when PIN is not set (no env var)", async () => {
    delete mockEnv.ACCESS_PIN;
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "dev.example.com");
    expect(res._nextCalled).toBe(true);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noai, noimageai");
  });

  it("passes through alt.* when PIN env is undefined", async () => {
    mockEnv.ACCESS_PIN = undefined;
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "alt.example.com");
    expect(res._nextCalled).toBe(true);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noai, noimageai");
  });

  it("does not set X-Robots-Tag on main domain", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "example.com");
    expect(res.headers.get("X-Robots-Tag")).toBe(null);
  });

  it("exempts /manifest.webmanifest from auth on dev.* when PIN is set", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "dev.example.com", undefined, "/manifest.webmanifest");
    expect(res._nextCalled).toBe(true);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noai, noimageai");
  });

  it("exempts /manifest.webmanifest from auth on alt.* when PIN is set", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "alt.example.com", undefined, "/manifest.webmanifest");
    expect(res._nextCalled).toBe(true);
    expect(res.status).toBe(200);
  });

  it("exempts machine-authenticated inbound endpoints on dev.* when PIN is set (RFC-1340)", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    for (const pathname of [
      "/api/integration-route",
      "/api/stripe-webhook",
      "/api/integration-inbound",
    ]) {
      const res = await runMiddleware(handler, "dev.example.com", undefined, pathname);
      expect(res._nextCalled).toBe(true);
      expect(res.status).toBe(200);
    }
  });

  it("does NOT exempt /api/send-message on dev.* — visitor endpoint stays PIN-gated", async () => {
    mockEnv.ACCESS_PIN = "1234";
    const handler = await loadMiddleware();
    const res = await runMiddleware(handler, "dev.example.com", undefined, "/api/send-message");
    expect(res._nextCalled).toBe(false);
    expect(res.status).toBe(401);
  });
});
