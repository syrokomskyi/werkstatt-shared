/***********************************************
<MODULE_CONTRACT>
<purpose>Defines type declarations for middleware and content management in the Astro framework.</purpose>
<non-goals>
  <item>Do not implement middleware logic or content retrieval.</item>
  <item>Do not handle raw data parsing or transformation.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
***********************************************/

/// <reference types="astro/client" />
declare module "astro:middleware" {
  export function defineMiddleware(fn: any): any;
  export function sequence(...middlewares: any[]): any;
}
declare module "astro:content" {
  export function getEntry(collection: string, id: string): Promise<any>;
  export function getCollection(collection: string, filter?: any): Promise<any[]>;
}
// Ambient shim for the per-app GENERATED env schema (api.routes.generate writes the
// real schema into apps/*/src/env.schema.generated.mjs). In the package-typecheck
// context there is no app schema, so we declare the secret names the section API
// handlers import. Keep in sync with the Integration Port secret catalog
// (@warpgogol/werkstatt-site/integration) + section `api[].secrets`. All optional — a missing
// value degrades to the handler's error path, never a build/runtime throw.
declare module "astro:env/server" {
  // RFC-0168 Integration Port — channels + CRM (send-message handler).
  export const INTEGRATION_TELEGRAM_BOT_TOKEN: string | undefined;
  export const INTEGRATION_TELEGRAM_CHAT_ID: string | undefined;
  // RFC-0181: email is sent via Cloudflare Email Routing (no Resend API key). TO is a
  // verified destination address; FROM a verified sender on the zone domain.
  export const INTEGRATION_EMAIL_TO: string | undefined;
  export const INTEGRATION_EMAIL_FROM: string | undefined;
  export const INTEGRATION_WHATSAPP_TOKEN: string | undefined;
  export const INTEGRATION_WHATSAPP_PHONE_ID: string | undefined;
  export const INTEGRATION_WHATSAPP_TO: string | undefined;
  // RFC-0176 inbound hub (chat-widget inbound handler).
  export const INTEGRATION_INBOUND_SECRET: string | undefined;
  // RFC-0181 EU-resident delivery — Upstash QStash + Redis (eu-central-1).
  export const UPSTASH_QSTASH_URL: string | undefined;
  export const UPSTASH_QSTASH_TOKEN: string | undefined;
  export const UPSTASH_QSTASH_CURRENT_SIGNING_KEY: string | undefined;
  export const UPSTASH_QSTASH_NEXT_SIGNING_KEY: string | undefined;
  export const UPSTASH_REDIS_REST_URL: string | undefined;
  export const UPSTASH_REDIS_REST_TOKEN: string | undefined;
  // RFC-0191: Stripe billing — the webhook signing secret (stripe-webhook route) and the
  // server API key (billing client). Per-tenant; self-enabling — handlers fail-closed when absent.
  export const STRIPE_WEBHOOK_SECRET: string | undefined;
  export const STRIPE_SECRET_KEY: string | undefined;
}

// RFC-0176/0181: Cloudflare Workers runtime bindings. Astro v6 removed
// Astro.locals.runtime.env — handlers read bindings from this global instead.
// RFC-0181 uses the send_email binding for Cloudflare Email Routing.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

// RFC-0181: Cloudflare Email Routing message type (send_email binding).
declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string);
  }
}
