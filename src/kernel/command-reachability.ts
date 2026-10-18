/*
<MODULE_CONTRACT>
<purpose>RFC-1334: structural command reachability — invocation-literal scanning over source text (pipeline step objects, const tables, dispatch calls, commandName/validator fields, switch labels) plus computeCommandReachability, shared by command.manifest.generate (reachableVia) and command.coverage.validate.</purpose>
<non-goals>
  <item>Does not read the filesystem — callers pass loaded source text.</item>
  <item>Does not record documentation mentions — those are command.coverage.validate's local concern.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>Edges are structural only: pipeline, invoker, coverage — mentions never enter the committed manifest.</item>
  <item>Edges sort by kind then ref and carry no timestamps, so the manifest stays deterministic.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1334: initial implementation — invocation scanning moved from command.coverage.validate; computeCommandReachability.</item>
  <item>RFC-1334: steps 1-3 — shared structural reachability, reachableVia in the command manifest, coverage validator on the shared scan</item>
  <item>RFC-1334: steps 1-3 — shared structural reachability, manifest reachableVia, shared coverage scan</item>
</CHANGE_SUMMARY>
*/

/** Source trees scanned for literal invocations (forge modules live under os/). */
export const INVOKER_SOURCE_GLOBS = ["packages/*/src/**/*.ts", "packages/forge/os/**/*.ts"];

/** Const names whose initializer arrays/sets/objects list command names. */
const CONST_TABLE_RE =
  /(?:export\s+)?const\s+[A-Z0-9_]*(?:_STEPS|_PIPELINE|_COMMANDS|_VALIDATORS|_MAPPINGS)[A-Z0-9_]*\b/g;

const FIELD_INVOKE_RES = [
  /\bcommandName\s*:\s*["']([^"']+)["']/g,
  /\bvalidator\s*:\s*["']([^"']+)["']/g,
  /\bfixCommand\s*:\s*["']([^"']+)["']/g,
  // switch-dispatch on command names (e.g. mission step tables route by
  // `case "mission.validate":` — the label is the invocation).
  /\bcase\s+["']([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+)["']\s*:/g,
];

const CALL_DISPATCH_RE = /\b(?:executeKernelCommand|runCommandSequence|runPipeline)\s*\(/g;

const STRING_LITERAL_RE = /["'`]([^"'`]+)["'`]/g;

/** Segments that hold test/fixture/template text — references, never invocations. */
export const SKIP_DIR_RE =
  /(^|\/)(?:node_modules|dist|coverage|reports|test-fixtures|fixtures|__tests__|tests|templates)\//;

/** Remove // line comments and /* *\/ blocks without touching string literals. */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  let state: "code" | "line" | "block" | "string" = "code";
  let stringChar = "";
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        state = "string";
        stringChar = ch;
        out += ch;
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (state === "line") {
      if (ch === "\n") {
        state = "code";
        out += ch;
      }
      i += 1;
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      if (ch === "\n") out += ch;
      i += 1;
      continue;
    }
    out += ch;
    if (ch === "\\") {
      if (i + 1 < source.length) out += source[i + 1];
      i += 2;
      continue;
    }
    if (ch === stringChar) state = "code";
    i += 1;
  }
  return out;
}

/** Extract every "..."-style string literal inside a source span. */
function stringLiteralsIn(span: string): string[] {
  const values: string[] = [];
  for (const match of span.matchAll(STRING_LITERAL_RE)) values.push(match[1]!);
  return values;
}

/**
 * Return the initializer span of each `const NAME_<suffix>` declaration:
 * from the `=` to the terminating `;` at bracket depth 0.
 */
function constTableSpans(source: string): string[] {
  const spans: string[] = [];
  for (const match of source.matchAll(CONST_TABLE_RE)) {
    let i = match.index + match[0].length;
    // Skip an optional type annotation up to the `=`.
    while (i < source.length && source[i] !== "=" && source[i] !== "\n") i += 1;
    if (source[i] !== "=") continue;
    i += 1;
    const start = i;
    let depth = 0;
    let inString: string | null = null;
    for (; i < source.length; i += 1) {
      const ch = source[i]!;
      if (inString) {
        if (ch === "\\") i += 1;
        else if (ch === inString) inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") inString = ch;
      else if (ch === "(" || ch === "[" || ch === "{") depth += 1;
      else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
      else if (ch === ";" && depth === 0) break;
    }
    spans.push(source.slice(start, i));
  }
  return spans;
}

/** String literals inside a dispatch call-expression span (bounded by paren depth). */
function callArgSpans(source: string): string[] {
  const spans: string[] = [];
  for (const match of source.matchAll(CALL_DISPATCH_RE)) {
    let i = match.index + match[0].length;
    const start = i;
    let depth = 1;
    let inString: string | null = null;
    for (; i < source.length; i += 1) {
      const ch = source[i]!;
      if (inString) {
        if (ch === "\\") i += 1;
        else if (ch === inString) inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") inString = ch;
      else if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    spans.push(source.slice(start, i));
  }
  return spans;
}

/**
 * Collect the command names invoked by a source file's text. `inPipelineDir`
 * widens the scan to `{ command: "x" }` step objects — that field shape only
 * carries invocation semantics inside pipeline declarations (RFC-1243 risk
 * note: lint-rule `command:` tables elsewhere are references, not calls).
 */
export function invocationsInSource(source: string, inPipelineDir: boolean): Set<string> {
  const invoked = new Set<string>();
  const clean = stripComments(source);

  for (const re of FIELD_INVOKE_RES) {
    for (const match of clean.matchAll(re)) invoked.add(match[1]!);
  }
  if (inPipelineDir) {
    for (const match of clean.matchAll(/\bcommand\s*:\s*["']([^"']+)["']/g)) {
      invoked.add(match[1]!);
    }
  }
  for (const span of constTableSpans(clean)) {
    for (const literal of stringLiteralsIn(span)) {
      invoked.add(literal);
      // argv-tailed dispatch strings (`commands.push("sites-check.run --site x")`):
      // the first whitespace token carries the command name.
      invoked.add(literal.split(/\s/, 1)[0]!);
    }
  }
  for (const span of callArgSpans(clean)) {
    for (const literal of stringLiteralsIn(span)) {
      invoked.add(literal);
      invoked.add(literal.split(/\s/, 1)[0]!);
    }
  }
  return invoked;
}

export type ReachabilityKind = "pipeline" | "invoker" | "coverage";

export interface ReachabilityEdge {
  kind: ReachabilityKind;
  /** Pipeline name, invoking file, or coverage class. */
  ref: string;
}

/** True when a repo-relative source path is an invocation surface (not test/generated/fixture). */
export function isInvokerSource(rel: string): boolean {
  const normalized = rel.replace(/\\/g, "/");
  return !(
    normalized.includes(".test.") ||
    normalized.includes(".generated.") ||
    SKIP_DIR_RE.test(normalized)
  );
}

const KIND_ORDER: Record<ReachabilityKind, number> = { pipeline: 0, invoker: 1, coverage: 2 };

/** Structural reachability per registered command, sorted deterministically. */
export function computeCommandReachability(input: {
  commands: Array<{ name: string; pipelines?: string[]; coverage?: string | null }>;
  sources: ReadonlyMap<string, string>;
}): Map<string, ReachabilityEdge[]> {
  const registered = new Set(input.commands.map((c) => c.name));
  const edges = new Map<string, ReachabilityEdge[]>();
  for (const c of input.commands) edges.set(c.name, []);
  for (const c of input.commands) {
    for (const p of c.pipelines ?? []) edges.get(c.name)!.push({ kind: "pipeline", ref: p });
    if (c.coverage) edges.get(c.name)!.push({ kind: "coverage", ref: c.coverage });
  }
  for (const [rel, text] of input.sources) {
    for (const name of invocationsInSource(text, rel.includes("/pipelines/"))) {
      if (registered.has(name)) edges.get(name)!.push({ kind: "invoker", ref: rel });
    }
  }
  for (const [name, list] of edges) {
    const seen = new Set<string>();
    edges.set(
      name,
      list
        .filter((e) => {
          const key = `${e.kind}\u0000${e.ref}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.ref.localeCompare(b.ref)),
    );
  }
  return edges;
}
