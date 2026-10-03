import { describe, test, expect } from "vitest";
import fc from "fast-check";
import { passportKeyToJwk, jwkToPublicKeyBytes } from "./wba-sign.ts";

const arbKeyBytes = fc.uint8Array({ minLength: 32, maxLength: 32 });

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("wba-sign encoders (property-based)", () => {
  test("JWK x round-trips to the exact public-key bytes for any 32-byte key", () => {
    fc.assert(
      fc.property(arbKeyBytes, (bytes) => {
        const jwk = passportKeyToJwk(bytes, "v1");
        expect(jwkToPublicKeyBytes(jwk)).toEqual(bytes);
      }),
    );
  });

  test("x is canonical unpadded base64url — 43 chars, alphabet-clean", () => {
    fc.assert(
      fc.property(arbKeyBytes, (bytes) => {
        expect(passportKeyToJwk(bytes, "v1").x).toMatch(/^[A-Za-z0-9_-]{43}$/);
      }),
    );
  });

  test("raw bytes, hex, and base58btc multibase of the same material yield the same x", async () => {
    const { toMultibase } = await import("../passport/sign.ts");
    fc.assert(
      fc.property(arbKeyBytes, (bytes) => {
        const fromBytes = passportKeyToJwk(bytes, "v1").x;
        expect(passportKeyToJwk(toHex(bytes), "v1").x).toBe(fromBytes);
        expect(passportKeyToJwk(toMultibase(bytes), "v1").x).toBe(fromBytes);
      }),
    );
  });
});
