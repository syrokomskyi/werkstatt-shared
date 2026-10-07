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

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
  <item>RFC-1198: cookie-free referral attribution — /r/<slug> partner landings + voluntary referrer field

Replace the RFC-1191 wg_ref cookie capture with URL+form attribution:
static /r/<slug> and /<lang>/r/<slug> partner landings (noindex, zero JS,
consent-gated via publicNameConsentRef), ?ref prefill on the existing
referrerField rail, server-side slug resolution against the bundled
partners.yaml, referral_partner_slug/name on the Lagebild ingress contract,
legacy /?ref -> /r/<slug> 302 in the generated worker, and full removal of
the cookie capture module (wg_ref, referral.attribution entitlement,
payload.attribution).</item>
  <item>RFC-1222: pass through the server-resolved receipt provenance —
partnerMode, policyEffectiveFrom, capturedAt, disclosureVersion.</item>
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

    // RFC-1198: server-resolved partner fields pass through verbatim — the site
    // API already matched the raw referrer input against the bundled partner
    // list. A non-string/empty value is simply omitted, never a dispatch error.
    const referralPartnerSlug =
      typeof event.payload.referralPartnerSlug === "string" && event.payload.referralPartnerSlug
        ? event.payload.referralPartnerSlug
        : undefined;
    const referralPartnerName =
      typeof event.payload.referralPartnerName === "string" && event.payload.referralPartnerName
        ? event.payload.referralPartnerName
        : undefined;
    // RFC-1222: receipt provenance rides the same payload — server-resolved on
    // the site, passed through verbatim here, snake_cased at the ingress edge.
    const partnerMode =
      typeof event.payload.partnerMode === "string" && event.payload.partnerMode
        ? event.payload.partnerMode
        : undefined;
    const policyEffectiveFrom =
      typeof event.payload.policyEffectiveFrom === "string" && event.payload.policyEffectiveFrom
        ? event.payload.policyEffectiveFrom
        : undefined;
    const capturedAt =
      typeof event.payload.capturedAt === "string" && event.payload.capturedAt
        ? event.payload.capturedAt
        : undefined;
    const disclosureVersion =
      typeof event.payload.disclosureVersion === "string" && event.payload.disclosureVersion
        ? event.payload.disclosureVersion
        : undefined;

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
        ...(referralPartnerSlug ? { referralPartnerSlug } : {}),
        ...(referralPartnerName ? { referralPartnerName } : {}),
        ...(partnerMode ? { partnerMode } : {}),
        ...(policyEffectiveFrom ? { policyEffectiveFrom } : {}),
        ...(capturedAt ? { capturedAt } : {}),
        ...(disclosureVersion ? { disclosureVersion } : {}),
      },
    );

    if (!result.accepted) {
      throw new Error(`lagebild: ingress rejected (${result.rejection_class ?? "unknown"})`);
    }

    return result.submission_id ? { id: result.submission_id } : null;
  },
};
