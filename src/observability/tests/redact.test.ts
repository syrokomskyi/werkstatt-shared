/*
<MODULE_CONTRACT>
<purpose>
Unit tests for redact covering redactUrl. It also guards the documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the redact suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { describe, it, expect } from "vitest";
import { redactUrl } from "../redact.ts";

describe("redactUrl", () => {
  it("strips query string and fragment", () => {
    expect(redactUrl("https://a.b/p?q=1#f")).toBe("https://a.b/p");
  });

  it("strips only query string when no fragment", () => {
    expect(redactUrl("https://a.b/p?q=1")).toBe("https://a.b/p");
  });

  it("strips only fragment when no query string", () => {
    expect(redactUrl("https://a.b/p#section")).toBe("https://a.b/p");
  });

  it("lowercases the host", () => {
    expect(redactUrl("https://EXAMPLE.COM/Path")).toBe("https://example.com/Path");
  });

  it("preserves path case", () => {
    expect(redactUrl("https://a.b/CaseSensitive/Path?q=1")).toBe("https://a.b/CaseSensitive/Path");
  });

  it("returns input unchanged for invalid URLs", () => {
    expect(redactUrl("not a url")).toBe("not a url");
  });

  it("handles root path", () => {
    expect(redactUrl("https://a.b/?q=1#f")).toBe("https://a.b");
  });

  it("preserves non-root path slashes so repeated redaction is stable", () => {
    expect(redactUrl("http://a.aa//")).toBe("http://a.aa//");
    expect(redactUrl(redactUrl("http://a.aa//"))).toBe("http://a.aa//");
  });
});
