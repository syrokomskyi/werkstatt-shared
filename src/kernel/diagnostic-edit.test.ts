/*
<MODULE_CONTRACT>
<purpose>
RFC-1445 AC-1/AC-2 probes plus schema-surface coverage for the machine-applicable
edit descriptors on Diagnostic.remediation: diagnosticEditSchema (replace|choose),
generatedOwnerSchema, diagnosticCommandSchema, and the three superRefine
invariants (edit requires file; generatedOwner redirects the edit target to the
template; find must not contain a newline unless data.multiline).
</purpose>
<non-goals>
  <item>Not a contract source of truth — the schema module owns the authoritative shape.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1445: created — edit-descriptor schema + invariant probes.</item>
  <item>RFC-1445: machine-applicable edit descriptors and content worklist (RFC-1445)</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";

import { snapshotCanonicalJsonObjectV1 } from "../fingerprint/canonical-json.ts";
import {
  diagnosticCommandSchema,
  diagnosticEditSchema,
  diagnosticSchema,
  type Diagnostic,
} from "./diagnostic.ts";

const baseDiagnostic = (over: Partial<Diagnostic> = {}): Record<string, unknown> => ({
  ruleId: "TEST-01",
  severity: "error",
  message: "fixture finding",
  file: "src/content/pages/de/home.md",
  ...over,
});

const replaceEdit = (over: Record<string, unknown> = {}) => ({
  kind: "replace",
  find: "toʼgʼridan",
  replace: "toʻgʻridan",
  ...over,
});

const remediation = (over: Record<string, unknown> = {}) => ({
  ruleId: "TEST-01",
  action: "fix the finding",
  ...over,
});

describe("diagnosticEditSchema", () => {
  it("parses a replace edit", () => {
    expect(diagnosticEditSchema.safeParse(replaceEdit()).success).toBe(true);
  });

  it("parses a replace edit with an empty replacement (deletion)", () => {
    expect(diagnosticEditSchema.safeParse(replaceEdit({ replace: "" })).success).toBe(true);
  });

  it("rejects a replace edit whose find is empty", () => {
    expect(diagnosticEditSchema.safeParse(replaceEdit({ find: "" })).success).toBe(false);
  });

  it("parses a choose edit with two options incl. recommended", () => {
    const parsed = diagnosticEditSchema.safeParse({
      kind: "choose",
      find: "schönheit",
      options: [
        { label: "keep as is", replace: "schönheit", consequence: "no change", recommended: true },
        { label: "capitalize", replace: "Schönheit", consequence: "noun case", },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a choose edit with a single option", () => {
    expect(
      diagnosticEditSchema.safeParse({
        kind: "choose",
        find: "x",
        options: [{ label: "only", replace: "y", consequence: "c" }],
      }).success,
    ).toBe(false);
  });
});

describe("diagnosticCommandSchema", () => {
  it("accepts werkstatt run and pipeline commands", () => {
    expect(
      diagnosticCommandSchema.safeParse("werkstatt run typography.validate --site dp7").success,
    ).toBe(true);
    expect(diagnosticCommandSchema.safeParse("werkstatt pipeline author").success).toBe(true);
  });

  it("rejects commands outside the closed prefix", () => {
    expect(diagnosticCommandSchema.safeParse("rm -rf /").success).toBe(false);
    expect(diagnosticCommandSchema.safeParse("pnpm exec werkstatt run x").success).toBe(false);
  });
});

describe("diagnosticSchema RFC-1445 invariants", () => {
  it("AC-1: rejects a replace edit without Diagnostic.file", () => {
    const parsed = diagnosticSchema.safeParse(
      baseDiagnostic({ file: undefined, remediation: remediation({ edit: replaceEdit() }) }),
    );
    expect(parsed.success).toBe(false);
  });

  it("accepts a replace edit bound to Diagnostic.file", () => {
    const parsed = diagnosticSchema.safeParse(
      baseDiagnostic({ remediation: remediation({ edit: replaceEdit() }) }),
    );
    expect(parsed.success).toBe(true);
  });

  it("AC-2: rejects an edit targeting Diagnostic.file when generatedOwner is present", () => {
    const parsed = diagnosticSchema.safeParse(
      baseDiagnostic({
        remediation: remediation({
          edit: replaceEdit(),
          generatedOwner: {
            command: "werkstatt run legal.scaffold --site dp7",
            template: "packages/werkstatt-site/src/legal/template.ts",
          },
        }),
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it("AC-2: accepts an edit explicitly targeting generatedOwner.template", () => {
    const parsed = diagnosticSchema.safeParse(
      baseDiagnostic({
        remediation: remediation({
          edit: replaceEdit({ target: "packages/werkstatt-site/src/legal/template.ts" }),
          generatedOwner: {
            command: "werkstatt run legal.scaffold --site dp7",
            template: "packages/werkstatt-site/src/legal/template.ts",
          },
        }),
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects edit.target naming a different file without generatedOwner", () => {
    const parsed = diagnosticSchema.safeParse(
      baseDiagnostic({
        remediation: remediation({
          edit: replaceEdit({ target: "src/content/pages/de/other.md" }),
        }),
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects a newline find unless data.multiline is true", () => {
    const single = diagnosticSchema.safeParse(
      baseDiagnostic({
        remediation: remediation({ edit: replaceEdit({ find: "line one\nline two" }) }),
      }),
    );
    expect(single.success).toBe(false);
    const snap = snapshotCanonicalJsonObjectV1({ multiline: true });
    expect(snap.ok).toBe(true);
    if (!snap.ok) return;
    const multi = diagnosticSchema.safeParse(
      baseDiagnostic({
        data: snap.value,
        remediation: remediation({ edit: replaceEdit({ find: "line one\nline two" }) }),
      }),
    );
    expect(multi.success).toBe(true);
  });

  it("still accepts a diagnostic with no remediation (backward compat)", () => {
    expect(diagnosticSchema.safeParse(baseDiagnostic()).success).toBe(true);
  });

  it("accepts autofixCommand and verifyCommand on remediation", () => {
    const parsed = diagnosticSchema.safeParse(
      baseDiagnostic({
        remediation: remediation({
          edit: replaceEdit(),
          autofixCommand: "werkstatt run typography.fix --site dp7",
          verifyCommand: "werkstatt run typography.validate --site dp7",
        }),
      }),
    );
    expect(parsed.success).toBe(true);
  });
});
