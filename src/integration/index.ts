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
  <item>Deepening: split orchestration (registries + fan-out) into orchestration.ts; index.ts is now a pure barrel.</item>
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
