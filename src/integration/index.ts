/*
<MODULE_CONTRACT>
<purpose>
  RFC-0168: Integration Port barrel. Re-exports types from port.ts,
  funnel.ts, lifecycle.ts, sharding.ts, dispatch.ts, qstash.ts, and runtime
  orchestration (registries + fan-out) from orchestration.ts. Type-only consumers
  import from `./port-barrel.ts` (`@warpgogol/werkstatt-shared/share/integration/port`)
  to avoid transitively pulling in adapter implementations; consumers needing
  runtime logic import from here — the orchestration module is re-exported transparently.
</purpose>
<non-goals>
  <item>Do not define logic here — pure re-export barrel.</item>
  <item>Do not import astro:env — the caller injects the secrets bag.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0168: initial implementation.</item>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

// Port-barrel re-exports all type/contract modules explicitly.
export * from "./port-barrel.ts";

// Runtime modules — explicit re-exports to keep the public API surface clear.
export type {
  DeliverResult,
  AdapterReadiness,
  RouteResult,
  DeliverEventResult,
  QueueBinding,
  KvDedupStore,
} from "./orchestration.ts";
export {
  CHANNEL_ADAPTERS,
  CRM_ADAPTERS,
  CHANNEL_ADAPTER_IDS,
  CRM_ADAPTER_IDS,
  INTEGRATION_ADAPTER_SECRETS,
  deliverLead,
  auditIntegrationReadiness,
  DESTINATION_ADAPTERS,
  EXTERNAL_DESTINATION_VENDORS,
  EXTERNAL_DESTINATION_SECRETS,
  DESTINATION_VENDORS_BY_KIND,
  DESTINATION_ADAPTER_SECRETS,
  routeEvent,
  IntegrationEventSchema,
  authenticateInbound,
  routeEventToReady,
  deliverEvent,
  kvDedup,
  enqueueEvent,
  consumeIntegrationBatch,
  upsertLead,
} from "./orchestration.ts";

// Lagebild ingress client (POST /v1/ingress — WebsiteIngress contract v1)
export {
  submitIngress,
  buildIdempotencyKey,
  LAGEBILD_INGRESS_CONTRACT_VERSION,
  type LagebildIngressConfig,
  type IngressSubmitInput,
  type WebsiteIngressPayload,
  type IngressResult,
  type IngressInteractionKind,
  type IdentityClaimType,
  type IdentityClaim,
  type IngressOrigin,
  type ExplicitPolicyAssertion,
  type PolicyAssertionKind,
} from "./lagebild-ingress.ts";

// Lagebild destination adapter (RFC-0176: wraps submitIngress as a DestinationAdapter)
export { lagebildDestinationAdapter } from "./lagebild-destination-adapter.ts";
