/*
<MODULE_CONTRACT>
<purpose>
  Canonical PBT (property-based testing) helpers for the Werkstatt.
  Provides safe defaults for `fc.assert` (numRuns, maxSkips) and efficient
  arbitraries that avoid the `fc.string().filter()` anti-pattern that causes
  test hangs when the filter regex rejects most generated candidates.
</purpose>
<non-goals>
  <item>Does not wrap every fast-check arbitrary — only the ones that need safety defaults.</item>
  <item>Does not replace `fc.assert` entirely — callers can still use it directly with explicit options.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1070: Create PBT helpers (fcAssert, letterString, composeWord) to prevent filter-induced hangs.</item>
</CHANGE_SUMMARY>
*/

import fc from "fast-check";

// ---------------------------------------------------------------------------
// Default PBT configuration
// ---------------------------------------------------------------------------

/** Default number of property runs. fast-check default is 100; we use 50 for speed. */
export const DEFAULT_NUM_RUNS = 50;

/**
 * Default max pre-condition skips per run.
 * fast-check default is 100. We keep it at 100 — this covers `fc.pre()` failures,
 * NOT `.filter()` rejections (which have no limit and are the real hang cause).
 * The hang prevention comes from using `letterString`/`composeWord` instead of
 * `fc.string().filter()`, plus the vitest `testTimeout: 30_000` safety net.
 */
export const DEFAULT_MAX_SKIPS_PER_RUN = 100;

// ---------------------------------------------------------------------------
// fcAssert — safe wrapper around fc.assert with defaults
// ---------------------------------------------------------------------------

export interface FcAssertOptions {
  numRuns?: number;
  maxSkipsPerRun?: number;
}

/**
 * Wraps `fc.assert` with safe defaults: `numRuns: 50`, `maxSkipsPerRun: 100`.
 * Callers can override either value.
 *
 * Note: `maxSkipsPerRun` only covers `fc.pre()` pre-condition failures.
 * It does NOT cover `.filter()` rejections on arbitraries — those have no
 * limit and are the primary cause of test hangs. Use `letterString` or
 * `composeWord` instead of `fc.string().filter()` to avoid this entirely.
 *
 * @example
 * fcAssert(fc.property(letterString, (word) => { ... }));
 * fcAssert(fc.property(letterString, (word) => { ... }), { numRuns: 100 });
 */
export function fcAssert<T>(property: fc.IProperty<T>, options?: FcAssertOptions): void {
  fc.assert(property, {
    numRuns: options?.numRuns ?? DEFAULT_NUM_RUNS,
    maxSkipsPerRun: options?.maxSkipsPerRun ?? DEFAULT_MAX_SKIPS_PER_RUN,
  });
}

// ---------------------------------------------------------------------------
// Efficient letter-only arbitrary — replaces fc.string().filter(/^\p{L}+$/u)
// ---------------------------------------------------------------------------

/**
 * Latin + Cyrillic letter characters for efficient generation.
 * Uses `fc.constantFrom` (no filtering) instead of `fc.string().filter()`.
 */
const LETTER_CHARS = [
  // Latin lowercase
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  // Latin uppercase
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  // Cyrillic lowercase (Ukrainian + Russian)
  "а",
  "б",
  "в",
  "г",
  "д",
  "е",
  "ж",
  "з",
  "и",
  "і",
  "к",
  "л",
  "м",
  "н",
  "о",
  "п",
  "р",
  "с",
  "т",
  "у",
  "ф",
  "х",
  "ц",
  "ч",
  "ш",
  "щ",
  "ь",
  "ю",
  "я",
  "ї",
  "є",
  "ґ",
  // Cyrillic uppercase
  "А",
  "Б",
  "В",
  "Г",
  "Д",
  "Е",
  "Ж",
  "З",
  "И",
  "І",
  "К",
  "Л",
  "М",
  "Н",
  "О",
  "П",
  "Р",
  "С",
  "Т",
  "У",
  "Ф",
  "Х",
  "Ц",
  "Ч",
  "Ш",
  "Щ",
  "Ь",
  "Ю",
  "Я",
  "Ї",
  "Є",
  "Ґ",
];

const letterArb = fc.constantFrom(...LETTER_CHARS);

/**
 * Generates strings consisting only of letters (Latin + Cyrillic).
 * Efficient: uses `fc.constantFrom` + `fc.array` — no filtering.
 *
 * @example
 * const word = letterString(1, 5); // 1-5 letter word
 * fcAssert(fc.property(word, (w) => /^\p{L}+$/u.test(w)));
 */
export function letterString(minLength = 1, maxLength = 10): fc.Arbitrary<string> {
  return fc.array(letterArb, { minLength, maxLength }).map((arr) => arr.join(""));
}

// ---------------------------------------------------------------------------
// composeWord — builds words with guaranteed structure (no filter needed)
// ---------------------------------------------------------------------------

export interface ComposeWordOptions {
  minLength?: number;
  maxLength?: number;
}

/**
 * Generates words with a guaranteed `letter + separator + letter` structure.
 * Eliminates the need for `fc.string().filter()` when testing pattern-based rules.
 *
 * @example
 * const curlyAposWord = composeWord("\u2019"); // e.g. "ім'я"
 * const modAposWord = composeWord("\u02BC");   // e.g. "імʼя"
 */
export function composeWord(separator: string, options?: ComposeWordOptions): fc.Arbitrary<string> {
  const min = options?.minLength ?? 1;
  const max = options?.maxLength ?? 5;
  return fc
    .tuple(letterString(min, max), letterString(min, max))
    .map(([a, b]) => `${a}${separator}${b}`);
}

// ---------------------------------------------------------------------------
// safeText — bounded-length string for negative tests (no filter needed)
// ---------------------------------------------------------------------------

/**
 * Generates random strings with a max length for negative property tests.
 * Use when the property should NOT fire on arbitrary text — the test verifies
 * that no findings are produced. The `maxLength` bound prevents excessive
 * string generation time.
 *
 * @example
 * fcAssert(fc.property(safeText(80), (text) => runRule("TYPO-XX", text).length === 0));
 */
export function safeText(maxLength = 80): fc.Arbitrary<string> {
  return fc.string({ maxLength });
}
