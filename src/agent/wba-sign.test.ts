import { describe, it, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { verifyBytes } from "../signing/sign.ts";
import {
  WBA_DIRECTORY_PATH,
  createWbaSigner,
  createOutboundAgentClient,
  passportKeyToJwk,
  jwkToPublicKeyBytes,
  type WbaJwk,
} from "./wba-sign.ts";

const DIRECTORY_URL = `https://warpgogol.example${WBA_DIRECTORY_PATH}`;
const USER_AGENT = "WarpgogolBot/9.9.9 (+https://warpgogol.example)";

const PRIVATE_KEY_HEX = "b3f84ddb6973a143c4b2fc6b0b8d6b3cb33863b2e30dca94241029111e81e14f";
const privateKey = new Uint8Array(PRIVATE_KEY_HEX.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

function signer(overrides: { keyId?: string } = {}) {
  return createWbaSigner({
    privateKeyHex: PRIVATE_KEY_HEX,
    keyId: overrides.keyId ?? "v1",
    directoryUrl: DIRECTORY_URL,
    userAgent: USER_AGENT,
  });
}

/**
 * Independent verifier — rebuilds the RFC 9421 signature base from the
 * emitted headers (no shared code path with the signer) and verifies with
 * the published JWK material. AC-3.
 */
async function independentVerify(request: Request, jwk: WbaJwk): Promise<boolean> {
  const signatureInput = request.headers.get("Signature-Input")!;
  const signature = request.headers.get("Signature")!;
  const m = signatureInput.match(
    /^sig1=\(([^)]*)\);keyid="([^"]+)";alg=ed25519;created=(\d+);expires=(\d+)$/,
  );
  if (!m) return false;
  const covered = m[1].split(" ").map((s) => s.replaceAll('"', ""));
  const url = new URL(request.url);
  const lines: string[] = [];
  for (const comp of covered) {
    if (comp === "@method") lines.push(`"@method": ${request.method.toUpperCase()}`);
    else if (comp === "@authority") lines.push(`"@authority": ${url.host}`);
    else if (comp === "@path") lines.push(`"@path": ${url.pathname}`);
    else if (comp === "signature-agent")
      lines.push(`"signature-agent": ${request.headers.get("Signature-Agent")}`);
    else if (comp === "content-digest")
      lines.push(`"content-digest": ${request.headers.get("Content-Digest")}`);
    else return false;
  }
  const params = signatureInput.slice("sig1=".length);
  lines.push(`"@signature-params": ${params}`);
  const sigB64 = signature.match(/^sig1=:([A-Za-z0-9+/=]+):$/)?.[1];
  if (!sigB64) return false;
  const sigBytes = new Uint8Array([...atob(sigB64)].map((c) => c.charCodeAt(0)));
  return verifyBytes(
    jwkToPublicKeyBytes(jwk),
    new TextEncoder().encode(lines.join("\n")),
    sigBytes,
  );
}

describe("passportKeyToJwk", () => {
  it("derives OKP JWK from hex, bytes, and multibase — kid is the passport version", async () => {
    const pub = await ed.getPublicKeyAsync(privateKey);
    const fromBytes = passportKeyToJwk(pub, "v1");
    expect(fromBytes.kty).toBe("OKP");
    expect(fromBytes.crv).toBe("Ed25519");
    expect(fromBytes.kid).toBe("v1");
    expect(fromBytes.alg).toBe("EdDSA");
    expect(fromBytes.use).toBe("sig");
    const fromHex = passportKeyToJwk(
      [...pub].map((b) => b.toString(16).padStart(2, "0")).join(""),
      "v1",
    );
    expect(fromHex.x).toBe(fromBytes.x);
    // multibase "z" + base58btc — the same material must decode identically
    const { toMultibase } = await import("../passport/sign.ts");
    const fromMultibase = passportKeyToJwk(toMultibase(pub), "v1");
    expect(fromMultibase.x).toBe(fromBytes.x);
    // round-trip back to raw bytes
    expect(jwkToPublicKeyBytes(fromBytes)).toEqual(pub);
  });
});

describe("createWbaSigner (AC-2)", () => {
  it("stamps Signature-Agent, Signature-Input, Signature on a GET", async () => {
    const req = new Request("https://forge-site.example/agent-health");
    const signed = await signer().sign(req, { created: 1759564800 });
    expect(signed.headers.get("Signature-Agent")).toBe(DIRECTORY_URL);
    expect(signed.headers.get("User-Agent")).toBe(USER_AGENT);
    expect(signed.headers.get("Signature-Input")).toBe(
      'sig1=("@method" "@authority" "@path" "signature-agent");keyid="v1";alg=ed25519;created=1759564800;expires=1759564860',
    );
    expect(signed.headers.get("Signature")).toMatch(/^sig1=:[A-Za-z0-9+/=]+:$/);
    expect(signed.headers.get("Content-Digest")).toBeNull();
  });

  it("adds content-digest to covered components when a body exists", async () => {
    const req = new Request("https://forge-site.example/api/agent/a2a", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", method: "SendMessage" }),
    });
    const signed = await signer().sign(req, { created: 1759564800 });
    expect(signed.headers.get("Signature-Input")).toContain('"content-digest"');
    expect(signed.headers.get("Content-Digest")).toMatch(/^sha-256=:[A-Za-z0-9+/=]+:$/);
    // body survives signing — clone semantics keep the single-read stream intact
    expect(await signed.text()).toContain("SendMessage");
  });
});

describe("independent verification (AC-3)", () => {
  it("a signed GET verifies against the published JWK", async () => {
    const pub = await ed.getPublicKeyAsync(privateKey);
    const jwk = passportKeyToJwk(pub, "v1");
    const signed = await signer().sign(new Request("https://forge-site.example/health"), {
      created: 1759564800,
    });
    expect(await independentVerify(signed, jwk)).toBe(true);
  });

  it("a signed POST with body verifies against the published JWK", async () => {
    const pub = await ed.getPublicKeyAsync(privateKey);
    const jwk = passportKeyToJwk(pub, "v1");
    const signed = await signer().sign(
      new Request("https://forge-site.example/api/agent/mcp", {
        method: "POST",
        body: '{"jsonrpc":"2.0"}',
      }),
      { created: 1759564800 },
    );
    expect(await independentVerify(signed, jwk)).toBe(true);
  });

  it("a tampered signature does not verify", async () => {
    const pub = await ed.getPublicKeyAsync(privateKey);
    const jwk = passportKeyToJwk(pub, "v1");
    const signed = await signer().sign(new Request("https://forge-site.example/health"), {
      created: 1759564800,
    });
    const headers = new Headers(signed.headers);
    headers.set(
      "Signature",
      "sig1=:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==:",
    );
    const tampered = new Request(signed, { headers });
    expect(await independentVerify(tampered, jwk)).toBe(false);
  });
});

describe("createOutboundAgentClient", () => {
  it("signs through the injected fetch when a signer is configured", async () => {
    let captured: Request | null = null;
    const client = createOutboundAgentClient({
      signer: signer(),
      userAgent: USER_AGENT,
      fetchImpl: async (input) => {
        captured = input instanceof Request ? input : new Request(input);
        return new Response("ok");
      },
    });
    await client.fetch("https://forge-site.example/health");
    expect(captured!.headers.get("Signature")).toBeTruthy();
    expect(captured!.headers.get("Signature-Agent")).toBe(DIRECTORY_URL);
  });

  it("degrades to identifying User-Agent only when no signer is configured", async () => {
    let captured: Request | null = null;
    const client = createOutboundAgentClient({
      userAgent: USER_AGENT,
      fetchImpl: async (input, init) => {
        captured = input instanceof Request ? input : new Request(input, init);
        return new Response("ok");
      },
    });
    await client.fetch("https://forge-site.example/health");
    expect(captured!.headers.get("Signature")).toBeNull();
    expect(captured!.headers.get("Signature-Agent")).toBeNull();
    expect(captured!.headers.get("User-Agent")).toBe(USER_AGENT);
  });

  it("signing failure falls back to unsigned and reports — never breaks the call", async () => {
    const broken = {
      keyId: "v1",
      sign: async () => {
        throw new Error("signing exploded");
      },
    };
    let captured: Request | null = null;
    let reported: unknown = null;
    const client = createOutboundAgentClient({
      signer: broken,
      userAgent: USER_AGENT,
      onSigningFailure: (e) => {
        reported = e;
      },
      fetchImpl: async (input) => {
        captured = input instanceof Request ? input : new Request(input);
        return new Response("ok");
      },
    });
    const res = await client.fetch("https://forge-site.example/health");
    expect(res.status).toBe(200);
    expect(reported).toBeInstanceOf(Error);
    expect(captured!.headers.get("Signature")).toBeNull();
  });
});

describe("key validation", () => {
  it("rejects non-32-byte key material", () => {
    expect(() => passportKeyToJwk(new Uint8Array(16), "v1")).toThrow(/32 bytes/);
    expect(() =>
      createWbaSigner({
        privateKeyHex: "abcd",
        keyId: "v1",
        directoryUrl: DIRECTORY_URL,
        userAgent: USER_AGENT,
      }),
    ).toThrow(/32 bytes/);
  });
});
