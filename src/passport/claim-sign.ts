/*
<MODULE_CONTRACT>
<purpose>
RFC-1124: Fleet claim signing and verification — canonicalization and
sign/verify wrappers for FleetClaim, built on the existing Ed25519
signBytes/verifyBytes primitives from sign.ts. Analogous to dht-sign.ts
but for the git-native fleet claims registry claim shape.
</purpose>
<non-goals>
  <item>Do not handle key storage or management — private keys arrive as env vars.</item>
  <item>Do not assemble W3C VC envelopes — claims use a simple signature string, not VCProof.</item>
  <item>Do not modify sign.ts — this module wraps signBytes/verifyBytes.</item>
  <item>Do not implement claim legitimacy rules (self-claim vs transfer claim) — that lives in the engine's claims-repo.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1124: initial fleet claim signing module — FleetClaim contract, claimBytes, signClaim, verifyClaim.</item>
</CHANGE_SUMMARY>
*/

/**
 * @warpgogol/werkstatt-shared/passport/claim-sign — fleet claim signing (RFC-1124)
 *
 * Uses signBytes/verifyBytes from sign.ts with a dedicated canonicalization
 * function for fleet claims. The signature field is excluded from
 * canonicalization (it is computed over the claim data without the signature).
 */

import { signBytes, verifyBytes } from "./sign.ts";

/**
 * One signed claim file: claims/<system-id>.json in the fleet claims repo.
 *
 * The claim is self-contained for offline signature verification:
 * `signerPublicKey` is embedded, so a verifier needs nothing but the claim
 * file to check the signature. Legitimacy (is this signer allowed to claim?)
 * is decided by the engine — self-claims sign with the creator key, transfer
 * claims sign with the PREVIOUS creator's key and carry `authorizationHash`
 * binding them to the bordbuch `handover` event.
 */
export interface FleetClaim {
  /** SHA-256 of the canonical passport.json at claim time. */
  passportHash: string;
  systemId: string;
  /** did:web-style creator identity from passport.creator.identity. */
  creatorIdentity: string;
  /** deriveInstanceId(creator.publicKey) — first 16 hex of sha256. */
  instanceId: string;
  /** ISO 8601 — LWW field. */
  claimedAt: string;
  /** Bordbuch tip hash at claim time. */
  bordbuchHead: string;
  /**
   * Tombstone marker — non-null ONLY on a tombstone file: a claim explicitly
   * superseded without a same-id successor (e.g. system-id migration).
   * Normal replacement never writes a tombstone — the new claim replaces the
   * file and git history is the supersession chain.
   */
  supersededBy: string | null;
  /**
   * Multibase Ed25519 public key of the signer — embedded so the claims repo
   * is self-contained for offline verification. Equals the creator's key for
   * self-claims; equals the PREVIOUS creator's key for transfer claims.
   */
  signerPublicKey: string;
  /**
   * Transfer claims only: sha256 of the handover-authorization.json that
   * authorizes the creator change (matches bordbuch `handover` event
   * metadata.authorizationHash). Null for self-claims.
   */
  authorizationHash: string | null;
  /** Ed25519 signature over the canonical JSON of all fields above. */
  signature: string;
}

/**
 * FleetClaim without the signature field — the data that is actually signed.
 */
export type FleetClaimData = Omit<FleetClaim, "signature">;

/**
 * Produce canonical UTF-8 bytes from a fleet claim (excluding signature).
 * DETERMINISM: identical inputs → identical bytes (sorted-key JSON, no whitespace).
 */
export function claimBytes(claim: FleetClaimData): Uint8Array {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(claim).sort()) {
    sorted[key] = (claim as Record<string, unknown>)[key];
  }
  const canonical = JSON.stringify(sorted);
  return new TextEncoder().encode(canonical);
}

/**
 * Sign a fleet claim and return a multibase Ed25519 signature string.
 *
 * @param claim          — claim data (without signature)
 * @param privateKeyHex  — 32-byte Ed25519 private key as hex (from env secret)
 * @returns multibase base58btc signature string
 */
export async function signClaim(claim: FleetClaimData, privateKeyHex: string): Promise<string> {
  return signBytes(privateKeyHex, claimBytes(claim));
}

/**
 * Verify a fleet claim signature against the claim's embedded signerPublicKey.
 *
 * @param claim — full fleet claim (including signature)
 * @returns true if signature is valid
 */
export async function verifyClaim(claim: FleetClaim): Promise<boolean> {
  const { signature, ...claimData } = claim;
  return verifyBytes(claim.signerPublicKey, claimBytes(claimData), signature);
}
