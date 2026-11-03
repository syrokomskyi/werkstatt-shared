/*
<MODULE_CONTRACT>
<purpose>
  TypeScript-AST reachability machinery for kernel command source scanning
  (RFC-1303). Extracted from registry-integrity.test.ts so both the test-time
  ratchet and runtime validators (command.manifest.validate's ENV-INPUT-01
  scan) share one implementation — comments, string literals, and template
  text are structurally invisible, and import/re-export/destructured-dynamic
  bindings resolve from real syntax, not regexes.
</purpose>
<non-goals>
  <item>Do not emit diagnostics — this module returns raw facts (slices, bindings, env reads); rule ids live in the consuming validator.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>createSourceScanner(workspaceRoot) returns a per-root scanner — parse/binding/defs caches are scoped to the factory so concurrent fixtures never cross-pollinate.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1303 review: moved to werkstatt-shared/src/node/ (IO-01 — a sync AST scanner cannot take async io; this dir is the designated Node-only helper home). collectEnvReads now returns EnvReadResult with unresolved/truncated coverage stats so consumers can fail loud instead of silently under-scanning.</item>
  <item>RFC-1303: review REVIEW-CODE-2026-10-16-02 — scanner moves to werkstatt-shared/node (IO-01), workpieceEnv hashes into envDigest, saveCache tolerates KERNEL-META-01, ENV-INPUT-02 coverage notice, ratchet path-arg tightening</item>
  <item>RFC-1497: step 2 — deterministic slicing and truncation reporting

visited is keyed by identifier AND remaining depth: an ident first reached at low remaining depth re-resolves when a later path reaches it with more budget, so the slice set no longer depends on which path the DFS took first. ScanStats gains limit (slices|depth|slice-text|dynamic-child) recording the first limit hit; stats.limit is reset per call. Root cause of the observed order flip confirmed and recorded for the review: sequential expects (unresolved -> unguarded -> guarded) masked the already-computed guarded hit set — adding cacheWrites to the gate exempted its own unguarded hit, let the unguarded assert pass, and the guarded assert then surfaced 108 pre-existing hits at git.ts:51. Fixture tests cover AC-4 (identical hit sets forward/reverse/single, deep coverage survives shallow-first reach) and AC-5 (deep re-export chain reports truncated+depth).</item>
  <item>RFC-1497: steps 3-4 — git allowlist model and child-command resolution

READ_ONLY_GIT_QUERIES in workspace-io.ts is the single allowlist both the runtime adapter and the static scan share (DNA-91). In the scan, a call that resolves to forge git() body is exempt only when its argv array literal's leading strings cover an allowlist entry; a scratch re-resolve per callsite keeps already-visited callees independently classified, and one non-allowlisted route flips the git() body slice back to a hit (allowlistedGitEntry on the slice). Child commands are judged by declaration, never by descent: executeKernelCommand/executeRegisteredCommand sit in CALLEE_SKIP, and when the caller passes a childCalls out-param the scanner resolves the name (literal, const string, or for-of over a const string array) through an injected resolveCommandDeclaration; an unresolvable name truncates the scan with limit dynamic-child. The child model is opt-in so env scans stay unmarked. Fixtures cover AC-1 (rev-parse no hit), AC-2 (branch -D hit), AC-3 (no executor descent), AC-8 (mutating child recorded), plus mixed-route and dynamic-name cases.</item>
  <item>RFC-1501: one argv-shaped read-only git allowlist for the recording and read-only adapters (RFC-1501)

READ_ONLY_GIT_QUERIES / isReadOnlyGitQuery replace the recording adapter's
first-argument allowlist; the read-only adapter and the static scan use the same
table. The kernel forwards --dry-run into commands that declare a dry-run flag,
and flow.push / flow.hold dry-runs no longer fetch. The switch-over runbook goes
back to werkstatt run flow.install --dry-run.</item>
  <history>RFC-1303</history>
</CHANGE_SUMMARY>
*/

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

import { matchesReadOnlyGitQuery, READ_ONLY_GIT_QUERIES } from "../kernel/workspace-io.ts";

export interface ParsedFile {
  sf: ts.SourceFile;
  text: string;
}

export interface BindingTarget {
  /** Resolved file for relative/package specs; undefined for node builtins. */
  file?: string;
  /** Member name inside the target file; undefined = whole-module namespace. */
  member?: string;
  /** Raw specifier — retained for builtin (child_process/fs) detection. */
  spec: string;
}

/** A resolved implementation location — pre-guard-analysis. */
export interface ResolvedNode {
  file: string;
  node: ts.Node;
}

export interface HandlerSlice {
  file: string;
  node: ts.Node;
  /**
   * True when every callsite that reached this slice sits inside a try block —
   * a KERNEL-META-01 thrown here is swallowed by the caller, degrading output
   * instead of crashing the command.
   */
  guardedEntry: boolean;
  /**
   * RFC-1497: set only on the slice that IS forge's `git()` body — true while
   * every callsite that reached it passed an argv array whose leading string
   * literals cover a READ_ONLY_GIT_QUERIES entry (the read-only adapter's
   * allowlist). A single non-allowlisted `git(...)` route flips it to false
   * permanently — the io.exec inside flags again.
   */
  allowlistedGitEntry?: boolean;
}

const MAX_RESOLVE_DEPTH = 5;

const CALLEE_SKIP = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "await",
  "new",
  "function",
  "typeof",
  "throw",
  "case",
  "super",
  "constructor",
  "require",
  // RFC-1497: kernel executor entry points are judged by the child's own
  // declaration, never by descending into the executor source — a child's
  // writes are the child's to declare (the ratchet scans it directly).
  "executeKernelCommand",
  "executeRegisteredCommand",
]);

const MAX_SLICES = 64;
const MAX_SLICE_TEXT = 400_000;

/**
 * Scan coverage report — populated by handlerSlices/collectEnvReads when the
 * caller passes a stats object. `unresolved`: execute() could not be found;
 * `truncated`: a depth/slice/size cap cut the walk short — the returned slice
 * set is a lower bound of the real reachability closure (RFC-1303 REVIEW-04).
 */
export interface ScanStats {
  unresolved: boolean;
  truncated: boolean;
  /** Which walk limit cut the scan short — the first limit hit wins. */
  limit?: "slices" | "depth" | "slice-text" | "dynamic-child";
}

export interface EnvReadResult {
  reads: Map<string, { file: string; line: number }>;
  stats: ScanStats;
}

/**
 * RFC-1497: an executeKernelCommand/executeRegisteredCommand call site found
 * in the scanned slices. `command` is the statically resolved child name —
 * present only when the name is a literal/const resolvable AND the injected
 * declaration lookup knows it; a name the scan cannot resolve marks the scan
 * truncated (limit "dynamic-child") instead of passing silently.
 */
export interface ChildCommandCall {
  file: string;
  node: ts.CallExpression;
  command?: string;
  /** Every path into this callsite passed through a try block. */
  guarded: boolean;
}

export interface SourceScannerOptions {
  /**
   * Registry-backed declaration lookup for child-command resolution — the
   * scanner never loads the registry itself (RFC-1497).
   */
  resolveCommandDeclaration?: (name: string) => { mutatesState?: boolean } | undefined;
}

export interface SourceScanner {
  parsedFile: (file: string) => ParsedFile | undefined;
  resolveModuleSpec: (spec: string, fromDir: string) => string | undefined;
  bindingsFor: (file: string) => Map<string, BindingTarget[]>;
  topLevelDefs: (file: string) => Map<string, ts.Node>;
  resolveIdentSlice: (
    ident: string,
    inFile: string,
    depth: number,
    visited: Map<string, number>,
  ) => ResolvedNode | undefined;
  unwrapExpr: (node: ts.Expression) => ts.Expression;
  propNameText: (prop: ts.ObjectLiteralElementLike | ts.ClassElement) => string | undefined;
  constStringValue: (file: string, ident: string) => string | undefined;
  findCommandObject: (file: string, cmdName: string) => ts.ObjectLiteralExpression | undefined;
  executeSlice: (file: string, cmdName: string) => ResolvedNode | undefined;
  isFunctionBoundary: (n: ts.Node) => boolean;
  isExpressionNode: (n: ts.Node) => n is ts.Expression;
  returnValueExprs: (node: ts.Node) => ts.Expression[];
  objectCandidatesFor: (
    expr: ts.Expression,
    file: string,
    visited: Map<string, number>,
    depth: number,
  ) => ResolvedNode[];
  memberBodyNode: (
    candidate: ResolvedNode,
    name: string,
    visited: Map<string, number>,
    depth: number,
  ) => ResolvedNode | undefined;
  deferredMemberNodes: (file: string, node: ts.Node) => Set<ts.Node>;
  handlerSlices: (
    file: string,
    cmdName: string,
    stats?: ScanStats,
    childCalls?: ChildCommandCall[],
  ) => HandlerSlice[];
  isIoReceiver: (expr: ts.Expression) => boolean;
  isGuarded: (node: ts.Node, root: ts.Node) => boolean;
  collectEnvReads: (file: string, cmdName: string) => EnvReadResult;
}

/**
 * RFC-1303: per-workspace-root AST scanner. Caches (parse, bindings, defs)
 * live inside the factory so two scanners over different roots never share
 * stale entries.
 */
export function createSourceScanner(
  workspaceRoot: string,
  options: SourceScannerOptions = {},
): SourceScanner {
  const requireResolve = createRequire(import.meta.url);
  const resolveCommandDeclaration = options.resolveCommandDeclaration;

  const parseCache = new Map<string, ParsedFile | undefined>();
  const parsedFile = (file: string): ParsedFile | undefined => {
    if (parseCache.has(file)) return parseCache.get(file);
    let parsed: ParsedFile | undefined;
    try {
      const text = readFileSync(file, "utf8");
      parsed = {
        text,
        sf: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
      };
    } catch {
      parsed = undefined;
    }
    parseCache.set(file, parsed);
    return parsed;
  };

  /** Resolve a module specifier to an existing .ts file, or undefined. */
  const resolveModuleSpec = (spec: string, fromDir: string): string | undefined => {
    const candidates: string[] = [];
    if (spec.startsWith(".")) {
      const base = resolve(fromDir, spec);
      candidates.push(base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"));
    } else if (!spec.startsWith("node:")) {
      // Package specifiers — workspace exports map straight to src/*.ts.
      try {
        const r = requireResolve.resolve(spec);
        if (r.endsWith(".ts")) candidates.push(r);
      } catch {
        // fall through to the workspace convention
      }
      const pm = /^@warpgogol\/([^/]+)(?:\/(.*))?$/.exec(spec);
      if (pm) {
        const pkgRoot = join(workspaceRoot, "packages", pm[1]);
        const sub = pm[2] ?? "src/index";
        candidates.push(
          join(pkgRoot, "src", `${sub}.ts`),
          join(pkgRoot, "src", sub, "index.ts"),
          join(pkgRoot, "os", `${sub}.ts`),
          join(pkgRoot, `${sub}.ts`),
          join(pkgRoot, sub, "index.ts"),
        );
      }
    }
    return candidates.find((c) => c.endsWith(".ts") && existsSync(c));
  };

  /**
   * Per-file binding index: local name → where it can be resolved.
   * Covers static imports, namespace imports, destructured lazy imports
   * (`const { x } = await import("./y.ts")`), `const m = await import("./y.ts")`
   * namespace bindings, and re-export barrels.
   */
  const bindingCache = new Map<string, Map<string, BindingTarget[]>>();
  const bindingsFor = (file: string): Map<string, BindingTarget[]> => {
    const cached = bindingCache.get(file);
    if (cached) return cached;
    const map = new Map<string, BindingTarget[]>();
    const pf = parsedFile(file);
    if (!pf) {
      bindingCache.set(file, map);
      return map;
    }
    const dir = dirname(file);
    const add = (local: string, spec: string, member?: string) => {
      const list = map.get(local) ?? [];
      const entry: BindingTarget = { spec, member, file: resolveModuleSpec(spec, dir) };
      if (!list.some((e) => e.file === entry.file && e.member === entry.member && e.spec === spec))
        list.push(entry);
      map.set(local, list);
    };
    const asDynamicImport = (node: ts.Expression | undefined): ts.CallExpression | undefined => {
      const unwrapped = node && ts.isAwaitExpression(node) ? node.expression : node;
      if (
        unwrapped &&
        ts.isCallExpression(unwrapped) &&
        unwrapped.expression.kind === ts.SyntaxKind.ImportKeyword &&
        unwrapped.arguments[0] &&
        ts.isStringLiteral(unwrapped.arguments[0])
      )
        return unwrapped;
      if (
        unwrapped &&
        ts.isCallExpression(unwrapped) &&
        ts.isIdentifier(unwrapped.expression) &&
        unwrapped.expression.text === "require" &&
        unwrapped.arguments[0] &&
        ts.isStringLiteral(unwrapped.arguments[0])
      )
        return unwrapped;
      return undefined;
    };

    for (const st of pf.sf.statements) {
      if (
        ts.isImportDeclaration(st) &&
        ts.isStringLiteral(st.moduleSpecifier) &&
        st.importClause &&
        !st.importClause.isTypeOnly
      ) {
        const spec = st.moduleSpecifier.text;
        const clause = st.importClause;
        if (clause.name) add(clause.name.text, spec, "default");
        const nb = clause.namedBindings;
        if (nb && ts.isNamespaceImport(nb)) add(nb.name.text, spec);
        else if (nb && ts.isNamedImports(nb)) {
          for (const el of nb.elements) {
            if (el.isTypeOnly) continue;
            add(el.name.text, spec, el.propertyName?.text ?? el.name.text);
          }
        }
        continue;
      }
      if (
        ts.isExportDeclaration(st) &&
        st.moduleSpecifier &&
        ts.isStringLiteral(st.moduleSpecifier)
      ) {
        const spec = st.moduleSpecifier.text;
        if (!st.exportClause) {
          // export * from "spec" — wildcard frontier
          add("*", spec);
        } else if (ts.isNamespaceExport(st.exportClause)) {
          add(st.exportClause.name.text, spec);
        } else if (ts.isNamedExports(st.exportClause)) {
          for (const el of st.exportClause.elements) {
            if (el.isTypeOnly) continue;
            // local name el.name resolves to member (propertyName ?? name) in target
            add(el.name.text, spec, el.propertyName?.text ?? el.name.text);
          }
        }
        continue;
      }
    }
    // Destructured lazy imports live inside module-factory function bodies, so
    // scan the whole tree for VariableDeclaration nodes, not just top-level
    // statements.
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        const call = asDynamicImport(node.initializer);
        if (call) {
          const spec = (call.arguments[0] as ts.StringLiteral).text;
          if (ts.isObjectBindingPattern(node.name)) {
            for (const el of node.name.elements) {
              if (!ts.isIdentifier(el.name)) continue;
              const member =
                el.propertyName && ts.isIdentifier(el.propertyName)
                  ? el.propertyName.text
                  : el.name.text;
              add(el.name.text, spec, member);
            }
          } else if (ts.isIdentifier(node.name)) {
            add(node.name.text, spec); // const m = await import("x") — namespace
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(pf.sf);
    bindingCache.set(file, map);
    return map;
  };

  /**
   * File-wide name → declaration index. Includes declarations nested inside
   * module-factory bodies (`const wrapper = async () => …` handlers) — first
   * occurrence wins, so a shadowing inner name can mask an outer one, which is
   * acceptable for a structural scan.
   */
  const topDefsCache = new Map<string, Map<string, ts.Node>>();
  const topLevelDefs = (file: string): Map<string, ts.Node> => {
    const cached = topDefsCache.get(file);
    if (cached) return cached;
    const map = new Map<string, ts.Node>();
    const pf = parsedFile(file);
    if (pf) {
      const visit = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node) && node.name && !map.has(node.name.text))
          map.set(node.name.text, node);
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          !map.has(node.name.text)
        )
          map.set(node.name.text, node.initializer ?? node);
        if (ts.isExportAssignment(node) && !map.has("default")) map.set("default", node.expression);
        if (ts.isClassDeclaration(node) && node.name && !map.has(node.name.text))
          map.set(node.name.text, node);
        ts.forEachChild(node, visit);
      };
      visit(pf.sf);
    }
    topDefsCache.set(file, map);
    return map;
  };

  /** The node to scan for a resolved top-level declaration. */
  const scanTargetOf = (node: ts.Node): ts.Node => {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) return node.body ?? node;
    if (ts.isArrowFunction(node)) return node.body;
    if (ts.isVariableDeclaration(node)) return node.initializer ?? node;
    return node;
  };

  /** Resolve an identifier to the node implementing it (local or via imports). */
  const resolveIdentSlice = (
    ident: string,
    inFile: string,
    depth: number,
    visited: Map<string, number>,
  ): ResolvedNode | undefined => {
    if (depth <= 0) {
      depthCapHit = true;
      if (firstLimit === undefined) firstLimit = "depth";
      return undefined;
    }
    const vkey = `${inFile}${ident}`;
    // RFC-1497: visited remembers the REMAINING depth budget a key was
    // resolved with, not just the key — an ident first reached at depth 1
    // must re-resolve when a later path reaches it at depth 4, or the deeper
    // coverage is lost to whichever path the walk happened to take first.
    const seenDepth = visited.get(vkey);
    if (seenDepth !== undefined && seenDepth >= depth) return undefined;
    visited.set(vkey, depth);
    if (!parsedFile(inFile)) return undefined;

    const local = topLevelDefs(inFile).get(ident);
    if (local) return { file: inFile, node: scanTargetOf(local) };

    for (const t of bindingsFor(inFile).get(ident) ?? []) {
      if (!t.file) continue;
      const hit = resolveIdentSlice(t.member ?? ident, t.file, depth - 1, visited);
      if (hit) return hit;
    }
    // export * frontiers
    for (const t of bindingsFor(inFile).get("*") ?? []) {
      if (!t.file) continue;
      const hit = resolveIdentSlice(ident, t.file, depth - 1, visited);
      if (hit) return hit;
    }
    return undefined;
  };

  /** Unwrap expression shells that don't change semantics. */
  const unwrapExpr = (node: ts.Expression): ts.Expression => {
    let cur = node;
    for (;;) {
      if (
        ts.isParenthesizedExpression(cur) ||
        ts.isAsExpression(cur) ||
        ts.isSatisfiesExpression(cur) ||
        ts.isNonNullExpression(cur)
      ) {
        cur = cur.expression;
        continue;
      }
      if (ts.isAwaitExpression(cur)) {
        cur = cur.expression;
        continue;
      }
      return cur;
    }
  };

  /** String value of a property name, if statically known. */
  const propNameText = (
    prop: ts.ObjectLiteralElementLike | ts.ClassElement,
  ): string | undefined => {
    const n = (prop as ts.PropertyAssignment | ts.MethodDeclaration | ts.ClassElement).name;
    if (!n) return undefined;
    if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
    return undefined;
  };

  /** Literal string value for `const X = "..."` initializers in a file. */
  const constStringValue = (file: string, ident: string): string | undefined => {
    const def = topLevelDefs(file).get(ident);
    if (def && ts.isStringLiteral(def)) return def.text;
    return undefined;
  };

  /** The ObjectLiteralExpression that carries `name: "<cmd>"` in this file. */
  const findCommandObject = (
    file: string,
    cmdName: string,
  ): ts.ObjectLiteralExpression | undefined => {
    const pf = parsedFile(file);
    if (!pf) return undefined;
    let found: ts.ObjectLiteralExpression | undefined;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (
        ts.isPropertyAssignment(node) &&
        propNameText(node) === "name" &&
        ts.isObjectLiteralExpression(node.parent)
      ) {
        const init = unwrapExpr(node.initializer);
        const value = ts.isStringLiteral(init)
          ? init.text
          : ts.isIdentifier(init)
            ? constStringValue(file, init.text)
            : undefined;
        if (value === cmdName) found = node.parent;
      }
      ts.forEachChild(node, visit);
    };
    visit(pf.sf);
    return found;
  };

  /** Map an `execute:` initializer expression to the node implementing it. */
  const executeExprSlice = (
    expr: ts.Expression,
    file: string,
    visited: Map<string, number>,
  ): ResolvedNode | undefined => {
    const e = unwrapExpr(expr);
    // execute: runFoo
    if (ts.isIdentifier(e)) return resolveIdentSlice(e.text, file, MAX_RESOLVE_DEPTH, visited);
    // execute: ns.foo / (await import("./x.ts")).foo
    if (ts.isPropertyAccessExpression(e)) {
      const obj = unwrapExpr(e.expression);
      if (ts.isCallExpression(obj) && obj.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const spec = obj.arguments[0];
        if (spec && ts.isStringLiteral(spec)) {
          const target = resolveModuleSpec(spec.text, dirname(file));
          if (target) return resolveIdentSlice(e.name.text, target, MAX_RESOLVE_DEPTH, visited);
        }
        return undefined;
      }
      if (ts.isIdentifier(obj)) {
        for (const t of bindingsFor(file).get(obj.text) ?? []) {
          if (!t.file || t.member !== undefined) continue; // namespace bindings only
          const hit = resolveIdentSlice(e.name.text, t.file, MAX_RESOLVE_DEPTH - 1, visited);
          if (hit) return hit;
        }
      }
      return { file, node: e };
    }
    // execute: async (...) => {...} / (...) => expr
    if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return { file, node: e.body ?? e };
    // execute: factory(...) / conditional / other expression — scan it, callee
    // expansion reaches the factory implementation through call identifiers.
    return { file, node: e };
  };

  /** Locate the execute() implementation for `name: "<cmd>"` in `file`. */
  const executeSlice = (file: string, cmdName: string): ResolvedNode | undefined => {
    const pf = parsedFile(file);
    if (!pf) return undefined;
    const obj = findCommandObject(file, cmdName);
    if (!obj) return undefined;
    const visited = new Map<string, number>();
    for (const prop of obj.properties) {
      if (propNameText(prop) !== "execute") continue;
      if (ts.isMethodDeclaration(prop) && prop.body) return { file, node: prop.body };
      if (ts.isPropertyAssignment(prop)) return executeExprSlice(prop.initializer, file, visited);
    }
    return undefined;
  };

  /**
   * Function-like boundaries whose inner `return` statements belong to the
   * nested closure, not to the enclosing slice's function.
   */
  const isFunctionBoundary = (n: ts.Node): boolean =>
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n) ||
    ts.isConstructorDeclaration(n);

  /** Narrow check for the expression shapes this scanner reasons about. */
  const isExpressionNode = (n: ts.Node): n is ts.Expression =>
    ts.isIdentifier(n) ||
    ts.isCallExpression(n) ||
    ts.isNewExpression(n) ||
    ts.isObjectLiteralExpression(n) ||
    ts.isConditionalExpression(n) ||
    ts.isParenthesizedExpression(n) ||
    ts.isAsExpression(n) ||
    ts.isSatisfiesExpression(n) ||
    ts.isNonNullExpression(n) ||
    ts.isAwaitExpression(n) ||
    ts.isPropertyAccessExpression(n);

  /**
   * Expressions a slice's function can evaluate to: top-level ReturnStatements
   * (nested closures return to themselves, so their bodies are not descended),
   * plus the node itself when the slice is an arrow-expression body
   * (`=> ({...})`).
   */
  const returnValueExprs = (node: ts.Node): ts.Expression[] => {
    if (isExpressionNode(node)) return [node];
    const out: ts.Expression[] = [];
    const visit = (n: ts.Node) => {
      if (n !== node && isFunctionBoundary(n)) return;
      if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
      ts.forEachChild(n, visit);
    };
    visit(node);
    return out;
  };

  /**
   * Object/class values an expression may evaluate to — follows local
   * `const x = f()` initializers, imported/aliased consts, factory-call
   * returns, `new` expressions, and conditional branches. Bounded by `depth`
   * and `visited`; unresolvable receivers contribute nothing.
   */
  const objectCandidatesFor = (
    expr: ts.Expression,
    file: string,
    visited: Map<string, number>,
    depth: number,
  ): ResolvedNode[] => {
    if (depth <= 0) return [];
    const e = unwrapExpr(expr);
    if (ts.isObjectLiteralExpression(e) || ts.isClassDeclaration(e) || ts.isClassExpression(e))
      return [{ file, node: e }];
    if (ts.isConditionalExpression(e))
      return [
        ...objectCandidatesFor(e.whenTrue, file, visited, depth - 1),
        ...objectCandidatesFor(e.whenFalse, file, visited, depth - 1),
      ];
    if ((ts.isCallExpression(e) || ts.isNewExpression(e)) && ts.isIdentifier(e.expression)) {
      const res = resolveIdentSlice(e.expression.text, file, depth - 1, visited);
      if (!res) return [];
      // `new X()` resolves to the class itself; `f()` to the returned values.
      if (ts.isNewExpression(e)) return [res];
      return returnValueExprs(res.node).flatMap((rv) =>
        objectCandidatesFor(rv, res.file, visited, depth - 1),
      );
    }
    if (ts.isIdentifier(e)) {
      const local = topLevelDefs(file).get(e.text);
      if (local) {
        if (isFunctionBoundary(local)) {
          const body = (local as ts.FunctionLikeDeclaration).body ?? (local as ts.Node);
          return returnValueExprs(body).flatMap((rv) =>
            objectCandidatesFor(rv, file, visited, depth - 1),
          );
        }
        if (isExpressionNode(local)) return objectCandidatesFor(local, file, visited, depth - 1);
        return [];
      }
      const res = resolveIdentSlice(e.text, file, depth - 1, visited);
      if (!res) return [];
      // resolveIdentSlice hands back a function body (Block/SourceFile) or a
      // variable initializer (Expression) — normalize both to value candidates.
      if (ts.isBlock(res.node) || ts.isModuleBlock(res.node) || ts.isSourceFile(res.node))
        return returnValueExprs(res.node).flatMap((rv) =>
          objectCandidatesFor(rv, res.file, visited, depth - 1),
        );
      if (isExpressionNode(res.node))
        return objectCandidatesFor(res.node, res.file, visited, depth - 1);
      return [res];
    }
    return [];
  };

  /**
   * Body of member `name` on an object-literal/class candidate. Function-valued
   * members return the implementation body; aliased members (`{ health: impl }`,
   * `{ health }` shorthand) resolve through the binding index; other property
   * initializers are eager values — returned as-is so they stay scannable.
   */
  const memberBodyNode = (
    candidate: ResolvedNode,
    name: string,
    visited: Map<string, number>,
    depth: number,
  ): ResolvedNode | undefined => {
    const { file, node } = candidate;
    const members: readonly (ts.ObjectLiteralElementLike | ts.ClassElement)[] | undefined =
      ts.isObjectLiteralExpression(node)
        ? node.properties
        : ts.isClassDeclaration(node) || ts.isClassExpression(node)
          ? node.members
          : undefined;
    if (!members) return undefined;
    for (const m of members) {
      if (propNameText(m) !== name) continue;
      if (
        ts.isMethodDeclaration(m) ||
        ts.isGetAccessorDeclaration(m) ||
        ts.isSetAccessorDeclaration(m)
      )
        return { file, node: m.body ?? m };
      if (ts.isPropertyDeclaration(m)) {
        const init = m.initializer && unwrapExpr(m.initializer);
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)))
          return { file, node: init.body ?? init };
        return undefined;
      }
      if (ts.isShorthandPropertyAssignment(m)) {
        return resolveIdentSlice(m.name.text, file, depth - 1, visited);
      }
      if (ts.isPropertyAssignment(m)) {
        const init = unwrapExpr(m.initializer);
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
          return { file, node: init.body ?? init };
        if (ts.isIdentifier(init))
          return resolveIdentSlice(init.text, file, depth - 1, visited) ?? { file, node: init };
        return { file, node: m.initializer };
      }
    }
    return undefined;
  };

  /**
   * Function-valued members of object literals the slice's function RETURNS.
   * Creating a closure does not execute it — a returned method becomes reachable
   * only when a caller invokes it (tracked via member-level callee resolution).
   * This keeps factory folds (`resolveAdapter` → `createGitHubPagesAdapter`)
   * from attributing every adapter method's mutations to a command that only
   * calls `adapter.health()`.
   */
  const deferredMemberNodes = (file: string, node: ts.Node): Set<ts.Node> => {
    const out = new Set<ts.Node>();
    const markObject = (obj: ts.ObjectLiteralExpression) => {
      for (const p of obj.properties) {
        if (
          ts.isMethodDeclaration(p) ||
          ts.isGetAccessorDeclaration(p) ||
          ts.isSetAccessorDeclaration(p)
        )
          out.add(p);
        else if (ts.isPropertyAssignment(p)) {
          const init = unwrapExpr(p.initializer);
          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) out.add(init);
        }
      }
    };
    const seenExprs = new Set<ts.Node>();
    const visited = new Map<string, number>();
    const addValue = (expr: ts.Expression | undefined, depth: number) => {
      const e = expr && unwrapExpr(expr);
      if (!e || depth <= 0 || seenExprs.has(e)) return;
      seenExprs.add(e);
      if (ts.isObjectLiteralExpression(e)) markObject(e);
      else if (ts.isConditionalExpression(e)) {
        addValue(e.whenTrue, depth - 1);
        addValue(e.whenFalse, depth - 1);
      } else if (ts.isIdentifier(e)) {
        // `return adapter` — local const or imported binding.
        const local = topLevelDefs(file).get(e.text);
        if (local && isExpressionNode(local)) addValue(local, depth - 1);
        else {
          const res = resolveIdentSlice(e.text, file, depth - 1, visited);
          if (res && ts.isObjectLiteralExpression(res.node)) markObject(res.node);
        }
      }
    };
    for (const rv of returnValueExprs(node)) addValue(rv, MAX_RESOLVE_DEPTH);
    return out;
  };

  /**
   * execute() body plus its reachable callees — local defs AND import-resolved
   * (static, destructured dynamic, namespace, re-export barrels). Bounded by a
   * visited set, a resolution depth cap, and a total-slice cap. Callee slices
   * inherit "guarded" from their callsite: when every path into a callee passes
   * through a try block, a KERNEL-META-01 thrown inside degrades output rather
   * than crashing the command.
   */
  // Set whenever resolveIdentSlice exhausts MAX_RESOLVE_DEPTH — the slice
  // walk then under-covers the real closure. Reset per handlerSlices call;
  // the scanner is synchronous so a factory-scoped flag is safe.
  let depthCapHit = false;
  // RFC-1497: which limit cut the walk first — reported on ScanStats.limit so
  // a truncated scan names its cause instead of passing as a lower bound.
  let firstLimit: ScanStats["limit"];

  const handlerSlices = (
    file: string,
    cmdName: string,
    stats?: ScanStats,
    childCalls?: ChildCommandCall[],
  ): HandlerSlice[] => {
    if (stats) {
      stats.unresolved = false;
      stats.truncated = false;
      stats.limit = undefined;
    }
    depthCapHit = false;
    firstLimit = undefined;
    const noteLimit = (limit: NonNullable<ScanStats["limit"]>): void => {
      if (firstLimit === undefined) firstLimit = limit;
    };
    const root = executeSlice(file, cmdName);
    if (!root) {
      if (stats) stats.unresolved = true;
      return [];
    }
    const rootSlice: HandlerSlice = { ...root, guardedEntry: false };
    const slices: HandlerSlice[] = [rootSlice];
    // key → still reachable only via guarded callsites
    const seen = new Map<string, boolean>([[`${root.file}:${root.node.getStart()}`, false]]);
    // key → forge git() body still reached only via allowlisted callsites
    const gitAllowed = new Map<string, boolean>();
    const visited = new Map<string, number>();
    const queue: HandlerSlice[] = [rootSlice];
    let oversizeSkip = false;
    let dynamicChildHit = false;

    /**
     * RFC-1497: an executeKernelCommand/executeRegisteredCommand call inside a
     * scanned slice. The executor is never descended into — the child is
     * judged by ITS declaration via the injected resolveCommandDeclaration.
     * Name resolution handles a string literal, a `const` string, and a
     * for-of variable bound to a `const` string array in the same slice;
     * anything else truncates the scan with limit "dynamic-child" rather than
     * passing silently. The whole child model is opt-in: without the
     * childCalls out-param (env scans, fixture probes) executor calls are
     * skipped by CALLEE_SKIP with no truncation marking.
     */
    const recordChildCall = (
      call: ts.CallExpression,
      calleeName: string,
      cur: HandlerSlice,
      guarded: boolean,
    ): void => {
      if (!childCalls) return;
      const fail = () => {
        dynamicChildHit = true;
        noteLimit("dynamic-child");
      };
      const arg0 = call.arguments?.[0];
      let nameExpr: ts.Expression | undefined;
      if (calleeName === "executeKernelCommand") {
        // executeKernelCommand({ commandName: <expr>, … })
        if (!arg0 || !ts.isObjectLiteralExpression(unwrapExpr(arg0) ?? arg0)) return fail();
        const obj = unwrapExpr(arg0) as ts.ObjectLiteralExpression;
        for (const p of obj.properties) {
          if (ts.isPropertyAssignment(p) && propNameText(p) === "commandName")
            nameExpr = p.initializer;
        }
      } else {
        // executeRegisteredCommand(<decl>, …) — decl.name carries the child.
        const declArg = arg0 && unwrapExpr(arg0);
        if (!declArg) return fail();
        let declObj: ts.ObjectLiteralExpression | undefined;
        if (ts.isObjectLiteralExpression(declArg)) declObj = declArg;
        else if (ts.isIdentifier(declArg)) {
          const def = topLevelDefs(cur.file).get(declArg.text);
          if (def && ts.isObjectLiteralExpression(def)) declObj = def;
        }
        if (!declObj) return fail();
        for (const p of declObj.properties) {
          if (ts.isPropertyAssignment(p) && propNameText(p) === "name")
            nameExpr = p.initializer;
        }
      }
      if (!nameExpr) return fail();
      const names = childNameValues(nameExpr, cur);
      if (!names || names.length === 0) return fail();
      for (const name of names) {
        const decl = resolveCommandDeclaration?.(name);
        if (!decl) return fail();
        childCalls?.push({ file: cur.file, node: call, command: name, guarded });
      }
    };

    /** Literal/const/for-of-array resolution of a child command name expression. */
    const childNameValues = (expr: ts.Expression, cur: HandlerSlice): string[] | undefined => {
      const e = unwrapExpr(expr);
      if (ts.isStringLiteral(e)) return [e.text];
      if (ts.isIdentifier(e)) {
        const v = constStringValue(cur.file, e.text);
        if (v !== undefined) return [v];
        // for (const x of CONST_ARR) { … x … } — iterate the array's literals.
        const forOf = enclosingForOf(e, cur.node);
        if (forOf) {
          const arrExpr = unwrapExpr(forOf.expression);
          const arrNode = ts.isIdentifier(arrExpr)
            ? topLevelDefs(cur.file).get(arrExpr.text)
            : arrExpr;
          if (arrNode && ts.isArrayLiteralExpression(arrNode)) {
            const out: string[] = [];
            for (const el of arrNode.elements) {
              const elE = unwrapExpr(el);
              if (!ts.isStringLiteral(elE)) return undefined;
              out.push(elE.text);
            }
            return out;
          }
        }
      }
      return undefined;
    };

    /**
     * The ForOfStatement inside `scope` whose loop variable is `ident` and
     * which contains the reference — null when the ident is not a for-of
     * variable inside this slice.
     */
    const enclosingForOf = (ident: ts.Identifier, scope: ts.Node): ts.ForOfStatement | null => {
      let n: ts.Node | undefined = ident.parent;
      while (n && n !== scope) {
        if (ts.isForOfStatement(n)) {
          const decl = n.initializer;
          if (
            ts.isVariableDeclarationList(decl) &&
            decl.declarations.length === 1 &&
            ts.isIdentifier(decl.declarations[0].name) &&
            decl.declarations[0].name.text === ident.text
          )
            return n;
        }
        n = n.parent;
      }
      return null;
    };

    while (queue.length > 0 && slices.length < MAX_SLICES * 2) {
      const cur = queue.pop()!;
      const pf = parsedFile(cur.file);
      if (!pf) continue;
      if (cur.node.getEnd() - cur.node.getStart() > MAX_SLICE_TEXT) {
        oversizeSkip = true;
        noteLimit("slice-text");
        continue;
      }
      // Returned-object methods are closures handed to the caller — the call
      // itself never runs them, so they stay out of this slice's callee set;
      // member calls (`adapter.health()`) pull them back in precisely.
      const deferred = deferredMemberNodes(cur.file, cur.node);
      const push = (res: ResolvedNode | undefined, callsiteGuarded: boolean) => {
        if (!res) return;
        const key = `${res.file}:${res.node.getStart()}`;
        const prev = seen.get(key);
        if (prev === false) return; // already reached unguarded — strongest claim
        if (prev === true && callsiteGuarded) return; // still guarded-only
        // First sighting, or a guarded-only callee now reached unguarded —
        // (re)queue with the new guard status.
        seen.set(key, callsiteGuarded);
        slices.push({ ...res, guardedEntry: callsiteGuarded });
        queue.push(slices[slices.length - 1]);
      };
      const visit = (node: ts.Node) => {
        if (slices.length >= MAX_SLICES * 2) return;
        if (deferred.has(node)) return;
        if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
          const callsiteGuarded = cur.guardedEntry || isGuarded(node, cur.node);
          const callee = node.expression;
          if (ts.isIdentifier(callee)) {
            if (
              (callee.text === "executeKernelCommand" ||
                callee.text === "executeRegisteredCommand") &&
              ts.isCallExpression(node)
            ) {
              recordChildCall(node, callee.text, cur, callsiteGuarded);
            } else if (!CALLEE_SKIP.has(callee.text)) {
              const resolved = resolveIdentSlice(
                callee.text,
                cur.file,
                MAX_RESOLVE_DEPTH,
                visited,
              );
              push(resolved, callsiteGuarded);
              // RFC-1497: a call that resolves to forge's git() helper is
              // exempt only when its argv literals model the read-only
              // adapter's allowlist — every other route into git() still
              // flags (git commit/push/branch -D are what the rule is for).
              // A callsite whose callee was already resolved (visited map)
              // must still be judged — re-resolve with a scratch map so every
              // git(...) argv is independently classified.
              const gitRes =
                resolved ??
                resolveIdentSlice(
                  callee.text,
                  cur.file,
                  MAX_RESOLVE_DEPTH,
                  new Map<string, number>(),
                );
              if (gitRes && isFlowGitBody(gitRes)) {
                const key = `${gitRes.file}:${gitRes.node.getStart()}`;
                gitAllowed.set(
                  key,
                  (gitAllowed.get(key) ?? true) &&
                    ts.isCallExpression(node) &&
                    isAllowlistedGitCall(node),
                );
              }
            }
          } else if (ts.isPropertyAccessExpression(callee)) {
            const obj = unwrapExpr(callee.expression);
            if (
              ts.isCallExpression(obj) &&
              obj.expression.kind === ts.SyntaxKind.ImportKeyword &&
              obj.arguments[0] &&
              ts.isStringLiteral(obj.arguments[0])
            ) {
              // (await import("./x.ts")).member(...)
              const target = resolveModuleSpec(obj.arguments[0].text, dirname(cur.file));
              if (target)
                push(
                  resolveIdentSlice(callee.name.text, target, MAX_RESOLVE_DEPTH, visited),
                  callsiteGuarded,
                );
            } else if (ts.isIdentifier(obj)) {
              // ns.member(...) via namespace import / const m = await import(...)
              for (const t of bindingsFor(cur.file).get(obj.text) ?? []) {
                if (!t.file || t.member !== undefined) continue;
                push(
                  resolveIdentSlice(callee.name.text, t.file, MAX_RESOLVE_DEPTH - 1, visited),
                  callsiteGuarded,
                );
              }
              // x.member(...) where x is a local ident bound to a factory or
              // object value — resolve the invoked member body across every
              // object the binding may denote (`const adapter = resolveAdapter()`
              // → `adapter.health()` reaches each returned adapter's `health`).
              const localInit = topLevelDefs(cur.file).get(obj.text);
              const valueVisited = new Map<string, number>();
              const seedExprs: { file: string; expr: ts.Expression }[] = [];
              if (localInit && isExpressionNode(localInit))
                seedExprs.push({ file: cur.file, expr: localInit });
              // `import { adapter }` — member-bound import, not a namespace.
              for (const t of bindingsFor(cur.file).get(obj.text) ?? []) {
                if (!t.file || t.member === undefined) continue;
                const res = resolveIdentSlice(t.member, t.file, MAX_RESOLVE_DEPTH - 1, visited);
                if (res && isExpressionNode(res.node))
                  seedExprs.push({ file: res.file, expr: res.node });
              }
              for (const seed of seedExprs) {
                for (const cand of objectCandidatesFor(
                  seed.expr,
                  seed.file,
                  valueVisited,
                  MAX_RESOLVE_DEPTH,
                )) {
                  push(
                    memberBodyNode(cand, callee.name.text, valueVisited, MAX_RESOLVE_DEPTH),
                    callsiteGuarded,
                  );
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(cur.node);
    }
    if (queue.length > 0 || slices.length >= MAX_SLICES * 2) noteLimit("slices");
    if (stats && (depthCapHit || oversizeSkip || dynamicChildHit || queue.length > 0)) {
      stats.truncated = true;
      stats.limit = firstLimit;
    }
    for (const s of slices) {
      const allowed = gitAllowed.get(`${s.file}:${s.node.getStart()}`);
      if (allowed !== undefined) s.allowlistedGitEntry = allowed;
    }
    return slices;
  };

  /**
   * True when `res` is the body of forge's `git()` helper — the slice the
   * RFC-1497 allowlist rule exempts callsite-by-callsite. Matched on the
   * resolved file path plus the enclosing function's name so aliases and
   * re-exported bindings still land (fixture trees mirror the same
   * `forge/os/flow/git.ts` path under their own root).
   */
  const isFlowGitBody = (res: ResolvedNode): boolean => {
    if (!res.file.replace(/\\/g, "/").endsWith("/forge/os/flow/git.ts")) return false;
    const parent = res.node.parent;
    if (ts.isFunctionDeclaration(parent)) return parent.name?.text === "git";
    if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
      const decl = parent.parent;
      return (
        ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) && decl.name.text === "git"
      );
    }
    return false;
  };

  /**
   * True when `call` is `git(<a>, <b>, <array literal>)` that satisfies a
   * READ_ONLY_GIT_QUERIES entry — the static model of the adapters' exec
   * allowlist (RFC-1501). An entry without `forbid`/`maxPositionals` is
   * covered by the array's leading string literals; an entry with either
   * needs every element to be a string literal so the forbidden arguments
   * and the positional count can be checked. A non-literal or a
   * non-allowlisted subcommand never exempts (safe failure direction).
   */
  const isAllowlistedGitCall = (call: ts.CallExpression): boolean => {
    const argv = call.arguments[2];
    if (!argv || !ts.isArrayLiteralExpression(argv)) return false;
    const literals: string[] = [];
    for (const el of argv.elements) {
      if (ts.isStringLiteral(el)) literals.push(el.text);
      else break;
    }
    const allLiteral = literals.length === argv.elements.length;
    return READ_ONLY_GIT_QUERIES.some((query) => {
      const constrained = query.forbid !== undefined || query.maxPositionals !== undefined;
      if (!constrained) return query.prefix.every((part, i) => literals[i] === part);
      return allLiteral && matchesReadOnlyGitQuery(query, literals);
    });
  };

  /** True when the call's receiver expression refers to the injected io port. */
  const isIoReceiver = (expr: ts.Expression): boolean => {
    const e = unwrapExpr(expr);
    if (ts.isIdentifier(e)) return e.text === "io";
    if (ts.isPropertyAccessExpression(e)) return e.name.text === "io"; // context.io.* / ctx.io.*
    return false;
  };

  /**
   * True when the node sits inside a `try { }` block within the scanned slice —
   * a swallowed KERNEL-META-01 degrades output instead of crashing the command
   * (best-effort telemetry-style writes), which is a weaker defect class than an
   * unguarded mutation that propagates the throw.
   */
  const isGuarded = (node: ts.Node, root: ts.Node): boolean => {
    let cur: ts.Node | undefined = node.parent;
    while (cur && cur !== root) {
      if (
        ts.isTryStatement(cur) &&
        node.getStart() >= cur.tryBlock.getStart() &&
        node.getEnd() <= cur.tryBlock.getEnd()
      )
        return true;
      cur = cur.parent;
    }
    return false;
  };

  // ---------------------------------------------------------------------------
  // RFC-1303: env-read collection for ENV-INPUT-01
  // ---------------------------------------------------------------------------

  const isProcessEnv = (expr: ts.Expression): boolean =>
    ts.isPropertyAccessExpression(expr) &&
    expr.name.text === "env" &&
    ts.isIdentifier(unwrapExpr(expr.expression)) &&
    (unwrapExpr(expr.expression) as ts.Identifier).text === "process";

  /** True when `node` is the assignment target of `process.env.X = …` (a write, not a read). */
  const isEnvWriteTarget = (node: ts.Node): boolean =>
    node.parent !== undefined &&
    ts.isBinaryExpression(node.parent) &&
    node.parent.left === node &&
    node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;

  const envReadsInNode = (
    file: string,
    node: ts.Node,
    out: Map<string, { file: string; line: number }>,
  ) => {
    const pf = parsedFile(file);
    if (!pf) return;
    const lineOf = (n: ts.Node) => pf.sf.getLineAndCharacterOfPosition(n.getStart(pf.sf)).line + 1;
    const record = (name: string, n: ts.Node) => {
      if (!out.has(name)) out.set(name, { file, line: lineOf(n) });
    };
    const visit = (n: ts.Node) => {
      // process.env.NAME
      if (ts.isPropertyAccessExpression(n) && isProcessEnv(n.expression) && !isEnvWriteTarget(n))
        record(n.name.text, n);
      // process.env["NAME"]
      if (
        ts.isElementAccessExpression(n) &&
        isProcessEnv(n.expression) &&
        n.argumentExpression &&
        ts.isStringLiteral(n.argumentExpression) &&
        !isEnvWriteTarget(n)
      )
        record(n.argumentExpression.text, n);
      // const { A, B: c } = process.env
      if (
        ts.isVariableDeclaration(n) &&
        ts.isObjectBindingPattern(n.name) &&
        n.initializer &&
        isProcessEnv(unwrapExpr(n.initializer))
      ) {
        for (const el of n.name.elements) {
          const envName =
            el.propertyName && ts.isIdentifier(el.propertyName)
              ? el.propertyName.text
              : ts.isIdentifier(el.name)
                ? el.name.text
                : undefined;
          if (envName) record(envName, el);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  };

  /**
   * RFC-1303: every `process.env.*` name reachable from the command's
   * execute() slice — the input set ENV-INPUT-01 validates against the
   * declared `envInputs`.
   */
  const collectEnvReads = (file: string, cmdName: string): EnvReadResult => {
    const stats: ScanStats = { unresolved: false, truncated: false };
    const reads = new Map<string, { file: string; line: number }>();
    for (const slice of handlerSlices(file, cmdName, stats)) {
      envReadsInNode(slice.file, slice.node, reads);
    }
    return { reads, stats };
  };

  return {
    parsedFile,
    resolveModuleSpec,
    bindingsFor,
    topLevelDefs,
    resolveIdentSlice,
    unwrapExpr,
    propNameText,
    constStringValue,
    findCommandObject,
    executeSlice,
    isFunctionBoundary,
    isExpressionNode,
    returnValueExprs,
    objectCandidatesFor,
    memberBodyNode,
    deferredMemberNodes,
    handlerSlices,
    isIoReceiver,
    isGuarded,
    collectEnvReads,
  };
}
