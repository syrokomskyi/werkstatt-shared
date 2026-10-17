/*
<MODULE_CONTRACT>
<purpose>[RFC-0767] Integration tests for price marker resolution in buildSemanticPageModelWith — verifies that markers in heading, lead, and description are resolved before entering the SemanticPageModel.</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the build suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

import { test, expect, describe } from "vitest";
import {
  buildSemanticPageModelWith,
  type SemanticContentReader,
  type SemanticBuildProfile,
} from "../build-page.ts";
import type { DerivedPriceEntry } from "../price-marker-resolver.ts";

// RFC-1288: OFFERING_URI_PREFIX is gone — fixtures key by an arbitrary host.
const TEST_OFFERINGS_PREFIX = "https://test.example/id/offerings/";

const fixturePrices: Record<string, DerivedPriceEntry[]> = {
  [`${TEST_OFFERINGS_PREFIX}referral-fee`]: [
    {
      chargeRef: "activation",
      targetCurrency: "USD",
      amount: { value: "75", currency: "USD" },
      trace: {
        source: { amount: "70", currency: "EUR" },
        rate: { value: "1.07", pair: "EUR/USD" },
      },
    },
  ],
};

function createMockReader(
  frontmatter: Record<string, unknown>,
  derivedPrices: Record<string, DerivedPriceEntry[]> | null,
): SemanticContentReader {
  return {
    async getPageFrontmatter() {
      return frontmatter;
    },
    async getProseBody() {
      return "";
    },
    async getHomeLabel() {
      return "Home";
    },
    async getFaqEntries() {
      return [];
    },
    getDerivedPrices() {
      return derivedPrices;
    },
  };
}

const emptyProfile: SemanticBuildProfile = {
  organization: {
    name: "Test Org",
    description: "Test organization",
    url: "https://example.com",
    sameAs: [],
  },
  people: [],
  initiatives: [],
};

describe("buildSemanticPageModelWith with price markers", () => {
  test("13. heading with price marker resolves to EUR string", async () => {
    const reader = createMockReader(
      {
        title: "Test Page",
        description: "Test description",
        blocks: [
          {
            id: "hero",
            type: "hero",
            props: {
              header: {
                heading: "Отримайте {price:referral-fee:activation} за кожну підписку",
              },
            },
          },
        ],
      },
      fixturePrices,
    );

    const model = await buildSemanticPageModelWith(reader, {
      pageId: "test-page",
      semanticType: "about",
      lang: "de",
      url: "https://example.com/test",
      profile: emptyProfile,
    });

    expect(model).not.toBeNull();
    expect(model!.heading).toContain("70");
    expect(model!.heading).toContain("€");
    expect(model!.heading).not.toContain("{price:");
  });

  test("14. heading with price marker and null derived prices leaves the marker verbatim (RFC-1288)", async () => {
    const reader = createMockReader(
      {
        title: "Test Page",
        description: "Test description",
        blocks: [
          {
            id: "hero",
            type: "hero",
            props: {
              header: {
                heading: "Отримайте {price:referral-fee:activation}",
              },
            },
          },
        ],
      },
      null,
    );

    const model = await buildSemanticPageModelWith(reader, {
      pageId: "test-page",
      semanticType: "about",
      lang: "de",
      url: "https://example.com/test",
      profile: emptyProfile,
    });

    expect(model).not.toBeNull();
    expect(model!.heading).toBe("Отримайте {price:referral-fee:activation}");
  });

  test("15. page without price markers has unchanged model", async () => {
    const frontmatter = {
      title: "Plain Page",
      description: "A page without price markers",
      blocks: [
        {
          id: "hero",
          type: "hero",
          props: {
            header: {
              heading: "Welcome to the page",
            },
          },
        },
      ],
    };
    const reader = createMockReader(frontmatter, fixturePrices);

    const model = await buildSemanticPageModelWith(reader, {
      pageId: "plain-page",
      semanticType: "about",
      lang: "de",
      url: "https://example.com/plain",
      profile: emptyProfile,
    });

    expect(model).not.toBeNull();
    expect(model!.heading).toBe("Welcome to the page");
    expect(model!.description).toBe("A page without price markers");
  });
});
