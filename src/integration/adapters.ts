/*
<MODULE_CONTRACT>
<purpose>RFC-0168/0181: reference Integration Port adapters. Channel adapters (Telegram, WhatsApp
Cloud API). Each is fetch-based, secret-driven, and self-disables when
its required secrets are absent. Email is NOT a fetch adapter — it is sent via Cloudflare Email
Routing (send_email binding) in the delivery callback (RFC-0181). CRM is handled by the Lagebild
destination adapter in lagebild-destination-adapter.ts.</purpose>
<non-goals>
  <item>Do not import vendor SDKs or astro:env — fetch + injected secrets only.</item>
  <item>Do not log or echo secrets.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0168: initial implementation.</item>
  <item>Pipedrive CRM adapters removed — Lagebild is the sole CRM destination.</item>
</CHANGE_SUMMARY>
*/

import type { IntegrationChannelAdapter, IntegrationSecrets, LeadMessage } from "./port.ts";

function formatMessageText(message: LeadMessage): string {
  return [
    "Neue Kontaktanfrage (send-message)",
    `Formular: ${message.formId}`,
    `Sprache: ${message.locale}`,
    `Zeit: ${message.submittedAt}`,
    "",
    message.message,
  ].join("\n");
}

export const telegramChannelAdapter: IntegrationChannelAdapter = {
  id: "telegram",
  requiredSecrets: ["INTEGRATION_TELEGRAM_BOT_TOKEN", "INTEGRATION_TELEGRAM_CHAT_ID"],
  async deliver(message: LeadMessage, secrets: IntegrationSecrets): Promise<void> {
    const token = secrets.INTEGRATION_TELEGRAM_BOT_TOKEN;
    const chatId = secrets.INTEGRATION_TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error("telegram: missing credentials");
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: formatMessageText(message) }),
    });
    if (!res.ok) throw new Error(`telegram: API ${res.status}`);
  },
};

// RFC-0181: the Resend email channel adapter was removed. Email notifications are
// sent via Cloudflare Email Routing (the `send_email` Worker binding), handled in the
// delivery callback route — not as a fetch+secret channel adapter. See the email
// notification step in chat-widget-section.delivery.api.ts and docs/specs/integration-delivery.md.

export const whatsappChannelAdapter: IntegrationChannelAdapter = {
  id: "whatsapp",
  requiredSecrets: [
    "INTEGRATION_WHATSAPP_TOKEN",
    "INTEGRATION_WHATSAPP_PHONE_ID",
    "INTEGRATION_WHATSAPP_TO",
  ],
  async deliver(message: LeadMessage, secrets: IntegrationSecrets): Promise<void> {
    const token = secrets.INTEGRATION_WHATSAPP_TOKEN;
    const phoneId = secrets.INTEGRATION_WHATSAPP_PHONE_ID;
    const to = secrets.INTEGRATION_WHATSAPP_TO;
    if (!token || !phoneId || !to) throw new Error("whatsapp: missing credentials");
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: formatMessageText(message) },
      }),
    });
    if (!res.ok) throw new Error(`whatsapp: Cloud API ${res.status}`);
  },
};
