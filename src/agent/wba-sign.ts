/*
<MODULE_CONTRACT>
<purpose>
RFC-1188: Web Bot Auth outbound identity — HTTP Message Signatures
(draft-ietf-httpbis-message-signatures) signer, OKP JWK derivation for the
published /.well-known/http-message-signatures-directory document, and the
single OutboundAgentClient fetch wrapper every platform-originated
agent-directed call goes through. Runtime-agnostic by construction:
@noble/ed25519 + WebCrypto SHA-256 + btoa — no node:* imports, no Buffer,
Workers-safe.
</purpose>
<non-goals>
  <item>Does not verify inbound signatures — inbound WBA stays delegated to the Cloudflare edge (ADR-0098); the only in-origin signature check lives inside RFC-1187's registration key-proof.</item>
  <item>Does not resolve key material or key versions — callers supply privateKeyHex / public key + kid (resolution conventions live with the callers).</item>
  <item>Does not implement retry, timeout, or redirect policy — the wrapped fetch owns transport semantics.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1188: initial WBA signer, OKP JWK derivation, and OutboundAgentClient wrapper.</item>
  <item>RFC-1188: Web Bot Auth outbound identity: wba-sign primitives, directory emit+sweep, AGS-WBA-01, leitstand signed fetches</item>
</CHANGE_SUMMARY>
*/

import { signBytes } from "../signing/sign.ts";

/** Well-known path the published key directory is served at (IETF draft convention). */
export const WBA_DIRECTORY_PATH = "/.well-known/http-message-signatures-directory";

const SIGNATURE_LABEL = "sig1";
const SIGNATURE_TTL_SECONDS = 60;
const COVERED_BASE = ["@method", "@authority", "@path", "signature-agent"] as const;

// ---------------------------------------------------------------------------
// Local encoders — Buffer-free so the module stays Workers-safe (the canonical
// encoders in ../signing/key.ts import node:crypto and must not leak here).
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("invalid hex input");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Decode a base58btc multibase string ("z"-prefixed) to bytes. */
function multibaseToBytes(multibase: string): Uint8Array {
  if (!multibase.startsWith("z")) {
    throw new Error(`unsupported multibase prefix "${multibase[0]}" — only "z" (base58btc)`);
  }
  const src = multibase.slice(1);
  if (src.length === 0) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < src.length && src[zeros] === "1") zeros++;
  // Big-endian base-58 accumulation.
  const bytes: number[] = [0];
  for (let i = zeros; i < src.length; i++) {
    const value = B58_ALPHABET.indexOf(src[i]);
    if (value < 0) throw new Error(`invalid base58btc character "${src[i]}"`);
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes.reverse()]);
}

function b64uEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64EncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64Decode(input: string): Uint8Array {
  const bin = atob(input);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// JWK derivation — RFC-1188: the published directory exposes the passport key.
// ---------------------------------------------------------------------------

/** OKP JWK shape published in the WBA directory — DOM JsonWebKey lacks `kid` here. */
export interface WbaJwk {
  kty: "OKP";
  crv: "Ed25519";
  /** Bare passport key version ("v1", "v2", …). */
  kid: string;
  /** base64url-encoded 32-byte Ed25519 public key. */
  x: string;
  alg: "EdDSA";
  use: "sig";
}

/**
 * Derive the OKP JWK published in the WBA directory from the canonical stored
 * key form — raw bytes, hex, or base58btc multibase (`publicKeyMultibase`
 * from cosmic-passport-key.json). `kid` is the bare passport key version.
 */
export function passportKeyToJwk(publicKey: Uint8Array | string, kid: string): WbaJwk {
  let bytes: Uint8Array;
  if (publicKey instanceof Uint8Array) {
    bytes = publicKey;
  } else if (publicKey.startsWith("z")) {
    bytes = multibaseToBytes(publicKey);
  } else {
    bytes = hexToBytes(publicKey);
  }
  if (bytes.length !== 32) {
    throw new Error(`Ed25519 public key must be 32 bytes, got ${bytes.length}`);
  }
  return { kty: "OKP", crv: "Ed25519", kid, x: b64uEncodeBytes(bytes), alg: "EdDSA", use: "sig" };
}

// ---------------------------------------------------------------------------
// Signer — HTTP Message Signatures over Ed25519.
// ---------------------------------------------------------------------------

export interface WbaSigner {
  /** Active passport key version — also the JWK `kid` and signature `keyid`. */
  readonly keyId: string;
  /** Signs an outbound Request, returning a NEW Request with WBA headers set. */
  sign(request: Request, opts?: { created?: number }): Promise<Request>;
}

export function createWbaSigner(opts: {
  privateKeyHex: string;
  keyId: string;
  directoryUrl: string;
  userAgent: string;
}): WbaSigner {
  const privateKey = hexToBytes(opts.privateKeyHex);
  if (privateKey.length !== 32) {
    throw new Error(`Ed25519 private key must be 32 bytes, got ${privateKey.length}`);
  }
  return {
    keyId: opts.keyId,
    async sign(request, signOpts) {
      const created = signOpts?.created ?? Math.floor(Date.now() / 1000);
      const expires = created + SIGNATURE_TTL_SECONDS;
      const url = new URL(request.url);
      const covered: string[] = [...COVERED_BASE];
      const lines: string[] = [
        `"@method": ${request.method.toUpperCase()}`,
        `"@authority": ${url.host}`,
        `"@path": ${url.pathname}`,
        `"signature-agent": ${opts.directoryUrl}`,
      ];

      const headers = new Headers(request.headers);
      headers.set("Signature-Agent", opts.directoryUrl);
      headers.set("User-Agent", opts.userAgent);

      // content-digest only when a body exists — clone before reading so the
      // caller's request keeps its single-read body stream intact.
      const bodyRequest = request.clone();
      if (request.body !== null) {
        const digest = await crypto.subtle.digest("SHA-256", await bodyRequest.arrayBuffer());
        const contentDigest = `sha-256=:${b64EncodeBytes(new Uint8Array(digest))}:`;
        headers.set("Content-Digest", contentDigest);
        covered.push("content-digest");
        lines.push(`"content-digest": ${contentDigest}`);
      }

      const coveredList = covered.map((c) => `"${c}"`).join(" ");
      const params = `(${coveredList});keyid="${opts.keyId}";alg=ed25519;created=${created};expires=${expires}`;
      lines.push(`"@signature-params": ${params}`);

      const signatureBase = new TextEncoder().encode(lines.join("\n"));
      const signature = await signBytes(privateKey, signatureBase);

      headers.set("Signature-Input", `${SIGNATURE_LABEL}=${params}`);
      headers.set("Signature", `${SIGNATURE_LABEL}=:${b64EncodeBytes(signature)}:`);
      return new Request(request, { headers });
    },
  };
}

// ---------------------------------------------------------------------------
// Outbound client — the single choke point for agent-directed calls.
// ---------------------------------------------------------------------------

export interface OutboundAgentClient {
  readonly fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

/**
 * Wraps fetch for platform-originated agent-directed requests. With a signer
 * the request carries the full WBA header set; without one it still carries
 * the identifying User-Agent and passes through otherwise unchanged — degraded,
 * never broken. A signing failure logs a warning and falls back to unsigned:
 * identity must never take outbound calls down.
 */
export function createOutboundAgentClient(opts: {
  signer?: WbaSigner;
  userAgent: string;
  fetchImpl?: typeof fetch;
  onSigningFailure?: (error: unknown) => void;
}): OutboundAgentClient {
  const transport = opts.fetchImpl ?? fetch;
  return {
    async fetch(input, init) {
      if (opts.signer) {
        try {
          return await transport(await opts.signer.sign(new Request(input, init)));
        } catch (error) {
          opts.onSigningFailure?.(error);
        }
      }
      // Unsigned path: preserve the caller's fetch shape (url, init) — only
      // the identifying User-Agent is injected, nothing is re-wrapped. When
      // the caller passed a plain header record, keep the record shape so
      // downstream code (and test doubles) sees the same type it supplied.
      const source = input instanceof Request ? input.headers : init?.headers;
      if (
        source &&
        typeof source === "object" &&
        !(source instanceof Headers) &&
        !Array.isArray(source)
      ) {
        return transport(input, {
          ...init,
          headers: {
            ...(source as Record<string, string>),
            "User-Agent": opts.userAgent,
          },
        });
      }
      const headers = new Headers(source);
      headers.set("User-Agent", opts.userAgent);
      return transport(input, { ...init, headers });
    },
  };
}

// ---------------------------------------------------------------------------
// Independent verification helper — used by tests + manifest.verify to prove
// a Signature header verifies against a published JWK. RFC 9421 base rebuild.
// ---------------------------------------------------------------------------

/** Decode the published directory JWK `x` back to raw public-key bytes. */
export function jwkToPublicKeyBytes(jwk: Pick<WbaJwk, "kty" | "crv" | "x">): Uint8Array {
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string") {
    throw new Error("not an Ed25519 OKP JWK");
  }
  // base64url → base64
  const padded = jwk.x.replaceAll("-", "+").replaceAll("_", "/");
  return b64Decode(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}
