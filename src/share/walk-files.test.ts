import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  walkFiles,
  readTextFile,
  readTextFiles,
  readBinaryFiles,
} from "./walk-files.ts";

describe("walkFiles", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "walk-files-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns relative paths with forward slashes, recursively by default", async () => {
    await mkdir(join(root, "a", "b"), { recursive: true });
    await writeFile(join(root, "top.ts"), "");
    await writeFile(join(root, "a", "mid.ts"), "");
    await writeFile(join(root, "a", "b", "deep.ts"), "");

    const files = await walkFiles(root);

    expect(files.sort()).toEqual(["a/b/deep.ts", "a/mid.ts", "top.ts"]);
  });

  it("returns only top-level files when recursive is false", async () => {
    await mkdir(join(root, "sub"), { recursive: true });
    await writeFile(join(root, "top.ts"), "");
    await writeFile(join(root, "sub", "nested.ts"), "");

    const files = await walkFiles(root, { recursive: false });

    expect(files).toEqual(["top.ts"]);
  });

  it("applies the filter to relative paths", async () => {
    await mkdir(join(root, "sub"), { recursive: true });
    await writeFile(join(root, "keep.ts"), "");
    await writeFile(join(root, "skip.js"), "");
    await writeFile(join(root, "sub", "keep.ts"), "");

    const files = await walkFiles(root, { filter: (rel) => rel.endsWith(".ts") });

    expect(files.sort()).toEqual(["keep.ts", "sub/keep.ts"]);
  });

  it("returns an empty array for a missing directory", async () => {
    expect(await walkFiles(join(root, "nope"))).toEqual([]);
  });

  it("skips non-file entries", async () => {
    await mkdir(join(root, "dir-only"), { recursive: true });
    await writeFile(join(root, "file.ts"), "");

    const files = await walkFiles(root);

    expect(files).toEqual(["file.ts"]);
  });
});

describe("readTextFile", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "walk-read-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads utf-8 content", async () => {
    await writeFile(join(root, "a.txt"), "hello ünïcode");

    expect(await readTextFile(join(root, "a.txt"))).toBe("hello ünïcode");
  });

  it("returns null for a missing file", async () => {
    expect(await readTextFile(join(root, "missing.txt"))).toBeNull();
  });
});

describe("readTextFiles / readBinaryFiles", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "walk-reads-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads multiple files keyed by relative path", async () => {
    await mkdir(join(root, "sub"), { recursive: true });
    await writeFile(join(root, "a.ts"), "aaa");
    await writeFile(join(root, "sub", "b.ts"), "bbb");

    const contents = await readTextFiles(root, ["a.ts", "sub/b.ts"]);

    expect(contents.get("a.ts")).toBe("aaa");
    expect(contents.get("sub/b.ts")).toBe("bbb");
    expect(contents.size).toBe(2);
  });

  it("omits unreadable entries", async () => {
    await writeFile(join(root, "a.ts"), "aaa");

    const contents = await readTextFiles(root, ["a.ts", "missing.ts"]);

    expect(contents.size).toBe(1);
    expect(contents.has("missing.ts")).toBe(false);
  });

  it("reads binary content without utf-8 corruption", async () => {
    const bytes = Buffer.from([0x00, 0xff, 0xfe, 0x42]);
    await writeFile(join(root, "bin.dat"), bytes);

    const contents = await readBinaryFiles(root, ["bin.dat"]);

    expect(contents.get("bin.dat")).toEqual(bytes);
  });
});
