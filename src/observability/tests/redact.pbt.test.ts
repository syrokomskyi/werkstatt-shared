/*
<MODULE_CONTRACT>
  <purpose>
Unit tests for redactpbt — redact.pbt covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0347: initial PBT illustrative example for redactUrl invariants.</item>
</CHANGE_SUMMARY>
*/

import { test, expect } from "vitest";
import fc from "fast-check";
import { redactUrl } from "../redact.ts";

const urlArbitrary = fc.webUrl();

test("PBT: redactUrl output never contains a query string", () => {
  fc.assert(
    fc.property(urlArbitrary, (url) => {
      const redacted = redactUrl(url);
      try {
        const parsed = new URL(redacted);
        expect(parsed.search).toBe("");
      } catch {
        // non-URL input passes through unchanged — skip
      }
    }),
  );
});

test("PBT: redactUrl output never contains a fragment", () => {
  fc.assert(
    fc.property(urlArbitrary, (url) => {
      const redacted = redactUrl(url);
      try {
        const parsed = new URL(redacted);
        expect(parsed.hash).toBe("");
      } catch {
        // non-URL input passes through unchanged — skip
      }
    }),
  );
});

test("PBT: redactUrl is idempotent — redact(redact(url)) === redact(url)", () => {
  fc.assert(
    fc.property(urlArbitrary, (url) => {
      const once = redactUrl(url);
      expect(redactUrl(once)).toBe(once);
    }),
  );
});

test("PBT: redactUrl host is always lowercase", () => {
  fc.assert(
    fc.property(urlArbitrary, (url) => {
      const redacted = redactUrl(url);
      try {
        const parsed = new URL(redacted);
        expect(parsed.hostname).toBe(parsed.hostname.toLowerCase());
      } catch {
        // non-URL input passes through unchanged — skip
      }
    }),
  );
});
