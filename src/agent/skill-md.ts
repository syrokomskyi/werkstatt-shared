/*
<MODULE_CONTRACT>
<purpose>
Agent Skills SKILL.md projection for the agent surface. Pure, dependency-free
formatter that renders one agentskills-conformant SKILL.md document per public
knowledge domain — the artifact ARD catalog entries reference with
`text/markdown; profile="urn:air:agent-skills"`. No I/O — the kernel command
loads the manifest and passes refs here.
</purpose>
<non-goals>
  <item>Do not read files — callers load and pass the knowledge refs.</item>
  <item>Do not inline knowledge payloads — SKILL.md teaches the agent where and how to fetch the canonical JSON document.</item>
  <item>Do not emit timestamps or markers — output must stay byte-deterministic (AS-7, DNA-58) and pass public surface lint.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial SKILL.md projection — per-domain agent-skill documents backing ARD whitelist-typed catalog entries.</item>
</CHANGE_SUMMARY>
*/

import type { AgentKnowledgeRef } from "./manifest.ts";
import { toAbsoluteUrl } from "../semantic/ids.ts";

/** Well-known directory hosting the agentskills index and per-domain skills. */
export const AGENT_SKILLS_DIR = "/.well-known/agent-skills";

/** ARD-whitelisted media type for an Agent Skills markdown artifact. */
export const AGENT_SKILL_MD_TYPE = 'text/markdown; profile="urn:air:agent-skills"';

/** Public path of a knowledge domain's SKILL.md document. */
export function knowledgeSkillMdPath(domain: string): string {
  return `${AGENT_SKILLS_DIR}/${domain}/SKILL.md`;
}

/**
 * Pure: render one SKILL.md for a knowledge domain. Deterministic — depends
 * only on the ref, site name, and base URL.
 *
 * Constraints honored (public.surface.lint PUBTXT rules apply to every public
 * markdown artifact): LF endings, no HTML tags, no markdown links to non-public
 * targets, no `{token}` content references.
 */
export function buildKnowledgeSkillMd(
  ref: AgentKnowledgeRef,
  input: { siteName: string; baseUrl: string },
): string {
  const endpoint = toAbsoluteUrl(input.baseUrl, ref.url);
  const title = `${ref.domain.charAt(0).toUpperCase()}${ref.domain.slice(1)}`;
  return `---
name: ${ref.domain}
description: Canonical ${ref.domain}-domain knowledge for ${input.siteName} — fetch the JSON endpoint for the current structured document.
metadata:
  schema: ${ref.schema}
  endpoint: ${endpoint}
---

# ${title} knowledge

Canonical machine-readable knowledge for the \`${ref.domain}\` domain of \`${input.siteName}\`.

## Resource

- Endpoint: \`${endpoint}\`
- Content type: \`application/json\`
- Schema: \`${ref.schema}\`

## When to use this skill

Use this skill when an agent needs ${ref.domain} facts about ${input.siteName} — for example to answer questions that require canonical structured ${ref.domain} data — instead of scraping HTML pages.

## How to use

1. Fetch the endpoint with an HTTP GET; no authentication is required.
2. Parse the JSON document according to the schema identifier above.
3. Treat the returned document as the canonical source for this domain.
`;
}
