/*
<MODULE_CONTRACT>
<purpose>Pure-text source-scanning primitives shared by checks.commands.generate (werkstatt-site) and werkstatt.commands.validate (werkstatt-engine): masked scanning with template-depth tracking, definition anchors for both `: KernelCommandDefinition` and `… satisfies KernelCommandDefinition`, the suspect-file signal, and the forbidden invisible-codepoint gate (RFC-1304).</purpose>

<non-goals>
  <item>Does not read the filesystem — every function operates on already-loaded source text; consumers own IO.</item>
  <item>Does not extract definition fields beyond anchors — the site generator keeps its own name/execute/contract extraction.</item>
  <item>Does not produce diagnostics — callers map scan results to their own rule ids (CMDGEN-04/05).</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>The suspect-file signal is anchored to definition shape — an annotation-position KernelCommandDefinition token or a top-level literal carrying an execute/command field. A bare `command:`/`KernelCommandDefinition` text match would false-positive on pipeline step descriptors, interface fields, and helper signatures (measured: 25 files in checks/, 85 in engine/src).</item>
  <item>Masked source keeps braces outside strings/comments visible so literalEnd can pair them; template ${ } regions are masked opaque but depth-tracked, so inner backticks inside an interpolation can no longer desync the outer template (the RFC-1295 silent-drop defect).</item>
  <item>NON_COMMAND_ALLOWLIST lives here so the generator and the validator apply the identical exemption set — divergence would re-report allowlisted files from the engine side.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1304: initial implementation — maskSource lifted from checks/commands-generate.ts and extended with template-depth tracking; new findDefinitionAnchors (satisfies form), fileHasCommandSignal, scanForbiddenCodepoints; NON_COMMAND_ALLOWLIST moved here for consumer parity.</item>
  <item>RFC-1304 review r1: positional signal pairing (unpairedCommandSignals) — an anchor consumes the annotation/shaped signal at its index and the satisfies tail after its literal end, so hybrid `: T = {…} satisfies KCD` counts once while literal-less `factory() satisfies KCD` stays suspect; CMDGEN_IGNORE_RE is line-anchored and tested against the keepComments mask so pragma text inside string literals cannot suppress; definition-field probe requires field position (prev char `{`/`,`) so ternary branches do not shape a literal.</item>
</CHANGE_SUMMARY>
*/

/**
 * Invisible/control codepoints forbidden in command sources (RFC-1304 CMDGEN-05):
 * Unicode category Cc minus the source whitelist (tab, LF, CR), category Cf
 * (format characters: soft hyphen, ZWSP/ZWNJ/ZWJ, bidi controls, tag chars, …),
 * plus the invisible Zs separators NBSP, FIGURE/THIN/HAIR SPACE, and NNBSP.
 * Printable non-ASCII (umlauts, Cyrillic, CJK, typographic punctuation) is not
 * covered — the gate is codepoint-class based, not ASCII-only.
 */
const FORBIDDEN_CODEPOINT_RANGES: readonly (readonly [number, number])[] = [
  [0x0000, 0x0008], // C0 minus tab (0x09)
  [0x000b, 0x000c], // VT, FF — LF (0x0a) and CR (0x0d) stay whitelisted
  [0x000e, 0x001f], // C0 remainder
  [0x007f, 0x009f], // DEL + C1
  [0x00ad, 0x00ad], // SOFT HYPHEN
  [0x0600, 0x0605], // Arabic format controls
  [0x061c, 0x061c], // ARABIC LETTER MARK
  [0x06dd, 0x06dd], // ARABIC END OF AYAH
  [0x070f, 0x070f], // SYRIAC ABBREVIATION MARK
  [0x0890, 0x0891], // ARABIC POUND/PIASTRE MARK ABOVE
  [0x08e2, 0x08e2], // ARABIC DISPUTED END OF AYAH
  [0x180e, 0x180e], // MONGOLIAN VOWEL SEPARATOR
  [0x200b, 0x200f], // ZWSP, ZWNJ, ZWJ, LRM, RLM
  [0x202a, 0x202e], // bidi embeddings and overrides
  [0x2060, 0x2064], // WORD JOINER + invisible operators
  [0x2066, 0x206f], // bidi isolates + deprecated format controls
  [0xfeff, 0xfeff], // ZWNBSP / mid-file BOM (leading BOM exempted at scan time)
  [0xfff9, 0xfffb], // interlinear annotation controls
  [0x110bd, 0x110bd], // KAITHI NUMBER SIGN
  [0x110cd, 0x110cd], // KAITHI NUMBER SIGN ABOVE
  [0x13430, 0x13455], // Egyptian hieroglyph format controls
  [0x1bca0, 0x1bca3], // shorthand format controls
  [0x1d173, 0x1d17a], // musical format controls
  [0xe0001, 0xe0001], // LANGUAGE TAG
  [0xe0020, 0xe007f], // tag characters
];

/** Invisible space separators (Zs) that pass the Cf sweep — named in RFC-1304. */
const FORBIDDEN_SPACE_CODEPOINTS: readonly number[] = [
  0x00a0, // NBSP
  0x2007, // FIGURE SPACE
  0x2009, // THIN SPACE
  0x200a, // HAIR SPACE
  0x202f, // NNBSP
];

const CODEPOINT_NAMES: ReadonlyMap<number, string> = new Map([
  [0x0000, "NUL"],
  [0x0007, "BEL"],
  [0x0008, "BACKSPACE"],
  [0x000b, "VERTICAL TAB"],
  [0x000c, "FORM FEED"],
  [0x001b, "ESCAPE"],
  [0x007f, "DEL"],
  [0x00a0, "NBSP"],
  [0x00ad, "SOFT HYPHEN"],
  [0x061c, "ARABIC LETTER MARK"],
  [0x180e, "MONGOLIAN VOWEL SEPARATOR"],
  [0x2007, "FIGURE SPACE"],
  [0x2009, "THIN SPACE"],
  [0x200a, "HAIR SPACE"],
  [0x200b, "ZERO WIDTH SPACE"],
  [0x200c, "ZERO WIDTH NON-JOINER"],
  [0x200d, "ZERO WIDTH JOINER"],
  [0x200e, "LEFT-TO-RIGHT MARK"],
  [0x200f, "RIGHT-TO-LEFT MARK"],
  [0x202a, "LEFT-TO-RIGHT EMBEDDING"],
  [0x202b, "RIGHT-TO-LEFT EMBEDDING"],
  [0x202c, "POP DIRECTIONAL FORMATTING"],
  [0x202d, "LEFT-TO-RIGHT OVERRIDE"],
  [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
  [0x202f, "NNBSP"],
  [0x2060, "WORD JOINER"],
  [0x2061, "FUNCTION APPLICATION"],
  [0x2062, "INVISIBLE TIMES"],
  [0x2063, "INVISIBLE SEPARATOR"],
  [0x2064, "INVISIBLE PLUS"],
  [0x2066, "LEFT-TO-RIGHT ISOLATE"],
  [0x2067, "RIGHT-TO-LEFT ISOLATE"],
  [0x2068, "FIRST STRONG ISOLATE"],
  [0x2069, "POP DIRECTIONAL ISOLATE"],
  [0xfeff, "BOM/ZWNBSP"],
  [0xe0001, "LANGUAGE TAG"],
]);

function codepointName(cp: number): string {
  return CODEPOINT_NAMES.get(cp) ?? `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

function buildForbiddenSet(): Set<number> {
  const set = new Set<number>();
  for (const [lo, hi] of FORBIDDEN_CODEPOINT_RANGES) {
    for (let cp = lo; cp <= hi; cp++) set.add(cp);
  }
  for (const cp of FORBIDDEN_SPACE_CODEPOINTS) set.add(cp);
  return set;
}

const FORBIDDEN_SET = buildForbiddenSet();

/**
 * Exported constant view of the forbidden set — the single source of truth for
 * both consumers (RFC-1304: "the forbidden-codepoint list lives in one exported
 * constant shared by the generator and the validator").
 */
export const FORBIDDEN_SOURCE_CODEPOINTS: ReadonlySet<number> = FORBIDDEN_SET;

export interface ForbiddenCodepointHit {
  /** UTF-16 index into the source string. */
  offset: number;
  /** Unicode codepoint value. */
  codepoint: number;
  /** Human-readable name or `U+XXXX` fallback. */
  name: string;
  /** 1-based source line at the hit position. */
  line: number;
}

/**
 * Scan raw source for forbidden invisible/control codepoints. Runs before
 * masking — a NUL or zero-width byte must be reported as itself, not as a
 * scanner artifact. A leading BOM (offset 0) is a legitimate file prologue
 * and is exempt; every other occurrence is a hit. Never suppressible.
 */
export function scanForbiddenCodepoints(source: string): ForbiddenCodepointHit[] {
  const hits: ForbiddenCodepointHit[] = [];
  let line = 1;
  for (let i = 0; i < source.length; i++) {
    const offset = i;
    const cp = source.codePointAt(i)!;
    if (cp > 0xffff) i++; // astral codepoints occupy a surrogate pair
    if (cp === 0x0a) {
      line++;
      continue;
    }
    if (cp === 0xfeff && offset === 0) continue;
    if (FORBIDDEN_SET.has(cp)) {
      hits.push({ offset, codepoint: cp, name: codepointName(cp), line });
    }
  }
  return hits;
}

/**
 * Mask strings/comments/regex literals to spaces so brace matching and token
 * scans are not fooled. Newlines are preserved so diagnostics can still map
 * offsets to lines.
 *
 * Template literals are depth-tracked: `${ … }` regions re-enter code mode on a
 * mode stack, so a nested `` ` `` inside an interpolation opens a nested
 * template instead of terminating the outer one (RFC-1304 — the desync that
 * silently dropped definitions). `${` and its closing `}` are masked as
 * template syntax; the expression inside is masked as ordinary code content.
 *
 * `opts.keepComments` leaves `//`/`/*` comment text visible (strings and
 * templates still mask) — for pragma checks that must see real comments but
 * never tokens carried inside string literals.
 */
export function maskSource(src: string, opts?: { keepComments?: boolean }): string {
  const keepComments = opts?.keepComments === true;
  let out = "";
  let i = 0;
  const n = src.length;
  // chars after which "/" opens a regex literal rather than division
  const REGEX_PREFIX_CHARS = new Set("(=,[!&|?:;{}+-*%^~<>".split(""));
  const REGEX_PREFIX_WORDS = new Set([
    "return",
    "typeof",
    "case",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "instanceof",
    "yield",
    "await",
    "do",
    "else",
    "throw",
  ]);
  const lastWord = () => {
    const m = /([A-Za-z_$][\w$]*)[^\w$]*$/.exec(out);
    return m?.[1] ?? "";
  };
  const lastSigChar = () => {
    const m = /(\S)\s*$/.exec(out);
    return m?.[1] ?? "";
  };

  // modeStack: "code" = ordinary scanning; "template" = inside a `…` body.
  // texprStack records the braceDepth at each `${` — a `}` at that depth is
  // the expression closer (template syntax, masked), not a literal brace.
  const modeStack: ("code" | "template")[] = ["code"];
  const texprStack: number[] = [];
  let braceDepth = 0;

  while (i < n) {
    const c = src[i];
    if (modeStack[modeStack.length - 1] === "template") {
      if (c === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "`") {
        out += " ";
        i++;
        modeStack.pop();
        continue;
      }
      if (c === "$" && src[i + 1] === "{") {
        out += "  ";
        i += 2;
        texprStack.push(braceDepth);
        modeStack.push("code");
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i++;
      continue;
    }

    // code mode
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") {
        out += keepComments ? src[i] : " ";
        i++;
      }
    } else if (c === "/" && src[i + 1] === "*") {
      out += keepComments ? "/*" : "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" || keepComments ? src[i] : " ";
        i++;
      }
      out += keepComments && i < n ? "*/" : "  ";
      i += 2;
    } else if (
      c === "/" &&
      src[i + 1] !== "=" &&
      (REGEX_PREFIX_CHARS.has(lastSigChar()) ||
        REGEX_PREFIX_WORDS.has(lastWord()) ||
        lastSigChar() === "")
    ) {
      // regex literal — mask until unescaped / outside a [...] class
      out += " ";
      i++;
      let inClass = false;
      while (i < n) {
        const ch = src[i];
        if (ch === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if (ch === "/" && !inClass) break;
        else if (ch === "\n") break; // unterminated — bail as division fallback
        out += " ";
        i++;
      }
      if (i < n && src[i] === "/") {
        out += " ";
        i++;
        while (i < n && /[a-z]/.test(src[i])) {
          out += " ";
          i++;
        }
      }
    } else if (c === '"' || c === "'") {
      const q = c;
      out += " ";
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += " ";
      i++;
    } else if (c === "`") {
      out += " ";
      i++;
      modeStack.push("template");
    } else if (c === "{") {
      braceDepth++;
      out += c;
      i++;
    } else if (c === "}") {
      if (texprStack.length > 0 && braceDepth === texprStack[texprStack.length - 1]) {
        // closes a ${ expression — template syntax, not a literal brace
        texprStack.pop();
        modeStack.pop();
        out += " ";
        i++;
      } else {
        if (braceDepth > 0) braceDepth--;
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Extract the balanced {...} literal starting at `openIdx` in masked source. */
export function literalEnd(masked: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < masked.length; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Return [start,end) offsets of a top-level field's value inside a masked literal. */
export function fieldOffsets(litMasked: string, field: string): [number, number] | undefined {
  const m = new RegExp(`\\b${field}\\s*:`).exec(litMasked);
  if (!m) return undefined;
  // Do NOT skip whitespace here — masked string values are spaces, so skipping
  // would overshoot to the next comma. Slice raw and trim instead.
  const start = m.index + m[0].length;
  let i = start;
  let depth = 0;
  for (; i < litMasked.length; i++) {
    const c = litMasked[i];
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") {
      if (depth === 0) break;
      depth--;
    } else if (c === "," && depth === 0) break;
  }
  return [start, i];
}

export interface DefinitionAnchor {
  /** The `export const <name>` identifier. */
  exportName: string;
  /** Index of the `export` keyword in masked source. */
  index: number;
  /** Index of the definition object's opening `{` in masked source. */
  openIdx: number;
  /**
   * `annotated`: `export const x: KernelCommandDefinition = {`.
   * `satisfies`: `export const x = { … } satisfies KernelCommandDefinition` —
   * the annotation sits behind the literal, so the anchor is proven only after
   * the literal balances.
   */
  kind: "annotated" | "satisfies";
}

const ANNOTATED_DEF_RE =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*:\s*KernelCommandDefinition\s*=\s*\{/g;
// Satisfies form: `export const x(: OtherType)? = { … } satisfies KernelCommandDefinition`
// — the literal precedes the annotation, so the anchor is proven by the tail.
const SATISFIES_HEAD_RE = /export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^{=]+)?=\s*\{/g;
const SATISFIES_TAIL_RE = /\s*satisfies\s+KernelCommandDefinition\b(?![\w$.])/y;

/**
 * Find `KernelCommandDefinition` object literals in masked source. Accepts the
 * colon-annotated form and the postfix `satisfies` form (RFC-1304). Anchors are
 * sorted by source position. Convention-bound to `export const` — `export let`
 * and `export { x }` barreled forms are not anchors (the corpus is uniform).
 */
export function findDefinitionAnchors(masked: string): DefinitionAnchor[] {
  const anchors: DefinitionAnchor[] = [];
  const annotatedIdx = new Set<number>();
  for (const m of masked.matchAll(ANNOTATED_DEF_RE)) {
    annotatedIdx.add(m.index);
    anchors.push({
      exportName: m[1],
      index: m.index,
      openIdx: m.index + m[0].length - 1,
      kind: "annotated",
    });
  }
  for (const m of masked.matchAll(SATISFIES_HEAD_RE)) {
    if (annotatedIdx.has(m.index)) continue; // colon-annotated def already anchored
    const openIdx = m.index + m[0].length - 1;
    const end = literalEnd(masked, openIdx);
    if (end === -1) continue; // unbalanced — the suspect-file signal reports it
    SATISFIES_TAIL_RE.lastIndex = end;
    if (SATISFIES_TAIL_RE.test(masked)) {
      anchors.push({ exportName: m[1], index: m.index, openIdx, kind: "satisfies" });
    }
    SATISFIES_TAIL_RE.lastIndex = 0;
  }
  return anchors.sort((a, b) => a.index - b.index);
}

// Annotation-position tokens: an `export const x: KernelCommandDefinition =`
// (any initializer) — the `=` requirement excludes type usages like
// `KernelCommandDefinition[]` arrays. Counted per occurrence so a file can
// pair each token with its anchor (REVIEW-CODE-2026-10-16-03 finding 01).
const ANNOTATION_SIGNAL_RE = /export\s+const\s+[A-Za-z_$][\w$]*\s*:\s*KernelCommandDefinition\s*=/g;
// Postfix `satisfies` tokens anywhere — covers `= f() satisfies KCD` factory
// forms that carry no object literal at all.
const SATISFIES_SIGNAL_RE = /\bsatisfies\s+KernelCommandDefinition\b(?![\w$.])/g;
// Top-level object literals — `export const x = {`, `export const x: T = {`,
// `export default {`. A depth-1 `execute:`/`command:` field makes the literal
// definition-shaped; deeper fields (pipeline step `command:` props, interface
// members) do not count.
const TOP_LITERAL_HEAD_RE =
  /export\s+(?:const\s+[A-Za-z_$][\w$]*\s*(?::[^={]*)?=\s*|default\s*)\{/g;

/** Last significant (non-space) char before `idx`, or "" at file start. */
function prevSigChar(masked: string, idx: number): string {
  for (let j = idx - 1; j >= 0; j--) {
    const ch = masked[j];
    if (ch !== " " && ch !== "\n" && ch !== "\t" && ch !== "\r") return ch;
  }
  return "";
}

function literalHasDefinitionField(masked: string, openIdx: number): boolean {
  let depth = 1;
  for (let i = openIdx + 1; i < masked.length && depth >= 1; i++) {
    const ch = masked[i];
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      if (depth < 1) break;
    } else if (depth === 1) {
      const fm = /^[A-Za-z_$][\w$]*\s*:/.exec(masked.slice(i, i + 64));
      if (fm) {
        // Field names must sit in field position — after `{` or `,`. A `?`/`:`
        // predecessor means a ternary branch or label, not a property.
        const prev = prevSigChar(masked, i);
        if (prev === "{" || prev === ",") {
          const field = /^[A-Za-z_$][\w$]*/.exec(fm[0])![0];
          if (field === "execute" || field === "command") return true;
        }
        i += fm[0].length - 1;
      }
    }
  }
  return false;
}

export interface CommandSignalReport {
  /** Definition evidence that did not resolve to an extracted anchor. */
  unpaired: number;
  /** Breakdown of the unpaired evidence, for diagnostic detail. */
  unpairedAnnotated: number;
  unpairedSatisfies: number;
  unpairedShaped: number;
  /** Offset of the first unpaired signal, or -1 when fully paired. */
  firstOffset: number;
}

/**
 * Pair definition-shaped evidence against extracted anchors (RFC-1304
 * CMDGEN-04). Pairing is positional: an anchor consumes the annotation or
 * shaped-literal signal at its own `index` and the `satisfies` token directly
 * following its literal's end — so a hybrid `: T = {…} satisfies KCD` def
 * counts once, while `export const x = factory() satisfies KCD` (no literal at
 * all) stays unpaired and suspect.
 */
export function unpairedCommandSignals(
  masked: string,
  anchors: readonly DefinitionAnchor[],
): CommandSignalReport {
  const annotatedAt = new Set<number>();
  const satisfiesAt: number[] = [];
  const shapedAt = new Set<number>();
  for (const m of masked.matchAll(ANNOTATION_SIGNAL_RE)) {
    annotatedAt.add(m.index);
  }
  for (const m of masked.matchAll(SATISFIES_SIGNAL_RE)) {
    satisfiesAt.push(m.index);
  }
  for (const m of masked.matchAll(TOP_LITERAL_HEAD_RE)) {
    if (literalHasDefinitionField(masked, m.index + m[0].length - 1)) {
      shapedAt.add(m.index);
    }
  }
  const pairedSatisfies = new Set<number>();
  for (const anchor of anchors) {
    annotatedAt.delete(anchor.index);
    shapedAt.delete(anchor.index);
    const end = literalEnd(masked, anchor.openIdx);
    if (end === -1) continue;
    SATISFIES_TAIL_RE.lastIndex = end;
    const tm = SATISFIES_TAIL_RE.exec(masked);
    SATISFIES_TAIL_RE.lastIndex = 0;
    if (tm) pairedSatisfies.add(end + tm[0].indexOf("satisfies"));
  }
  const unpairedSatisfiesAt = satisfiesAt.filter((o) => !pairedSatisfies.has(o));
  const report: CommandSignalReport = {
    unpairedAnnotated: annotatedAt.size,
    unpairedSatisfies: unpairedSatisfiesAt.length,
    unpairedShaped: shapedAt.size,
    unpaired: annotatedAt.size + unpairedSatisfiesAt.length + shapedAt.size,
    firstOffset: -1,
  };
  for (const off of [...annotatedAt, ...unpairedSatisfiesAt, ...shapedAt]) {
    if (report.firstOffset === -1 || off < report.firstOffset) {
      report.firstOffset = off;
    }
  }
  return report;
}

/**
 * Heuristic probe (RFC-1304 CMDGEN-04): does the masked source carry any
 * command-definition evidence — annotation-position token, postfix satisfies,
 * or a definition-shaped top-level literal — regardless of pairing. Used by
 * the site-exports seam so a suspect (unextractable) definition still keeps
 * its file out of the exports map.
 */
export function fileHasCommandSignal(masked: string): boolean {
  ANNOTATION_SIGNAL_RE.lastIndex = 0;
  if (ANNOTATION_SIGNAL_RE.test(masked)) return true;
  SATISFIES_SIGNAL_RE.lastIndex = 0;
  if (SATISFIES_SIGNAL_RE.test(masked)) return true;
  for (const m of masked.matchAll(TOP_LITERAL_HEAD_RE)) {
    if (literalHasDefinitionField(masked, m.index + m[0].length - 1)) {
      return true;
    }
  }
  return false;
}

/**
 * File-level pragma exempting a file from the CMDGEN-04 suspect net — must be
 * a line comment at line start (`// cmdgen-ignore`); a string literal carrying
 * the token does not suppress. Never suppresses CMDGEN-05.
 */
export const CMDGEN_IGNORE_RE = /^[ \t]*\/\/[ \t]*cmdgen-ignore/m;

/**
 * Files under src/checks that export run* handlers or carry command-shaped
 * literals but legitimately hold no KernelCommandDefinition (module entry,
 * shared helpers, non-command runners). Shared by checks.commands.generate
 * (CMDGEN-01/04) and werkstatt.commands.validate (CMDGEN-04) so both scanners
 * exempt the identical set — keys are paths relative to src/checks/.
 */
export const NON_COMMAND_ALLOWLIST: ReadonlySet<string> = new Set([
  "module.ts",
  "structure/naming-convention.ts",
  "semantic-mirror.ts",
  "content-idempotency.ts",
  "checks/mirroring.ts",
  "check-warpgogol/commands/flag-schema-helpers.ts",
  "check-warpgogol/commands/evidence-readers.ts",
]);
