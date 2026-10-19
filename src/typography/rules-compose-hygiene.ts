/*
<MODULE_CONTRACT>
<purpose>Compose-hygiene text rules (ADR-0116). Locale phrase tables for the
small recurring vocabulary of "later / after approval / coming soon" promises
(COMP-PROMISE-01, error) and site-format self-description disclaimers
(COMP-SELFDESC-01, warning). Rules operate on TextSegment objects produced by
the text-surface extractor; per-page/per-locale caps for SELFDESC are enforced
by the typography.validate adapter, which owns cross-file aggregation.</purpose>
<non-goals>
  <item>Do not understand intent — tables recognize the narrow defect vocabulary only.</item>
  <item>Do not scan navigation hrefs or dist output — chrome.data.validate and dist.serialization-leakage.validate own those.</item>
  <item>Do not handle the copyHygiene opt-out — the adapter reads blocks[].copyHygiene per file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>ADR-0116: created — COMP-PROMISE-01 + COMP-SELFDESC-01 with ru/uz/de/en phrase tables.</item>
  <item>ADR-0116: compose-hygiene rules — COMP-PROMISE-01/COMP-SELFDESC-01 on typography.validate, COMP-I18N-01 lang-switcher on chrome.data.validate, DIST-LEAK-10 NEED_THIS_* placeholders on dist.serialization-leakage.validate</item>
</CHANGE_SUMMARY>
*/

import type { TextSegment } from "./text-surface.ts";
import { finding, type TypographyFinding, type TypographyRule } from "./rules-tier1.ts";

// ---------------------------------------------------------------------------
// Locale phrase tables — deliberately narrow vocabulary (ADR-0116).
// New phrasings are added as data, not logic.
// ---------------------------------------------------------------------------

export const PROMISE_PHRASES: Record<string, readonly RegExp[]> = {
  ru: [
    /появ[^\s]{0,12}\s+после/giu,
    /после\s+(согласовани[^\s]{0,12}|утверждени[^\s]{0,12})/giu,
    /скоро\s+(здесь\s+)?(появ[^\s]{0,12}|будет|откро[^\s]{0,12})/giu,
    /появ[^\s]{0,12}[^.\n]{0,40}\sпозже/giu,
  ],
  uz: [
    /tez\s+orada/giu,
    /kelgusida\s+(joylanadi|qo'shiladi|paydo[^\s]{0,12})/giu,
    /keyin\s+(joylanadi|qo'shiladi)/giu,
    /(kelishilgandan|tasdiqlangandan)\s+so.{0,2}ng/giu,
    /keyinroq\s+(paydo|joylanadi|qo'shiladi|bo[^\s]{0,6}ladi)/giu,
  ],
  de: [
    /(bald|demn[aä]chst|in\s+k[uü]rze)\s+(hier\s+)?(verf[uü]gbar|erscheinen|kommt|folgt)/giu,
    /nach\s+(der\s+)?(freigabe|absprache|genehmigung)/giu,
  ],
  en: [
    /coming\s+soon/giu,
    /will\s+(appear|be\s+added)\s+(here|soon)/giu,
    /after\s+(approval|sign[-\s]?off|confirmation)/giu,
  ],
};

export const SELFDESC_PHRASES: Record<string, readonly RegExp[]> = {
  ru: [
    /информационн[^\s]{0,12}\s+(характер|сайт|портал|ресурс)/giu,
    /продаж[^\s]{0,12}\s+через\s+сайт\s+не\s+вед[её]тся/giu,
    /без\s+продаж[^\s]{0,12}\s+через\s+сайт/giu,
    /нет\s+заказов[,\s]/giu,
  ],
  uz: [/sayt\s+orqali\s+savdo\s+(amalga\s+oshirilmaydi|yo'q)/giu, /axborot\s+(sayti|xarakter)/giu],
  de: [
    /rein\s+informativ/giu,
    /kein(er)?\s+(verkauf|online-verkauf)/giu,
    /keine\s+(preise|bestell[^\s]{0,12})/giu,
  ],
  en: [
    /informational\s+(only|site|purposes)/giu,
    /no\s+(sales|orders|prices)\s+(via|through|on|are)/giu,
  ],
};

function phrasesFor(table: Record<string, readonly RegExp[]>, locale: string): readonly RegExp[] {
  return table[locale] ?? table[locale.split("-")[0]] ?? [];
}

// ---------------------------------------------------------------------------
// COMP-PROMISE-01: copy must not promise future content or restate pending
// internal approvals — obligations live in the decision ledger, not in copy.
// ---------------------------------------------------------------------------

const promise01: TypographyRule = {
  id: "COMP-PROMISE-01",
  family: "PROMISE",
  tier: 3,
  severity: "error",
  check(segment: TextSegment, _ctx): TypographyFinding[] {
    const findings: TypographyFinding[] = [];
    for (const regex of phrasesFor(PROMISE_PHRASES, segment.locale)) {
      regex.lastIndex = 0;
      for (const match of segment.text.matchAll(regex)) {
        findings.push(
          finding(
            "COMP-PROMISE-01",
            segment,
            match[0],
            match.index ?? 0,
            `Copy promises future content or a pending approval ("${match[0]}") — obligations belong in the decision ledger, not visitor-facing copy.`,
            "Remove the promise phrase; track pending work in the decision ledger / composition-report.md instead.",
          ),
        );
      }
    }
    return findings;
  },
};

// ---------------------------------------------------------------------------
// COMP-SELFDESC-01: site-format disclaimers ("informational only", "no sales")
// may appear at most once per page and on at most two pages per locale —
// repetition displaces the information the visitor came for. The per-file /
// per-locale caps are enforced by the typography.validate adapter.
// ---------------------------------------------------------------------------

const selfdesc01: TypographyRule = {
  id: "COMP-SELFDESC-01",
  family: "SELFDESC",
  tier: 3,
  severity: "warning",
  check(segment: TextSegment, _ctx): TypographyFinding[] {
    const findings: TypographyFinding[] = [];
    for (const regex of phrasesFor(SELFDESC_PHRASES, segment.locale)) {
      regex.lastIndex = 0;
      for (const match of segment.text.matchAll(regex)) {
        findings.push(
          finding(
            "COMP-SELFDESC-01",
            segment,
            match[0],
            match.index ?? 0,
            `Site-format self-description ("${match[0]}") — allowed once per page and on at most two pages per locale.`,
            "Keep one calm statement; move repetition out of copy.",
          ),
        );
      }
    }
    return findings;
  },
};

export const COMPOSE_HYGIENE_RULES: readonly TypographyRule[] = [promise01, selfdesc01];
