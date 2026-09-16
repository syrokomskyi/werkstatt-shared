/*
<MODULE_CONTRACT>
<purpose>Facilitates the export of passport-related schemas, types, and utility functions for credential management.</purpose>
<non-goals>
  <item>Do not implement business logic for credential validation or user authentication.</item>
  <item>Do not manage raw data parsing or transport orchestration.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

/**
 * @warpgogol/werkstatt-shared/passport — Cosmic Passport
 * DNA-31, DNA-34 / RFC-0028
 */

export {
  PassportSchema,
  PassportPublicKeyFileSchema,
  PassportPublicKeyEntrySchema,
  SiteOwnershipCredentialSubjectSchema,
  ActorDelegationCredentialSubjectSchema,
  WerkstattCredentialSchema,
  WerkstattIdentityConfigSchema,
} from "./schema.ts";
export type {
  PassportJson,
  PassportPublicKeyFile,
  PassportPublicKeyEntry,
  VCProof,
  VerifiableCredential,
  SiteOwnershipCredentialSubject,
  ActorDelegationCredentialSubject,
  WerkstattCredential,
  WerkstattIdentityConfig,
} from "./schema.ts";

export { rotateKey } from "./key-rotate.ts";
export type { KeyRotateOptions, KeyRotateResult } from "./key-rotate.ts";

export { signBytes, verifyBytes, generateKeypair } from "./sign.ts";

export {
  identityCredentialBytes,
  signIdentityCredential,
  verifyIdentityCredential,
} from "./identity-sign.ts";
export type { IdentityCredentialSubject } from "./identity-sign.ts";

export { dhtEntryBytes, signDhtEntry, verifyDhtEntry } from "./dht-sign.ts";
export type { DHTEntryData } from "./dht-sign.ts";
