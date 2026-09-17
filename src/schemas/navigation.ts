/*
<MODULE_CONTRACT>
<purpose>Maintains packages/share/src/schemas/navigation.ts as an authored share authored module so agents can evolve it without rediscovering local boundaries.</purpose>
<non-goals>
  <item>Do not handle runtime resolution or feature graph integration.</item>
  <item>Do not contain business logic.</item>
  <item>Do not handle backward compatibility (RFC-0046: no backward compatibility needed).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1097: step 6 — compass.migrate codemod run

Mechanical v1 to v2 header migration across the workspace: 942 files rewritten — CHANGE_SUMMARY windows collapsed into history, forbidden v1 blocks stripped, KEY_DECISIONS seeded from @ai-invariant comments (5 files) or TODO placeholders (103 files), blocks reordered to canonical order.</item>
  <item>RFC-1097: sweep — werkstatt-engine clean

Sweep batch 4: 73 Compass headers on headerless engine files (certification, component-runtime, isolation, evolution, testing), real KEY_DECISIONS on 75 files (kernel, cache, dht, swim, gitmesh, runtime), ~80 purpose expansions (CONTRACT-02/PURPOSE-02), non-goals on 13 CONTRACT-03 files, CS-07 history literal fix repo-wide (253 files). Policy: .template.ts/.template.astro excludedPaths. werkstatt-engine now 0 diagnostics.</item>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

/**
 * Creates a Zod enum for navigation groups from an array of allowed group names.
 * Apps call this in their content.config.ts or navigation.ts with their specific groups.
 *
 * @param groups - Array of allowed navigation group names for the app
 * @returns Zod enum schema for navigation groups
 */
export function createNavigationGroupEnum(groups: string[]) {
  return z.enum(groups as [string, ...string[]]);
}

// Default groups for backward compatibility with existing apps
export const defaultNavigationGroups = ["navigation", "legal", "contact"] as const;

/**
 * Creates a navigation target schema with configurable group validation.
 *
 * @param groupEnum - Zod enum schema for allowed navigation groups
 * @returns Zod schema for a single navigation target
 */
export const navigationTargetSchema = (groupEnum: z.ZodEnum<Record<string, string>>) =>
  z.object({
    id: z.string(),
    label: z.string(),
    semanticTarget: z.union([
      z.object({
        kind: z.literal("internal"),
        pageId: z.string(),
        // RFC-0048: anchor may be a plain string (language-neutral) or a
        // language-keyed record (e.g. { de: "unser-ansatz", en: "our-approach" })
        anchor: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
      }),
      z.object({
        kind: z.literal("external"),
        href: z.url(),
      }),
    ]),
    routeSlug: z.string().optional(),
    group: groupEnum.optional(),
  });

/**
 * Creates a navigation schema with configurable group validation.
 *
 * @param groupEnum - Zod enum schema for allowed navigation groups
 * @returns Zod schema for the full navigation structure
 */
export const navigationSchema = (groupEnum: z.ZodEnum<Record<string, string>>) =>
  z.object({
    targets: z.array(navigationTargetSchema(groupEnum)),
  });

/**
 * Type helper for navigation target.
 * The group field is loosely typed (string) here; per-app strict validation comes
 * from the runtime Zod schema returned by navigationTargetSchema(groupEnum).
 */
export type NavigationTarget = z.infer<ReturnType<typeof navigationTargetSchema>>;
