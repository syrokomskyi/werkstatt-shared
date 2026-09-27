/*
<MODULE_CONTRACT>
<purpose>RFC-0570 formula evaluation module — extracts numeric values from field strings,
scans text for =(...) formula expressions, and evaluates arithmetic over content references
using a sandboxed math parser (expr-eval). RFC-0729: pipe syntax for post-evaluation formatting,
plugin-registration formatter registry, and money formatter built on Intl.NumberFormat.</purpose>
<non-goals>
  <item>Do not resolve content references directly — use resolveReference from @warpgogol/werkstatt-shared/content/content-reference.</item>
  <item>Do not support non-arithmetic expressions (string concatenation, conditionals, date math).</item>
  <item>Do not add formatters other than money and duration — date, percent, unit formatters are follow-up RFCs.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0729: Add pipe syntax for post-evaluation formatting, formatter registry, and money formatter.</item>
  <item>RFC-0730: Add formatRecurrence utility for ISO 8601 duration → locale-specific suffix mapping.</item>
  <item>RFC-0731: Add sourceRef optional parameter for this. self-reference expansion in formulas.</item>
  <item>RFC-1156: Add duration pipe formatter (ISO 8601 → locale prose via Intl.DurationFormat) with raw-input single-ref passthrough.</item>
  <item>RFC-1156: duration-case extension — `case=` param (nominative|accusative|genitive|dative) on the duration pipe, CLDR word-table backend for non-nominative long forms.</item>
  <history>RFC-0570</history>
</CHANGE_SUMMARY>
*/

import { Parser } from "expr-eval";
import type { ContentRefIndex, SourceRef } from "../content/content-reference.ts";
import { resolveReference } from "../content/content-reference.ts";
import {
  formatBusinessDays,
  formatDuration,
  parseIsoDuration,
  type DurationCase,
} from "./duration.ts";

export interface FormulaResolution {
  value: string;
  resolved: boolean;
  error?: string;
}

export interface FormulaMatch {
  start: number;
  end: number;
  expression: string;
}

export type PipeFormatter = (
  value: number | string,
  params: Record<string, string>,
  context: PipeFormatterContext,
) => string;

export interface PipeFormatterContext {
  lang: string;
  defaultLang: string;
}

interface PipeFormatterEntry {
  formatter: PipeFormatter;
  /** "raw" formatters (RFC-1156 duration) receive the resolved value untouched;
   *  "numeric" formatters receive the evaluated number (extractNumeric path). */
  input: "raw" | "numeric";
}

const pipeFormatterRegistry = new Map<string, PipeFormatterEntry>();

export function registerPipeFormatter(
  name: string,
  formatter: PipeFormatter,
  options?: { input?: "raw" | "numeric" },
): void {
  pipeFormatterRegistry.set(name, {
    formatter,
    input: options?.input ?? "numeric",
  });
}

export function getPipeFormatter(name: string): PipeFormatter | undefined {
  return pipeFormatterRegistry.get(name)?.formatter;
}

registerPipeFormatter("money", (value, params, context) => {
  const currency = params.currency ?? "EUR";
  const locale = params.locale ?? context.lang;
  const targetCurrency = params.targetCurrency;
  const rate = params.rate ? Number(params.rate) : undefined;

  let amount = typeof value === "number" ? value : Number(value);
  let code = currency;
  if (targetCurrency && rate !== undefined && Number.isFinite(rate)) {
    amount = amount * rate;
    code = targetCurrency;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
});

// RFC-1156: `=(ref | duration)` — ISO 8601 duration → locale-aware prose.
// input:"raw" passes the resolved string through untouched (see resolveFormula).
registerPipeFormatter(
  "duration",
  (value, params, context) => {
    const ALLOWED_PARAMS = new Set(["locale", "style", "dayType", "case"]);
    for (const key of Object.keys(params)) {
      if (!ALLOWED_PARAMS.has(key)) {
        throw new Error(`duration: unknown param "${key}"`);
      }
    }
    const locale = params.locale || context.lang || context.defaultLang || "de";
    const style = params.style ?? "long";
    if (style !== "long" && style !== "short") {
      throw new Error(`duration: invalid style "${style}" (expected long|short)`);
    }
    const dayType = params.dayType;
    if (dayType !== undefined && dayType !== "business") {
      throw new Error(`duration: invalid dayType "${dayType}" (expected business)`);
    }
    const grammaticalCase = (params.case ?? "nominative") as DurationCase;
    if (!["nominative", "accusative", "genitive", "dative"].includes(grammaticalCase)) {
      throw new Error(
        `duration: invalid case "${grammaticalCase}" (expected nominative|accusative|genitive|dative)`,
      );
    }
    const parts = parseIsoDuration(value);
    if (!parts) {
      throw new Error(`duration: value "${String(value)}" is not an ISO 8601 duration`);
    }
    if (dayType === "business") {
      const nonDay = { ...parts, days: 0 };
      if (parts.days === 0 || Object.values(nonDay).some((v) => v > 0)) {
        throw new Error("duration: dayType=business requires a pure-days duration");
      }
      return formatBusinessDays(parts.days, locale, grammaticalCase);
    }
    return formatDuration(parts, locale, style, grammaticalCase);
  },
  { input: "raw" },
);

const parser = new Parser();

const REF_IN_FORMULA_PATTERN = /[a-z][a-z-]*\.[a-z0-9-/]+\.[a-zA-Z0-9_.-]+/g;
const THIS_IN_FORMULA_PATTERN = /this\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*/g;
const THIS_PREFIX = "this.";

const FORMULA_PREFIX = "=(";

/**
 * Extracts a numeric value from a field string.
 * Handles: leading number, thin-space (\u202f) / period / comma thousands separators,
 * comma decimal separator (German), negative numbers.
 * Strips non-numeric prefix/suffix.
 * Returns null for non-numeric values.
 */
export function extractNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  // Remove currency symbols, units, and non-numeric prefix/suffix
  // Keep: digits, period, comma, minus, plus, thin space, regular space
  const cleaned = trimmed
    .replace(/^[^0-9\-+]+/, "") // strip non-numeric prefix
    .replace(/[^0-9.,\-\u202f\s+]+$/, "") // strip non-numeric suffix
    .replace(/\u202f/g, "") // thin space thousands separator
    .replace(/\s/g, "") // regular space thousands separator
    .trim();

  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;

  // Detect format: if both period and comma are present, period=thousands, comma=decimal (German)
  // If only comma is present, it's a decimal separator (German)
  // If only period is present, it's a decimal separator (English)
  let normalized: string;
  const hasPeriod = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  if (hasPeriod && hasComma) {
    // Period = thousands, comma = decimal (German format: 1.040,50)
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Comma = decimal (German format: 70,50)
    normalized = cleaned.replace(",", ".");
  } else if (hasPeriod) {
    // Period only: could be thousands (German: 1.040) or decimal (English: 70.50)
    // Heuristic: if the period is followed by exactly 3 digits and nothing after,
    // treat as thousands separator. Otherwise treat as decimal.
    const periodIndex = cleaned.lastIndexOf(".");
    const afterPeriod = cleaned.slice(periodIndex + 1);
    if (/^\d{3}$/.test(afterPeriod) && cleaned.indexOf(".") === periodIndex) {
      // Single period followed by exactly 3 digits → thousands separator
      normalized = cleaned.replace(/\./g, "");
    } else {
      normalized = cleaned;
    }
  } else {
    normalized = cleaned;
  }

  const result = Number.parseFloat(normalized);
  return Number.isFinite(result) ? result : null;
}

/**
 * Scans text for =(...) formula patterns using a paren-depth counter
 * to handle nested parentheses: =(a + (b * c)) is matched correctly.
 * Returns an array of { start, end, expression } for each formula found.
 * Fast path: returns [] immediately if text does not contain "=(".
 */
export function scanFormulas(text: string): FormulaMatch[] {
  if (!text.includes(FORMULA_PREFIX)) return [];

  const matches: FormulaMatch[] = [];
  let i = 0;

  while (i < text.length - 1) {
    // Look for "=(" prefix
    if (text[i] === "=" && text[i + 1] === "(") {
      const start = i;
      let depth = 1;
      let j = i + 2;

      while (j < text.length && depth > 0) {
        if (text[j] === "(") {
          depth++;
        } else if (text[j] === ")") {
          depth--;
        }
        j++;
      }

      if (depth === 0) {
        const expression = text.slice(start + 2, j - 1);
        matches.push({ start, end: j, expression });
        i = j;
      } else {
        // Unbalanced parens — skip this match
        i = start + 1;
      }
    } else {
      i++;
    }
  }

  return matches;
}

/**
 * Evaluates a formula expression after substituting all content references.
 * Uses expr-eval for sandboxed arithmetic.
 * RFC-0729: Supports pipe syntax `arithmetic | formatter key=value` for post-evaluation formatting.
 * Returns { value, resolved, error? } with REF-06..10 error codes.
 */
export function resolveFormula(
  index: ContentRefIndex,
  expression: string,
  lang: string,
  defaultLang: string,
  sourceRef?: SourceRef,
): FormulaResolution {
  const pipeIndex = expression.indexOf("|");
  const hasPipe = pipeIndex !== -1;
  const arithmeticExpr = hasPipe ? expression.slice(0, pipeIndex) : expression;
  const formatterSpec = hasPipe ? expression.slice(pipeIndex + 1) : "";

  // Parsed early (RFC-1156): raw-input formatters must be identified BEFORE the
  // reference loop, because extractNumeric would mangle ISO strings ("P30D"→30).
  const specTokens = formatterSpec
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  const formatterName = specTokens[0] ?? "";
  const formatterWantsRaw =
    formatterName !== "" && pipeFormatterRegistry.get(formatterName)?.input === "raw";

  // RFC-0731: Expand this. references before REF_IN_FORMULA_PATTERN matching
  let expandedArithmeticExpr = arithmeticExpr;
  if (sourceRef && arithmeticExpr.includes(THIS_PREFIX)) {
    const thisPattern = new RegExp(THIS_IN_FORMULA_PATTERN.source, "g");
    expandedArithmeticExpr = expandedArithmeticExpr.replace(thisPattern, (match) => {
      const fieldPath = match.slice(THIS_PREFIX.length);
      return `${sourceRef.collection}.${sourceRef.file}.${fieldPath}`;
    });
  } else if (!sourceRef && arithmeticExpr.includes(THIS_PREFIX)) {
    return {
      value: "",
      resolved: false,
      error: `REF-12: this. reference used without sourceRef context`,
    };
  }

  // Find all content references in the arithmetic expression
  const refs: string[] = [];
  const refPattern = new RegExp(REF_IN_FORMULA_PATTERN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = refPattern.exec(expandedArithmeticExpr)) !== null) {
    const candidate = match[0];
    const collectionMatch = candidate.match(/^([a-z][a-z-]*)\./);
    if (!collectionMatch) continue;
    const collection = collectionMatch[1];
    if (!index.entries[collection]) continue;
    refs.push(candidate);
  }

  // Resolve each reference and extract numeric value
  let substitutedExpression = expandedArithmeticExpr;
  let rawPipeValue: string | undefined;

  for (const ref of refs) {
    const result = resolveReference(index, ref, lang, defaultLang);
    if (!result.resolved) {
      return {
        value: "",
        resolved: false,
        error: `REF-06: Formula reference unresolved: ${ref}`,
      };
    }

    // RFC-0723: If the expression is a single reference (no arithmetic, no pipe),
    // return the string value directly — enables =(ref) for string interpolation.
    // This must be checked BEFORE extractNumeric to avoid extracting numbers from
    // string values like "Fertig in 12 Werktagen" → 12.
    if (!hasPipe && refs.length === 1 && expandedArithmeticExpr.trim() === ref) {
      return {
        value: String(result.value),
        resolved: true,
      };
    }

    // RFC-1156: single-ref + raw-input pipe → pass the resolved string through
    // untouched; ISO durations like "P30D" must reach the formatter intact.
    if (formatterWantsRaw && refs.length === 1 && expandedArithmeticExpr.trim() === ref) {
      rawPipeValue = String(result.value);
      continue;
    }

    const numeric = extractNumeric(result.value);
    if (numeric === null) {
      return {
        value: "",
        resolved: false,
        error: `REF-07: Formula operand not numeric: ${ref} resolved to "${String(result.value)}"`,
      };
    }

    substitutedExpression = substitutedExpression.replaceAll(ref, String(numeric));
  }

  // Evaluate the arithmetic expression — skipped when a raw-input formatter
  // captured the single reference above (RFC-1156).
  let evaluatedValue: number | string | undefined = rawPipeValue;
  if (rawPipeValue === undefined) {
    try {
      const expr = parser.parse(substitutedExpression);
      const evaluated = expr.evaluate();

      if (typeof evaluated !== "number" || !Number.isFinite(evaluated)) {
        // Check for division by zero (expr-eval returns Infinity, not an error)
        if (typeof evaluated === "number" && !Number.isFinite(evaluated)) {
          return {
            value: "",
            resolved: false,
            error: `REF-09: Formula division by zero: ${expression}`,
          };
        }
        return {
          value: "",
          resolved: false,
          error: `REF-08: Formula produced non-numeric result: ${expression}`,
        };
      }

      // No pipe — return numeric string as before (RFC-0570, RFC-0723)
      if (!hasPipe) {
        return {
          value: String(evaluated),
          resolved: true,
        };
      }
      evaluatedValue = evaluated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes("divide") && message.includes("zero")) {
        return {
          value: "",
          resolved: false,
          error: `REF-09: Formula division by zero: ${expression}`,
        };
      }

      return {
        value: "",
        resolved: false,
        error: `REF-08: Formula syntax error: ${message}`,
      };
    }
  }

  // RFC-0729/1156: Apply pipe formatter (numeric result or raw single-ref value).
  const formatter = getPipeFormatter(formatterName);
  if (!formatter) {
    return {
      value: "",
      resolved: false,
      error: `REF-10: Unknown pipe formatter: ${formatterName}`,
    };
  }

  const params: Record<string, string> = {};
  for (const token of specTokens.slice(1)) {
    const eqIndex = token.indexOf("=");
    if (eqIndex > 0) {
      params[token.slice(0, eqIndex)] = token.slice(eqIndex + 1);
    }
  }

  const context: PipeFormatterContext = { lang, defaultLang };
  try {
    return {
      value: formatter(evaluatedValue!, params, context),
      resolved: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      value: "",
      resolved: false,
      error: `REF-08: Formula pipe error: ${message}`,
    };
  }
}

const RECURRENCE_SUFFIXES: Record<string, Record<string, string>> = {
  P1M: { de: "/ Monat", uk: "/ місяць" },
  P1Y: { de: "/ Jahr", uk: "/ рік" },
};

export function formatRecurrence(recurrence: string | undefined, lang: string): string {
  if (!recurrence || recurrence.trim() === "") return "";
  const suffixes = RECURRENCE_SUFFIXES[recurrence.trim()];
  if (!suffixes) return "";
  return suffixes[lang] ?? suffixes["de"] ?? "";
}
