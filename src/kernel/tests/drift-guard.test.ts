import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardTrackedOverwrite } from "../drift-guard.ts";

describe("guardTrackedOverwrite (RFC-1126)", () => {
  let dir: string;
  const logger = { warn: vi.fn() };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "drift-guard-"));
    logger.warn.mockClear();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports nothing to lose when the file does not exist", async () => {
    const report = await guardTrackedOverwrite(
      join(dir, "missing.json"),
      "{}",
      { format: "json" },
      logger,
    );
    expect(report.wouldLose).toEqual([]);
    expect(report.identical).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("reports identical when content matches", async () => {
    const file = join(dir, "same.json");
    writeFileSync(file, '{"a":1}\n');
    const report = await guardTrackedOverwrite(file, '{"a":1}\n', { format: "json" }, logger);
    expect(report.identical).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns with the lost key path for JSON drift", async () => {
    const file = join(dir, "package.json");
    writeFileSync(file, JSON.stringify({ dependencies: { "extra-dep": "^1.0.0" } }));
    const report = await guardTrackedOverwrite(
      file,
      JSON.stringify({ dependencies: {} }),
      { format: "json", fixHint: "edit the manifest" },
      logger,
    );
    expect(report.wouldLose).toContain("dependencies.extra-dep");
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0]![0]).toContain("DRIFT-GUARD-01");
    expect(logger.warn.mock.calls[0]![0]).toContain("dependencies.extra-dep");
    expect(logger.warn.mock.calls[0]![0]).toContain("edit the manifest");
  });

  it("detects changed scalar values as lost edits", async () => {
    const file = join(dir, "cfg.json");
    writeFileSync(file, JSON.stringify({ version: "2.0.0" }));
    const report = await guardTrackedOverwrite(
      file,
      JSON.stringify({ version: "1.0.0" }),
      { format: "json" },
      logger,
    );
    expect(report.wouldLose).toContain("version");
  });

  it("warns for YAML drift", async () => {
    const file = join(dir, "config.yaml");
    writeFileSync(file, "keep: yes\ndrop: gone\n");
    const report = await guardTrackedOverwrite(file, "keep: yes\n", { format: "yaml" }, logger);
    expect(report.wouldLose).toContain("drop");
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("warns for text drift listing removed lines", async () => {
    const file = join(dir, "list.txt");
    writeFileSync(file, "alpha\nbeta\ngamma\n");
    const report = await guardTrackedOverwrite(file, "alpha\n", { format: "text" }, logger);
    expect(report.wouldLose).toEqual(expect.arrayContaining(["beta", "gamma"]));
  });

  it("does not warn when new content only adds keys", async () => {
    const file = join(dir, "grow.json");
    writeFileSync(file, JSON.stringify({ a: 1 }));
    const report = await guardTrackedOverwrite(
      file,
      JSON.stringify({ a: 1, b: 2 }),
      { format: "json" },
      logger,
    );
    expect(report.wouldLose).toEqual([]);
    expect(report.identical).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("throws under strict instead of warning", async () => {
    const file = join(dir, "strict.json");
    writeFileSync(file, JSON.stringify({ manual: true }));
    await expect(
      guardTrackedOverwrite(file, "{}", { format: "json", strict: true }, logger),
    ).rejects.toThrow("DRIFT-GUARD-01");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("falls back to line diff when existing JSON is unparseable", async () => {
    const file = join(dir, "broken.json");
    writeFileSync(file, "{ not json, custom-line\n");
    const report = await guardTrackedOverwrite(file, "{}", { format: "json" }, logger);
    expect(report.wouldLose.length).toBeGreaterThan(0);
  });
});
