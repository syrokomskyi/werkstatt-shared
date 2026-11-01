/*
<MODULE_CONTRACT>
  <purpose>RFC-1325: pin the single site-host classification contract — workers.dev predicate normalization, channelHost derivation, workersDevHost builder.</purpose>
<non-goals>
  <item>PIN/protection behavior — access-protection.test.ts owns that.</item>
</non-goals>
</MODULE_CONTRACT>
<KEY_DECISIONS>
  <item>All classification expectations route through the exported predicates — no local workers.dev/dev-alt literals re-derived in tests.</item>
</KEY_DECISIONS>
<CHANGE_SUMMARY>
  <item>RFC-1325: initial — predicate/classifier/builder coverage.</item>
  <item>RFC-1325: provisional workers.dev as first-class site host

Single host predicate module in werkstatt-shared; provisional registration derives dev/alt/main workers.dev channels from the account subdomain; first dev deploy auto-protects provisional hosts; provisional main responses carry noindex; dns-aid skips provisional sites; site.domain.adopt cuts over to a custom domain.</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
</CHANGE_SUMMARY>
*/

// @ai-invariant[INV-sitehost-02]: fixtures pin classification through the exported site-host predicates only — no re-derived workers.dev or dev/alt-prefix literals inside tests (checked-by: test:packages/werkstatt-shared/src/middleware/tests/site-host.test.ts)

import { describe, expect, test } from "vitest";
import {
  channelHost,
  isDevOrAltHost,
  isProvisionalHost,
  siteHostKind,
  workersDevHost,
} from "../site-host.ts";

describe("site-host (RFC-1325)", () => {
  describe("isProvisionalHost", () => {
    test.each([
      "dp7.syrokomskyi.workers.dev",
      "https://dp7.syrokomskyi.workers.dev",
      "https://dp7.syrokomskyi.workers.dev/path/page",
      "dev-dp7.syrokomskyi.workers.dev",
      "DP7.SYROKOMSKYI.WORKERS.DEV",
      "workers.dev",
    ])("provisional: %s", (host) => {
      expect(isProvisionalHost(host)).toBe(true);
    });

    test.each([
      "dp7.example.com",
      "dev.dp7.example.com",
      "https://dp7.example.com",
      "workers.dev.evil.example.com",
      "myworkers.dev",
      "",
    ])("custom: %s", (host) => {
      expect(isProvisionalHost(host)).toBe(false);
    });

    test("undefined is not provisional", () => {
      expect(isProvisionalHost(undefined)).toBe(false);
    });
  });

  describe("siteHostKind", () => {
    test("workers.dev suffix → provisional; everything else → custom-domain", () => {
      expect(siteHostKind("a.b.workers.dev")).toBe("provisional-workers-dev");
      expect(siteHostKind("example.com")).toBe("custom-domain");
    });
  });

  describe("channelHost", () => {
    test("custom-domain follows the dev./alt. prefix convention", () => {
      expect(channelHost("custom-domain", "example.com", "dev", "x")).toBe("dev.example.com");
      expect(channelHost("custom-domain", "example.com", "alt", "x")).toBe("alt.example.com");
      expect(channelHost("custom-domain", "example.com", "main", "x")).toBe("example.com");
    });

    test("provisional host maps to the channel worker name on the account subdomain", () => {
      expect(
        channelHost("provisional-workers-dev", "dp7.syrokomskyi.workers.dev", "dev", "dev-dp7"),
      ).toBe("dev-dp7.syrokomskyi.workers.dev");
      expect(
        channelHost("provisional-workers-dev", "dp7.syrokomskyi.workers.dev", "main", "dp7"),
      ).toBe("dp7.syrokomskyi.workers.dev");
    });
  });

  describe("workersDevHost", () => {
    test("builds <workerName>.<account>.workers.dev", () => {
      expect(workersDevHost("dp7", "syrokomskyi")).toBe("dp7.syrokomskyi.workers.dev");
      expect(workersDevHost("dev-dp7", "syrokomskyi")).toBe("dev-dp7.syrokomskyi.workers.dev");
    });
  });

  describe("isDevOrAltHost", () => {
    test.each(["dev.example.com", "alt.example.com", "dev-dp7.acct.workers.dev"])(
      "dev/alt: %s",
      (host) => {
        expect(isDevOrAltHost(host)).toBe(true);
      },
    );
    test.each(["example.com", "dp7.acct.workers.dev", "adept.example.com"])(
      "not dev/alt: %s",
      (host) => {
        expect(isDevOrAltHost(host)).toBe(false);
      },
    );
  });
});
