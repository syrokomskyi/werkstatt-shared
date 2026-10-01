/***************************************************************
<MODULE_CONTRACT>
<purpose>
  RFC-1178: defines the `werkstatt` named Trusted Types policy — the
  allowlist anchor for `trusted-types werkstatt` and the only sanctioned
  channel for minting trusted values once `require-trusted-types-for
  'script'` is emitted. Policy creation runs at module eval so it precedes
  every sink write the orchestrator dispatches; this module is statically
  imported by orchestrator.ts and MUST never move behind a dynamic import
  or a lazy feature initializer.
</purpose>
<non-goals>
  <item>Never create a `default` policy — a default sanitizes arbitrary strings silently and defeats the audit; `default` never appears in the trusted-types allowlist (RFC-1178).</item>
  <item>No `@types/trusted-types` dependency — a minimal local declaration suffices for the policy surface.</item>
  <item>Does not sanitize HTML — creators accept only platform-branded inputs minted by ttHTML/ttScriptURL; unbranded input throws.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1178: initial implementation — werkstatt named policy with provenance-branded createHTML/createScriptURL creators and a feature-detected no-op fallback.</item>
</CHANGE_SUMMARY>
***************************************************************/

// Minimal Trusted Types surface — per RFC-1178 no @types/trusted-types dep.
interface WerkstattTrustedTypePolicy {
  createHTML(input: unknown): unknown;
  createScriptURL(input: unknown): unknown;
}
interface WerkstattTrustedTypesFactory {
  createPolicy(
    name: string,
    rules: {
      createHTML?(input: unknown): string;
      createScriptURL?(input: unknown): string;
    },
  ): WerkstattTrustedTypePolicy;
}

const tt = (globalThis as { trustedTypes?: WerkstattTrustedTypesFactory }).trustedTypes;

/**
 * Provenance brand — only values wrapped by {@link ttHTML}/{@link ttScriptURL}
 * inside this module can pass the creators; arbitrary strings throw. This is
 * what keeps the `werkstatt` policy from degenerating into a pass-through.
 */
const BRAND: unique symbol = Symbol("werkstatt-tt");
type Branded<T extends string> = { [BRAND]: true; value: T };

function brand<T extends string>(value: T): Branded<T> {
  return { [BRAND]: true, value };
}
function unbranded<T extends string>(input: Branded<T> | unknown): T {
  if (typeof input === "object" && input !== null && (input as Branded<T>)[BRAND] === true) {
    return (input as Branded<T>).value;
  }
  throw new TypeError(
    "werkstatt Trusted Types policy: refusing unbranded input — mint it via ttHTML()/ttScriptURL() so the call site is auditable.",
  );
}

/**
 * The `werkstatt` policy. `undefined` where Trusted Types are unsupported —
 * the CSP `trusted-types werkstatt` allowlist entry is then inert, matching
 * the feature-detect contract.
 */
function createWerkstattPolicy(): WerkstattTrustedTypePolicy | undefined {
  try {
    return tt?.createPolicy("werkstatt", {
      createHTML: (input) => unbranded<string>(input),
      createScriptURL: (input) => unbranded<string>(input),
    });
  } catch (err) {
    // A `trusted-types` CSP directive that does not name `werkstatt` makes
    // createPolicy throw — degrade to no-policy instead of killing the
    // orchestrator chunk at eval; sinks then fail closed at the write site.
    console.warn("[werkstatt] trusted-types policy creation failed:", err);
    return undefined;
  }
}

export const werkstattPolicy: WerkstattTrustedTypePolicy | undefined = createWerkstattPolicy();

/**
 * Mint a trusted HTML value for a sanctioned sink. At ship time no call site
 * uses these wrappers — they are the enforced extension point: a future
 * first-party `innerHTML` writer must route through `ttHTML` so every trusted
 * value traces to an audited call site.
 */
export function ttHTML(html: string): unknown {
  if (!werkstattPolicy) return html;
  return werkstattPolicy.createHTML(brand(html));
}

/** Mint a trusted script URL for a sanctioned sink. */
export function ttScriptURL(url: string): unknown {
  if (!werkstattPolicy) return url;
  return werkstattPolicy.createScriptURL(brand(url));
}
