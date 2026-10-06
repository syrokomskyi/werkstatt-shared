import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect } from "vitest";
import { stringify as stringifyYaml } from "yaml";

import { sectionManifestSchema } from "../../manifest.ts";
import { getSectionPropsSchema, resolveEffectsParityFlags } from "../manifest-resolver.ts";

const minimalSectionManifest = {
  id: "fixture-section",
  uniName: "Fixture",
  layer: "section",
  semanticId: "fixture",
  archetype: "fixture",
  version: "1.0.0",
  intent: ["surface-content"],
  industryFit: [],
  contentSchemaKey: null,
  role: "fixture",
  cosmicName: "Phobos",
};

describe("getSectionPropsSchema", () => {
  it("is an async function", () => {
    expect(typeof getSectionPropsSchema).toBe("function");
  });

  it("returns null for unknown archetype", async () => {
    const result = await getSectionPropsSchema("nonexistent-archetype", "/nonexistent");
    expect(result).toBeNull();
  });
});

describe("sectionManifestSchema.effectsParity (RFC-1204)", () => {
  it("accepts effectsParity: strict", () => {
    const result = sectionManifestSchema.safeParse({
      ...minimalSectionManifest,
      effectsParity: "strict",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a manifest without effectsParity", () => {
    expect(sectionManifestSchema.safeParse(minimalSectionManifest).success).toBe(true);
  });

  it.each(["loose", "warn", "strict,once", true, 1])("rejects effectsParity value %j", (value) => {
    const result = sectionManifestSchema.safeParse({
      ...minimalSectionManifest,
      effectsParity: value,
    });
    expect(result.success).toBe(false);
  });
});

describe("resolveEffectsParityFlags (RFC-1204)", () => {
  it("returns only cosmicNames of manifests that opted into strict parity", async () => {
    const root = await mkdtemp(join(tmpdir(), "parity-flags-"));
    for (const [dir, manifest] of [
      [
        "alpha",
        {
          ...minimalSectionManifest,
          id: "alpha-section",
          semanticId: "alpha",
          cosmicName: "Phobos",
          effectsParity: "strict",
        },
      ],
      [
        "beta",
        {
          ...minimalSectionManifest,
          id: "beta-section",
          semanticId: "beta",
          cosmicName: "Titan",
        },
      ],
    ] as const) {
      const sectionDir = join(root, "sections", dir);
      await mkdir(sectionDir, { recursive: true });
      await writeFile(join(sectionDir, `${dir}-section.manifest.yaml`), stringifyYaml(manifest));
    }

    const flags = await resolveEffectsParityFlags(root);
    expect(flags.get("Phobos")).toBe("strict");
    expect(flags.has("Titan")).toBe(false);
    expect(flags.size).toBe(1);
  });

  it("returns an empty map when the sections tree is unreadable", async () => {
    const flags = await resolveEffectsParityFlags(join(tmpdir(), "no-such-ui-root"));
    expect(flags.size).toBe(0);
  });
});
