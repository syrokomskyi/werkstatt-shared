/*
<MODULE_CONTRACT>
<purpose>
Implements RFC-1185 explicit per-block shared-context inheritance.
A block opts into cross-page prop inheritance by declaring `inherit: <pageId>`.
The resolver performs a single-hop shallow merge — the source block's authored
top-level props first, the consuming block's own top-level keys second (an
authored key replaces the source key wholesale; nested objects are never
recursively merged across pages). Blocks without `inherit` — or with
`inherit: false` — keep only their authored props.
</purpose>
<non-goals>
  <item>Do not read files or Astro collections directly.</item>
  <item>Do not validate propsSchema correctness — that is page.block.validate's job.</item>
  <item>Do not detect collisions or validate inherit targets — that is shared.context.validate's job.</item>
  <item>Do not follow the source block's own `inherit` edge — resolution is a single hop.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1185: explicit per-block inherit edge replaces the RFC-0099 implicit
  priority-order fallback. `collectSharedContextCandidatesByLevel` and
  `buildSharedContextPageOrder` are removed from the public runtime API — the
  migration codemod (`shared.context.migrate` in werkstatt-site) hosts the
  legacy ordering it needs to name effective sources.</item>
</CHANGE_SUMMARY>
*/

export interface SharedContextBlockLike {
  id?: string;
  type?: string;
  use?: string;
  props?: Record<string, unknown>;
  /**
   * Explicit inheritance edge (RFC-1185): a pageId to inherit the matching
   * block's authored props from, or `false` to opt out of a collision group.
   */
  inherit?: string | false;
}

export interface SharedContextPageLike {
  pageId: string;
  blocks: SharedContextBlockLike[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBlockSelector(block: SharedContextBlockLike): string | null {
  return block.type ?? block.use ?? null;
}

/**
 * Canonical shared-context block identity: same `id` and, when both sides
 * declare a selector, the same `type`/`use`. Exported so validators and the
 * migration codemod share one matching rule instead of duplicating it.
 */
export function matchesSharedBlock(
  source: SharedContextBlockLike,
  target: SharedContextBlockLike,
): boolean {
  if (!source.id || !target.id || source.id !== target.id) {
    return false;
  }

  const sourceSelector = getBlockSelector(source);
  const targetSelector = getBlockSelector(target);

  if (sourceSelector && targetSelector) {
    return sourceSelector === targetSelector;
  }

  return true;
}

/**
 * Resolve the effective props for `block` within one language bucket of pages.
 *
 * RFC-1185: inheritance happens only through an explicit `inherit: <pageId>`
 * edge. The source is the matching (`id` + selector) block on the named page —
 * its `inherit` edge is intentionally not followed. The merge is shallow over
 * top-level keys: `{ ...sourceAuthoredProps, ...ownProps }`.
 *
 * Missing source pages, missing matching blocks, and self-edges resolve to the
 * authored props unchanged; those conditions are flagged by
 * `shared.context.validate` (SHARED-CONTEXT-INHERIT-*), not by the resolver.
 */
export function resolveSharedContextProps(options: {
  block: SharedContextBlockLike;
  pages: Map<string, SharedContextPageLike>;
}): Record<string, unknown> {
  const { block, pages } = options;

  const ownProps = isRecord(block.props) ? block.props : {};
  if (typeof block.inherit !== "string" || block.inherit.length === 0 || !block.id) {
    return ownProps;
  }

  const sourcePage = pages.get(block.inherit);
  if (!sourcePage) {
    return ownProps;
  }

  const sourceBlock = sourcePage.blocks.find((candidate) => matchesSharedBlock(candidate, block));
  if (!sourceBlock || !isRecord(sourceBlock.props)) {
    return ownProps;
  }

  return { ...sourceBlock.props, ...ownProps };
}
