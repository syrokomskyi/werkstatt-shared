import { describe, expect, it } from "vitest";
import YAML from "yaml";
import {
  PBP_ENTITY_DIR_MAP,
  pbpDocumentPath,
  serializePbpDocument,
} from "../pbp-layout.ts";
import { INTAKE_PBP_SCHEMA_ALLOWLIST } from "../intake.ts";

describe("pbp-layout (RFC-1307)", () => {
  it("maps every intake-allow-listed PBP type to a directory", () => {
    for (const schema of INTAKE_PBP_SCHEMA_ALLOWLIST) {
      const type = schema.slice("pbp/".length, schema.indexOf("@"));
      expect(
        Object.hasOwn(PBP_ENTITY_DIR_MAP, type),
        `PBP_ENTITY_DIR_MAP must cover intake type "${type}" — add it in pbp-layout.ts`,
      ).toBe(true);
    }
  });

  it("resolves document paths per type", () => {
    expect(pbpDocumentPath("ru", { type: "business", id: "business/dp7" })).toBe("ru/business.md");
    expect(pbpDocumentPath("ru", { type: "legal-identity", id: "legal-identity/dp7" })).toBe(
      "ru/organization/dp7.md",
    );
    expect(pbpDocumentPath("ru", { type: "claim", id: "claim/european-quality" })).toBe(
      "ru/trust/claims/european-quality.md",
    );
    expect(pbpDocumentPath("ru", { type: "evidence-source", id: "evidence-source/src-01" })).toBe(
      "ru/trust/evidence/src-01.md",
    );
  });

  it("serializes independently of input key order", () => {
    const a = {
      schema: "pbp/claim@1",
      id: "claim/x",
      type: "claim",
      status: "draft",
      statement: "S",
      subject: { name: "N", kind: "k" },
      governance: { authorityRef: "pbp/business@1:business/dp7" },
    };
    const b = {
      governance: { authorityRef: "pbp/business@1:business/dp7" },
      subject: { kind: "k", name: "N" },
      statement: "S",
      status: "draft",
      type: "claim",
      id: "claim/x",
      schema: "pbp/claim@1",
    };
    expect(serializePbpDocument(b)).toBe(serializePbpDocument(a));
  });

  it("emits envelope keys first and a frontmatter-only document", () => {
    const out = serializePbpDocument({
      statement: "S",
      status: "published",
      id: "claim/x",
      type: "claim",
      schema: "pbp/claim@1",
    });
    expect(out.startsWith("---\nschema: pbp/claim@1\nid: claim/x\ntype: claim\nstatus: published\n")).toBe(true);
    expect(out.endsWith("---\n")).toBe(true);
    expect(out).not.toContain("'");
    const yaml = out.slice(4, out.length - 4);
    expect(YAML.parse(yaml)).toMatchObject({ id: "claim/x", statement: "S" });
  });
});
