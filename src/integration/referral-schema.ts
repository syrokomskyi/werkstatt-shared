/*
<MODULE_CONTRACT>
<purpose>RFC-1191: zod schema for the referral-attribution payload — server-side
validation at the integration-dispatch boundary. Kept in a dedicated module so
client capture code (client-scripts/referral-capture.ts) can consume the pure
contracts in referral.ts without pulling zod into the browser bundle.</purpose>
<non-goals>
  <item>Do not import this module from client-scripts — zod carries a
        `new Function` JIT capability probe that trips CSP-SINK-01.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1191: split zod schema out of referral.ts to keep the client bundle zod-free.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

import { REF_CODE_PATTERN } from "./referral.ts";

/** Zod schema the dispatch path validates attribution against. */
export const ReferralAttributionPayloadSchema = z.object({
  refCode: z.string().regex(REF_CODE_PATTERN),
  firstTouchAt: z.string().datetime(),
});
