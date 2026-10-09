/*
<MODULE_CONTRACT>
<purpose>RFC-1241 (Verbund V05 / spec v0.1.4, VID-015): first-touch UTM
acquisition context for website-ingress/v1. Captures the landing `utm_*`
parameters into sessionStorage on first sight (never overwrites), reads them
back at form-submit time, and validates the block against the contract shape
— schema const + exactly six charset-bounded keys, no extra properties.
The browser is the only layer that observes `location.search`; storage is
injected so the module stays runtime-agnostic and node-testable.</purpose>
<non-goals>
  <item>Do not persist across sessions — sessionStorage only, never cookies
        or localStorage (RFC-1198 cookie-free posture; dies with the tab).</item>
  <item>Do not send partial or malformed blocks — absence means "no
        acquisition context", matching the hub's silent-strip semantics.</item>
  <item>Do not record platform click ids — the contract charset makes them
        inexpressible by design (additionalProperties: false).</item>
  <item>Do not enumerate campaign semantics — utm_* values are opaque
        producer data; metads owns the phase→outcome interpretation.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1241: initial implementation — capture/read/validate for the
        optional `acquisition` field on website-ingress/v1.</item>
  <item>RFC-1241: Verbund V05 — emit acquisition-context on website-ingress (first-touch UTM)

RFC-1241: sessionStorage-captured first-touch utm_* flows
browser -> send-message -> IntegrationEvent.payload.acquisition ->
lagebild destination adapter -> website-ingress/v1 acquisition field.
Producer validates the contract shape at every edge; malformed degrades
to absent, never a dispatch error. contract_version stays 1.

- shared: acquisition.ts (capture/read/isValid, storage-injected)
- ingress: IngressSubmitInput.acquisition -> wire field
- adapter: validated pass-through of payload.acquisition
- site: SendMessageRequestSchema.acquisition + client attach +
  api re-validation + site-wide capture mount in layout-component
- codegen repin v0.1.3 -> v0.1.4 (VID-016 republication); generated
  types unchanged in shape, new sourceHash
- conformance: emitted acquisition + emitted ingress surface validated
  per snapshot (82 tests, 5 snapshots)</item>
  <item>RFC-1249: wire werkstatt.commands.validate into packages.check + retire CMD-OUTPUT debt</item>
</CHANGE_SUMMARY>
*/

import type { AcquisitionContext } from "./lagebild-contracts.types.generated.ts";

/**
 * Minimal storage surface — injected so the module never touches `window`
 * directly (testable in node; callers pass `sessionStorage` in the browser).
 */
export interface AcquisitionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Wire charset per acquisition-context/v1 — `^[A-Za-z0-9._:-]{1,80}$`. */
export const UTM_VALUE_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;

export const ACQUISITION_SCHEMA_ID = "acquisition-context/v1" as const;
export const ACQUISITION_STORAGE_KEY = "wg_acquisition_v1";

/** Contract-sanctioned placeholder for a declared-but-uncaptured key (V05 handoff). */
export const ACQUISITION_MISSING_VALUE = "-";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
] as const;

function sanitize(value: string | null): string {
  return value !== null && UTM_VALUE_PATTERN.test(value) ? value : ACQUISITION_MISSING_VALUE;
}

/**
 * Structural validator shared by every producer edge (api route, destination
 * adapter, tests): `schema` const + exactly the six `utm_*` keys, each a
 * charset-valid string — nothing else.
 */
export function isValidAcquisitionContext(value: unknown): value is AcquisitionContext {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.schema !== ACQUISITION_SCHEMA_ID) return false;
  const keys = Object.keys(record);
  if (keys.length !== 1 + UTM_KEYS.length) return false;
  for (const key of UTM_KEYS) {
    if (typeof record[key] !== "string" || !UTM_VALUE_PATTERN.test(record[key] as string)) {
      return false;
    }
  }
  return true;
}

/**
 * First-touch capture: when the landing URL carries a charset-valid
 * `utm_source` and no earlier capture exists in `storage`, persists the full
 * block. Absent/invalid secondary keys (`utm_medium`, `utm_campaign`,
 * `utm_term`, `utm_content`, `utm_id`) become the `-` sentinel — the contract
 * requires all six keys even though real campaigns rarely send all six.
 * Without `utm_source` there is no acquisition context at all: nothing stored.
 * Existing storage content (even corrupt) is never overwritten — first-touch.
 */
export function captureAcquisition(
  search: string | URLSearchParams,
  storage: AcquisitionStorage,
): void {
  try {
    if (storage.getItem(ACQUISITION_STORAGE_KEY) !== null) return;
    const params = typeof search === "string" ? new URLSearchParams(search) : search;
    const source = params.get("utm_source");
    if (source === null || !UTM_VALUE_PATTERN.test(source)) return;
    const block: AcquisitionContext = {
      schema: ACQUISITION_SCHEMA_ID,
      utm_source: source,
      utm_medium: sanitize(params.get("utm_medium")),
      utm_campaign: sanitize(params.get("utm_campaign")),
      utm_term: sanitize(params.get("utm_term")),
      utm_content: sanitize(params.get("utm_content")),
      utm_id: sanitize(params.get("utm_id")),
    };
    storage.setItem(ACQUISITION_STORAGE_KEY, JSON.stringify(block));
  } catch {
    // sessionStorage may throw (privacy mode, quota) — capture is best-effort;
    // a failed capture means "no acquisition" downstream, never an error.
  }
}

/**
 * Read back the stored block. Returns `undefined` on missing, unparseable, or
 * structurally invalid content — corrupt values self-heal on the next
 * UTM-tagged landing only when the key is absent; a corrupt entry counts as
 * captured (first-touch wins over self-repair).
 */
export function readAcquisition(storage: AcquisitionStorage): AcquisitionContext | undefined {
  try {
    const raw = storage.getItem(ACQUISITION_STORAGE_KEY);
    if (raw === null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isValidAcquisitionContext(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
