import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_WORKPIECE_ENV, loadWorkpieceEnv } from "../workpiece-env.ts";

describe("loadWorkpieceEnv (RFC-1126)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "workpiece-env-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the shared empty map when siteDirectory is undefined", async () => {
    expect(await loadWorkpieceEnv(undefined)).toBe(EMPTY_WORKPIECE_ENV);
  });

  it("returns an empty map when .env is missing", async () => {
    const env = await loadWorkpieceEnv(dir);
    expect(env.size).toBe(0);
  });

  it("parses KEY=VALUE pairs including quoted values", async () => {
    writeFileSync(
      join(dir, ".env"),
      'PUBLIC_IMAGE_PROVIDER=build-portable\nQUOTED="with space"\n# comment\n\n',
    );
    const env = await loadWorkpieceEnv(dir);
    expect(env.get("PUBLIC_IMAGE_PROVIDER")).toBe("build-portable");
    expect(env.get("QUOTED")).toBe("with space");
    expect(env.has("# comment")).toBe(false);
  });

  it("does not mutate process.env", async () => {
    writeFileSync(join(dir, ".env"), "WORKPIECE_ONLY_KEY=from-file\n");
    delete process.env["WORKPIECE_ONLY_KEY"];
    await loadWorkpieceEnv(dir);
    expect(process.env["WORKPIECE_ONLY_KEY"]).toBeUndefined();
  });
});
