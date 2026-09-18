/*
<MODULE_CONTRACT>
<purpose>Tests for loadSystemManifest / loadSystemManifestSync — RFC-1106: loaders execute systemManifestSchema.parse() at load time, so a valid manifest returns the schema-inferred type with defaults materialized and an invalid manifest throws ZodError.</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1106: created — pins the parse-at-load contract (AC-7).</item>
  <item>RFC-1106: step 3 — sole SystemManifest definition, loaders parse()

Delete the hand-written SystemManifest interface; content/system-manifest.ts re-exports the schema-inferred type. Both loaders switch from 'as unknown as' to systemManifestSchema.parse() — the schema now executes at load. system.manifest.validate catches ZodError and maps issues into structured diagnostics; the post-load safeParse was dead code. Zero consumer breaks: all growth/release/tagline readers were already optional-safe. New adjacent test pins parse-at-load (AC-7).</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ZodError } from "zod";
import { loadSystemManifest, loadSystemManifestSync } from "./system-manifest.ts";

const VALID_SYSTEM_MD = `---
app: test-app
version: 1.0.0
identity:
  systemStar: sirius
  biome: urban
---

# Test system
`;

const INVALID_SYSTEM_MD = `---
app: INVALID APP
version: not-semver
identity:
  systemStar: sirius
---

# Invalid system
`;

describe("loadSystemManifest", () => {
  let contentDir: string;

  beforeEach(async () => {
    contentDir = await mkdtemp(join(tmpdir(), "system-manifest-"));
  });

  afterEach(async () => {
    await rm(contentDir, { recursive: true, force: true });
  });

  it("parses a valid manifest and materializes schema defaults", async () => {
    await writeFile(join(contentDir, "system.md"), VALID_SYSTEM_MD);

    const result = await loadSystemManifest(contentDir);

    expect(result.manifest.app).toBe("test-app");
    expect(result.manifest.identity.systemStar).toBe("sirius");
    // .default([]) materialized by parse — absent in source, present in output
    expect(result.manifest.pages).toEqual([]);
    expect(result.manifest.constellations).toEqual([]);
    expect(result.manifest.clientEditable).toEqual([]);
    expect(result.manifest.retiredRoutes).toEqual([]);
    // optional fields stay absent
    expect(result.manifest.growth).toBeUndefined();
    expect(result.manifest.release).toBeUndefined();
    expect(result.manifest.identity.tagline).toBeUndefined();
    expect(result.source).toBe("system.md");
  });

  it("throws ZodError on an invalid manifest", async () => {
    await writeFile(join(contentDir, "system.md"), INVALID_SYSTEM_MD);

    await expect(loadSystemManifest(contentDir)).rejects.toBeInstanceOf(ZodError);
  });

  it("throws when system.md does not exist", async () => {
    await expect(loadSystemManifest(contentDir)).rejects.toThrow();
  });
});

describe("loadSystemManifestSync", () => {
  let contentDir: string;

  beforeEach(async () => {
    contentDir = await mkdtemp(join(tmpdir(), "system-manifest-sync-"));
  });

  afterEach(async () => {
    await rm(contentDir, { recursive: true, force: true });
  });

  it("parses a valid manifest synchronously", async () => {
    await writeFile(join(contentDir, "system.md"), VALID_SYSTEM_MD);

    const result = loadSystemManifestSync(contentDir);

    expect(result.manifest.app).toBe("test-app");
    expect(result.manifest.pages).toEqual([]);
  });

  it("throws ZodError on an invalid manifest", async () => {
    await writeFile(join(contentDir, "system.md"), INVALID_SYSTEM_MD);

    expect(() => loadSystemManifestSync(contentDir)).toThrow(ZodError);
  });
});
