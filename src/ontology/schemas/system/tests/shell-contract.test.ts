/*
<MODULE_CONTRACT>
<purpose>Unit tests for the RFC-1229 shellContract manifest schema —
profiles, routeProfiles closed-set reference checks, and pages[].shell.profile.</purpose>
<non-goals>
  <item>Do not test emitted-markup validation — that is site-shell-contract.test.ts in werkstatt-site.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1229: initial coverage for shellContract schema.</item>
  <item>RFC-1229: step 1 — shellContract schema in systemManifestSchema

Add packages/werkstatt-shared/src/ontology/schemas/system/shell-contract.ts:
closed-set region names, profile shape (regions + document-level script
policy + breadcrumbsScope), routeProfiles closed-set reference check via
superRefine, mode default report. Wire shellContract into
systemManifestSchema and profile into pages[].shell.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { systemManifestSchema } from "../manifest.ts";
import { systemShellContractSchema, systemShellProfileSchema } from "../shell-contract.ts";

const minimalManifest = {
  app: "test-app",
  version: "1.0.0",
  identity: { systemStar: "solaris", biome: "test-biome" },
};

describe("systemShellContractSchema", () => {
  it("parses a valid contract", () => {
    const parsed = systemShellContractSchema.parse({
      mode: "strict",
      profiles: {
        default: {
          regions: ["header", "footer", "background", "breadcrumbs"],
          breadcrumbsScope: "non-home",
          scripts: "required",
        },
        "no-script": {
          regions: ["header", "footer", "background"],
          scripts: "forbidden",
        },
      },
      routeProfiles: { "r/**": "no-script", "**/r/**": "no-script" },
    });
    expect(parsed.mode).toBe("strict");
    expect(parsed.routeProfiles?.["r/**"]).toBe("no-script");
  });

  it("defaults mode to report", () => {
    const parsed = systemShellContractSchema.parse({
      profiles: { default: { regions: ["header"], scripts: "required" } },
    });
    expect(parsed.mode).toBe("report");
  });

  it("rejects routeProfiles references to undeclared profiles", () => {
    const result = systemShellContractSchema.safeParse({
      profiles: { default: { regions: ["header"], scripts: "required" } },
      routeProfiles: { "r/**": "ghost" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("ghost");
  });

  it("rejects unknown region names (closed set)", () => {
    const result = systemShellProfileSchema.safeParse({
      regions: ["header", "sidebar"],
      scripts: "required",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown script policy values", () => {
    const result = systemShellProfileSchema.safeParse({
      regions: ["header"],
      scripts: "lazy",
    });
    expect(result.success).toBe(false);
  });
});

describe("systemManifestSchema shellContract integration", () => {
  it("accepts a manifest with a shellContract block", () => {
    const parsed = systemManifestSchema.parse({
      ...minimalManifest,
      shellContract: {
        mode: "report",
        profiles: {
          default: { regions: ["header", "footer"], scripts: "required" },
        },
      },
    });
    expect(parsed.shellContract?.profiles.default.regions).toEqual(["header", "footer"]);
  });

  it("accepts pages[].shell.profile alongside shell.background", () => {
    const parsed = systemManifestSchema.parse({
      ...minimalManifest,
      pages: [
        {
          pageId: "r-landing",
          route: "/r/x",
          cosmicStar: "vega",
          shell: {
            background: { enabled: true, cosmicMoon: "luna", pin: "1.0.0" },
            profile: "no-script",
          },
        },
      ],
    });
    expect(parsed.pages[0]?.shell?.profile).toBe("no-script");
  });
});
