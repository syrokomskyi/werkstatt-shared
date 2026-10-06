/*
<MODULE_CONTRACT>
<purpose>
RFC-0288: pure resolution of the closed capability catalog into the set of
capabilities ACTIVE on a given site. A capability is active iff the site holds
`agent.actions`, every additional `requires.entitlements` is held, every
`requires.sections` archetype renders on some page, and its id is not in
`agent.actionsDisabled`. Consumed by agent.manifest.generate (RFC-0286) to
populate `AgentActionRef[]`, and by RFC-0289/0290 to project OpenAPI
operations and MCP tools.
</purpose>
<non-goals>
  <item>Do not load the catalog from disk or read entitlements/content — the
        kernel command does that and passes already-loaded data here.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0288: initial capability resolution.</item>
  <item>RFC-1169: capabilityToActionRef projects sideEffect into AgentActionRef — preview vs write is readable off agent.json.</item>
  <item>RFC-1186: boundCapabilityIds input — requires.formBinding records activate only where a bound send-message block exists; preview records resolve through their nextAction sibling id.</item>
  <item>RFC-1186: steps 1-2 — capability contracts, catalog records, resolver, propsSchema</item>
  <item>RFC-1186: AGC-FORM-06 missing formId, strict FORM-04 preview binding, shared bound-set helpers (RFC-1186)</item>
</CHANGE_SUMMARY>
*/

import type { CapabilityRecord } from "@warpgogol/werkstatt-shared/ontology";
import type { AgentActionRef } from "./manifest.ts";
import { capabilityPricingProjection } from "./capability-schema.ts";

export type { CapabilityRecord } from "@warpgogol/werkstatt-shared/ontology";

/**
 * Capability record as serialized into `agent-capabilities.generated.{json,yaml}`
 * by `agent.routes.generate` — RFC-1186 stamps `formBinding.formId` onto bound
 * capabilities so the runtime gate can tag `IntegrationEvent.payload.formId`
 * with the same discriminator the web form path sends (RFC-0827). The catalog
 * schema itself stays strict; this is the site-serialized shape only.
 */
export interface SiteBoundCapabilityRecord extends CapabilityRecord {
  formBinding?: { formId?: string };
}

export interface ResolveActiveCapabilitiesInput {
  catalog: CapabilityRecord[];
  /** Resolved entitlement feature ids (e.g. from entitlements.generated.yaml). */
  entitlements: string[];
  /** Section archetypes (blocks[].type) that render on some page of the app. */
  renderedSectionTypes: string[];
  /** system.md agent.actionsDisabled — capability ids to withhold even if otherwise active. */
  actionsDisabled: string[];
  /**
   * RFC-1186: capability ids bound via `agentCapability` props on site
   * `send-message` blocks. A `requires.formBinding: true` record activates
   * only when its bound id is present — for `sideEffect: "none"` records the
   * bound id is the `nextAction.capability` sibling, so one block prop
   * activates the submit/apply capability and its preview pair.
   */
  boundCapabilityIds?: string[];
}

/** Pure: gate the closed catalog down to the capabilities active on this site. */
export function resolveActiveCapabilities(
  input: ResolveActiveCapabilitiesInput,
): CapabilityRecord[] {
  const entitlements = new Set(input.entitlements);
  const renderedSections = new Set(input.renderedSectionTypes);
  const disabled = new Set(input.actionsDisabled);
  const bound = new Set(input.boundCapabilityIds ?? []);

  if (!entitlements.has("agent.actions")) return [];

  return input.catalog.filter((cap) => {
    if (disabled.has(cap.id)) return false;
    for (const req of cap.requires.entitlements) {
      if (!entitlements.has(req)) return false;
    }
    for (const section of cap.requires.sections) {
      if (!renderedSections.has(section)) return false;
    }
    if (cap.requires.formBinding === true) {
      const boundId = cap.nextAction?.capability ?? cap.id;
      if (!bound.has(boundId)) return false;
    }
    return true;
  });
}

/** Project one active capability into its manifest AgentActionRef (RFC-0286). */
export function capabilityToActionRef(cap: CapabilityRecord): AgentActionRef {
  const pricing = capabilityPricingProjection(cap);
  return {
    id: cap.id,
    // RFC-1171: canonical action urls live under the versioned namespace; the
    // unversioned path stays alive only as a deprecated alias (manifest
    // deprecations[] + gate-stamped headers).
    url: `/api/agent/v1/actions/${cap.id}`,
    title: cap.title,
    inputSchemaRef: `#/components/schemas/${cap.id}-input`,
    entitlement: "agent.actions",
    // RFC-1169: consumers must distinguish preview ("none") from write actions.
    sideEffect: cap.sideEffect ?? "write",
    // RFC-1212: metered capabilities expose machine-readable pricing — absent
    // for unmetered records (bijective projection, AGM-04 enforces).
    ...(pricing ? { pricing } : {}),
  };
}
