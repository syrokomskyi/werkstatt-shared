/*
<MODULE_CONTRACT>
<purpose>SHA-256 delegation over the canonical JSON v1 encoder — node-bound companion to canonical-json.ts.</purpose>
<non-goals>
  <item>Do not add new encoding logic — all canonicalization lives in canonical-json.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1267 (REVIEW-RFC-1267-01): extracted from canonical-json.ts — keeps the JCS encoder node-free while hash consumers keep the barrel-importable canonicalJsonHashV1.</item>
</CHANGE_SUMMARY>
*/

import { canonicalJsonBytesV1, type CanonicalJsonObjectV1 } from "./canonical-json.ts";
import { byteHash, type Sha256Digest } from "./primitives.ts";

export function canonicalJsonHashV1(value: CanonicalJsonObjectV1): Sha256Digest {
  const bytes = canonicalJsonBytesV1(value);
  return byteHash(bytes);
}
