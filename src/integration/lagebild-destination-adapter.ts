/*
<MODULE_CONTRACT>
<purpose>
  RFC-0176: Lagebild as a destination-hub adapter (kind `crm`, vendor `lagebild`).
  Wraps the Lagebild ingress client (submitIngress) in the DestinationAdapter
  contract so the delivery callback can route IntegrationEvents to Lagebild via
  the standard extraAdapters injection — with QStash retries, DLQ, and Redis
  idempotency preserved end-to-end.
</purpose>
<non-goals>
  <item>Do not import astro:env — secrets are injected by the caller.</item>
  <item>Do not log or echo secrets.</item>
  <item>Do not modify the WebsiteIngress v1 contract — this adapter only maps
        IntegrationEvent → IngressSubmitInput.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into <history>, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
</CHANGE_SUMMARY>
*/

import type { DestinationAdapter, IntegrationEvent, IntegrationSecrets } from "./port.ts";
import {
  submitIngress,
  buildIdempotencyKey,
  type IdentityClaim,
  type IngressOrigin,
} from "./lagebild-ingress.ts";

/**
 * Lagebild destination adapter (RFC-0176). Self-enables by secret presence:
 * skips silently when LAGEBILD_* secrets are absent. Throws on transport
 * failure or non-acceptance so the delivery callback returns 502 and QStash
 * retries (bounded → DLQ).
 */
export const lagebildDestinationAdapter: DestinationAdapter = {
  kind: "crm",
  vendor: "lagebild",
  requiredSecrets: [
    "LAGEBILD_API_URL",
    "LAGEBILD_API_KEY",
    "LAGEBILD_TENANT_ID",
    "LAGEBILD_SOURCE_SYSTEM_ID",
  ],

  async route(
    event: IntegrationEvent,
    secrets: IntegrationSecrets,
  ): Promise<{ id: string } | null> {
    const apiUrl = secrets.LAGEBILD_API_URL;
    const apiKey = secrets.LAGEBILD_API_KEY;
    const tenantId = secrets.LAGEBILD_TENANT_ID;
    const sourceSystemId = secrets.LAGEBILD_SOURCE_SYSTEM_ID;
    if (!apiUrl || !apiKey || !tenantId || !sourceSystemId) {
      throw new Error("lagebild: missing credentials");
    }

    const submissionId = "sub_" + event.eventId.replace(/-/g, "").slice(0, 24);

    const claims: IdentityClaim[] = [];
    if (event.contact?.email) {
      claims.push({ claim_type: "email", value: event.contact.email });
    }
    if (event.contact?.phone) {
      claims.push({ claim_type: "phone", value: event.contact.phone });
    }

    const referrer =
      typeof event.payload.referrer === "string" ? event.payload.referrer : undefined;
    const origin: IngressOrigin = {
      locale: event.locale,
      ...(referrer ? { referrer_uri: referrer } : {}),
    };

    const message = typeof event.payload.message === "string" ? event.payload.message : null;

    const result = await submitIngress(
      { apiUrl, apiKey, tenantId, sourceSystemId },
      {
        submissionId,
        idempotencyKey: buildIdempotencyKey(tenantId, submissionId),
        interactionKind: "contact_message",
        identityClaims: claims,
        message,
        origin,
        explicitPolicyAssertions: [
          {
            kind: "consent",
            purpose: "crm_projection",
            value: true,
            statement_ref: "contact_form_consent",
          },
        ],
      },
    );

    if (!result.accepted) {
      throw new Error(`lagebild: ingress rejected (${result.rejection_class ?? "unknown"})`);
    }

    return result.submission_id ? { id: result.submission_id } : null;
  },
};
