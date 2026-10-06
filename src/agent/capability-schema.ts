/*
<MODULE_CONTRACT>
<purpose>
RFC-1211: the closed `ui` block on capability records plus the generated
`ui://` resource document contract (MCP-UI resource projection). A capability
whose catalog YAML declares `ui: { resource: true }` gets a deterministic,
self-contained HTML projection committed under `public/.well-known/ui/`
and served through MCP resources/list + resources/read. The schema lives
here (agent-facing contract) and is consumed by the ontology record schema
in ontology/schemas/capability.ts — this module imports nothing but zod so
the dependency direction stays acyclic.
</purpose>
<non-goals>
  <item>Do not render HTML here — the deterministic projection lives in
        packages/werkstatt-site/src/codegen/agent-ui.ts.</item>
  <item>Do not widen the ui block with interactivity flags — v1 resources are
        read-only text/html (no scripts, no postMessage bridges); widening
        requires a superseding RFC.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1211: initial contract — capabilityUiSchema, UiResourceDoc envelope, ui:// URI + .well-known path helpers.</item>
  <item>RFC-1212: metering contract — CapabilityMetering block, CapabilityPricing manifest projection, AgentUsageRecord journal schema.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/** RFC-1211: version marker stamped into every generated UI document. */
export const UI_RESOURCE_SCHEMA_ID = "gogol.agent-ui/1";

/** MIME type every ui:// resource carries — v1 emits text/html only. */
export const UI_RESOURCE_MIME = "text/html";

/** Site-relative public directory the committed UI artifacts live under. */
export const UI_RESOURCE_PUBLIC_DIR = ".well-known/ui";

/**
 * RFC-1211: the closed `ui` block of a capability catalog record. `resource:
 * true` opts the capability into deterministic HTML projection; unknown keys
 * are rejected by `.strict()` (AC-1). `preferredFrameSize` is MCP-UI metadata
 * passthrough — a rendering hint for the host frame, in CSS pixels.
 */
export const capabilityUiSchema = z
  .object({
    resource: z.literal(true),
    preferredFrameSize: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type CapabilityUi = z.infer<typeof capabilityUiSchema>;

/**
 * RFC-1211: the document envelope embedded in every generated UI artifact
 * (kept in-file as a leading HTML comment for auditability). `renderData` is
 * the props snapshot the deterministic render consumed — never request data.
 */
export const uiResourceDocSchema = z
  .object({
    schema: z.literal(UI_RESOURCE_SCHEMA_ID),
    uri: z.string().regex(/^ui:\/\/[^\s]+\/[^\s]+$/, "uri must be ui://<site>/<capability>"),
    mimeType: z.literal(UI_RESOURCE_MIME),
    title: z.string().min(1),
    renderData: z.record(z.string(), z.unknown()),
  })
  .strict();

export type UiResourceDoc = z.infer<typeof uiResourceDocSchema>;

/** RFC-1211: canonical ui:// URI for a capability on a site. */
export function uiResourceUri(site: string, capabilityId: string): string {
  return `ui://${site}/${capabilityId}`;
}

/** RFC-1211: site-relative public path of a capability's committed UI artifact. */
export function uiResourcePath(capabilityId: string): string {
  return `/${UI_RESOURCE_PUBLIC_DIR}/${capabilityId}.html`;
}

/**
 * RFC-1211: parse a ui:// URI back into `<site>/<capabilityId>`. Returns null
 * for non-ui URIs or malformed shapes — callers map null to "unknown resource".
 */
export function parseUiResourceUri(uri: string): { site: string; capabilityId: string } | null {
  const match = /^ui:\/\/([^\s/]+)\/([^\s/]+)$/.exec(uri);
  if (!match) return null;
  return { site: match[1]!, capabilityId: match[2]! };
}

// ---------------------------------------------------------------------------
// RFC-1212: metered invocation + machine-readable pricing
// ---------------------------------------------------------------------------

/**
 * RFC-1212: the closed `metering` block of a capability catalog record —
 * opt-in per-call pricing on top of `requires.entitlements`. `product` is a
 * pricing-catalog reference `<offeringSlug>.<chargeKey>` resolving to a PBP
 * `usage`-typed Charge in `src/content/business-profile/<lang>/offerings/`;
 * `pricePerUnit` is the declared projection, AGM-02 blocks when it diverges
 * from the catalog charge's unit-rate amount or policy currency.
 */
export const capabilityMeteringSchema = z
  .object({
    /** Pricing-catalog reference "<offeringSlug>.<chargeKey>" (PBP usage Charge). */
    product: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/,
        "product must be <offeringSlug>.<chargeKey>",
      ),
    /** What one unit measures — v1 always meters per invocation. */
    unit: z.enum(["invocation", "record", "token"]),
    /** Declared per-unit price — must match the catalog charge (AGM-02). */
    pricePerUnit: z
      .object({
        amount: z.number().positive(),
        /** ISO-4217 alpha-3, e.g. "EUR". */
        currency: z.string().regex(/^[A-Z]{3}$/),
      })
      .strict(),
    /** Included units per billing window before billing applies. */
    freeUnitsPerWindow: z.number().int().nonnegative().optional(),
    /** Free-allowance window granularity — defaults to "month". */
    window: z.enum(["day", "month"]).optional(),
  })
  .strict();

export type CapabilityMetering = z.infer<typeof capabilityMeteringSchema>;

/**
 * RFC-1212: the `pricing` object projected into agent.json / OpenAPI per
 * metered capability — bijective with `metering` (AGM-04 enforces).
 */
export const capabilityPricingSchema = z
  .object({
    metered: z.literal(true),
    product: z.string().min(1),
    unit: z.enum(["invocation", "record", "token"]),
    pricePerUnit: z
      .object({ amount: z.number().positive(), currency: z.string().regex(/^[A-Z]{3}$/) })
      .strict(),
    freeUnitsPerWindow: z.number().int().nonnegative(),
    window: z.enum(["day", "month"]),
  })
  .strict();

export type CapabilityPricing = z.infer<typeof capabilityPricingSchema>;

/** RFC-1212: schema marker stamped into every journaled usage record. */
export const AGENT_USAGE_SCHEMA_ID = "gogol.agent-usage/1";

/**
 * RFC-1212: one journaled usage record per dispatched metered invocation —
 * a sibling of the traffic telemetry event, emitted post-dispatch only (a
 * rejected/replayed call never bills). `callerIdentity` is the verified
 * agentId (pseudonymous billing identity) or "anonymous"; `billable` carries
 * the free-allowance verdict so the billing bridge can separate included
 * usage from chargeable usage without re-deriving window state.
 */
export const agentUsageRecordSchema = z
  .object({
    schema: z.literal(AGENT_USAGE_SCHEMA_ID),
    siteId: z.string().min(1),
    capability: z.string().min(1),
    callerIdentity: z.string().min(1),
    units: z.number().int().positive(),
    billable: z.boolean(),
    /** Dedup anchor — a replayed call never bills twice. */
    idempotencyKey: z.string().min(1).optional(),
    occurredAt: z.string().min(1),
  })
  .strict();

export type AgentUsageRecord = z.infer<typeof agentUsageRecordSchema>;

/** RFC-1212: project a capability's metering block into the public pricing ref. */
export function capabilityPricingProjection(cap: {
  metering?: CapabilityMetering;
}): CapabilityPricing | undefined {
  const m = cap.metering;
  if (!m) return undefined;
  return {
    metered: true,
    product: m.product,
    unit: m.unit,
    pricePerUnit: m.pricePerUnit,
    freeUnitsPerWindow: m.freeUnitsPerWindow ?? 0,
    window: m.window ?? "month",
  };
}
