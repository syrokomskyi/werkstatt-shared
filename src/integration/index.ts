/*
<MODULE_CONTRACT>
<purpose>
  RFC-0168: Integration Port barrel. Re-exports types from port.ts,
  funnel.ts, lifecycle.ts, sharding.ts, dispatch.ts, qstash.ts, and runtime
  orchestration (registries + fan-out) from orchestration.ts. Type-only consumers
  import from `./port-barrel.ts` (`@warpgogol/werkstatt-shared/integration/port`)
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
  <item>RFC-1106: step 6 — delete integration port-barrel

port-barrel.ts deleted; its explicit contract re-exports absorbed into integration/index.ts. The site domain/integration barrel rewires to explicit names from the shared barrel. ./integration/port-barrel export entry removed; ./integration/port (→ port.ts) stays — engine agent-gate consumers unaffected.</item>
</CHANGE_SUMMARY>
*/

// RFC-1106: port-barrel.ts is deleted — its explicit contract re-exports live here.
export type { IntegrationSecrets } from "./port.ts";
export type { LeadMessage, Lead, IntegrationChannelAdapter, CrmAdapter } from "./port.ts";
export type { IntegrationEvent, DestinationAdapter } from "./port.ts";
export { DESTINATION_KINDS, EXECUTION_MODES, eventToLeadMessage, eventToLead } from "./port.ts";
export type { DestinationKind, ExecutionMode } from "./port.ts";

export type {
  VisitorFunnelEventPayload,
  FunnelSystemTrigger,
  FunnelTransitionTrigger,
} from "./funnel.ts";
export {
  FUNNEL_VERSION,
  VISITOR_FUNNEL_STAGES,
  FUNNEL_ENTRY_STAGE,
  FUNNEL_TERMINAL_STAGES,
  VISITOR_FUNNEL_EVENT_KINDS,
  VISITOR_FUNNEL_INTENTS,
  VISITOR_FUNNEL_SOURCES,
  VISITOR_BUYER_TYPES,
  FUNNEL_TRANSITIONS,
  isValidFunnelStage,
  BUFFER_DEAL_STAGES,
  FUNNEL_STAGE_TO_BUFFER_STAGE,
  bridgeFunnelStage,
  SYNC_OUTBOX_STATUSES,
  SYNC_OUTBOX_OPS,
  canTransition,
  nextStages,
  reachableStages,
  FUNNEL_SYSTEM_TRIGGERS,
  FUNNEL_TRANSITION_TRIGGERS,
  LEGACY_FUNNEL_STAGES,
  scanForMakeComReferences,
} from "./funnel.ts";
export type {
  VisitorFunnelStage,
  VisitorFunnelEventKind,
  VisitorFunnelIntent,
  VisitorFunnelSource,
  VisitorBuyerType,
  BufferDealStage,
  SyncOutboxStatus,
  SyncOutboxOp,
} from "./funnel.ts";

export type { LifecycleEventPayload } from "./lifecycle.ts";
export {
  LIFECYCLE_EVENT_KINDS,
  SUBSCRIPTION_STATUSES,
  INVOICE_KINDS,
  INVOICE_STATUSES,
  SUBSCRIPTION_PLANS,
  LifecycleEventPayloadSchema,
  isLifecycleEventKind,
  SUBSCRIPTION_TRANSITIONS,
  SUBSCRIPTION_TRANSITION_TRIGGERS,
} from "./lifecycle.ts";
export type {
  LifecycleEventKind,
  SubscriptionStatus,
  InvoiceKind,
  InvoiceStatus,
  SubscriptionPlan,
} from "./lifecycle.ts";

export type { ShardAssignment, ResolveShardOptions } from "./sharding.ts";
export { DELIVERY_REGIONS, DELIVERY_TIERS, fnv1a, resolveShard } from "./sharding.ts";
export type { DeliveryRegion, DeliveryTier } from "./sharding.ts";

export type {
  DispatchExecuteRequest,
  DispatchExecuteResult,
  DispatchNamespaceBinding,
  DispatchOutcome,
} from "./dispatch.ts";
export { DISPATCH_ROUTE, executeDispatch, dispatchToTenant } from "./dispatch.ts";

export type { QstashPublishConfig, IdempotencyLedger, RestRedisConfig } from "./qstash.ts";
export {
  QSTASH_EU_BASE,
  UPSTASH_QSTASH_SECRETS,
  UPSTASH_REDIS_SECRETS,
  UPSTASH_DELIVERY_SECRETS,
  buildQstashPublish,
  restRedisLedger,
} from "./qstash.ts";

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
