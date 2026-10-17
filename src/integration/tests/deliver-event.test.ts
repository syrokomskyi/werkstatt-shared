/*
<MODULE_CONTRACT>
<purpose>
Unit tests for deliver event covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals><item>No network.</item></non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0181: initial deliverEvent test.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import { deliverEvent, eventToLeadMessage } from "../index.ts";
import type { IntegrationEvent } from "../port.ts";

const EVENT: IntegrationEvent = {
  eventId: "evt-1",
  kind: "lead",
  source: "send-message",
  locale: "de",
  occurredAt: "2026-06-08T00:00:00.000Z",
  contact: { email: "a@example.de" },
  payload: { message: "Hallo" },
};

test("eventToLeadMessage maps the event onto a LeadMessage", () => {
  const msg = eventToLeadMessage(EVENT);
  expect(msg.message).toBe("Hallo");
  expect(msg.formId).toBe("send-message");
  expect(msg.locale).toBe("de");
  expect(msg.submittedAt).toBe("2026-06-08T00:00:00.000Z");
  expect(msg.contact?.email).toBe("a@example.de");
});

test("deliverEvent with no secrets skips every sink (no failures, no retry)", async () => {
  const result = await deliverEvent(EVENT, {});
  expect(result.channels.delivered.length).toBe(0);
  expect(result.channels.failed.length).toBe(0);
  expect(result.channels.skipped.includes("telegram")).toBeTruthy();
  expect(result.channels.skipped.includes("whatsapp")).toBeTruthy();
  expect(result.destinations.routed.length).toBe(0);
  expect(result.destinations.failed.length).toBe(0);
  expect(result.destinations.skipped.includes("crm:lagebild")).toBeTruthy();
});

test("RFC-1198: referrer picks the resolved partner name, else the raw input", () => {
  const resolved = eventToLeadMessage({
    ...EVENT,
    payload: {
      message: "Hallo",
      referrer: "anna-schreiner",
      referralPartnerSlug: "anna-schreiner",
      referralPartnerName: "Anna Schreiner",
    },
  });
  expect(resolved.referrer).toBe("Anna Schreiner");

  const raw = eventToLeadMessage({
    ...EVENT,
    payload: { message: "Hallo", referrer: "Mein Nachbar Karl" },
  });
  expect(raw.referrer).toBe("Mein Nachbar Karl");

  const absent = eventToLeadMessage(EVENT);
  expect(absent.referrer).toBeUndefined();
});

test("email is no longer a fetch channel adapter (Cloudflare Email Routing handles it)", async () => {
  const result = await deliverEvent(EVENT, {});
  expect(!result.channels.skipped.includes("email")).toBeTruthy();
});
