/*
<MODULE_CONTRACT>
  <purpose>RFC-0745: test that buildOrganizationNode emits priceCurrency in makesOffer Offer nodes when currency is available.</purpose>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0745: initial test for priceCurrency in makesOffer Offer nodes.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";
import { buildOrganizationNode } from "../semantic/jsonld/organization.ts";
import { createJsonLdContext } from "../semantic/jsonld/context.ts";
import type { SemanticPageModel, SemanticOrganization } from "../semantic/models.ts";

function makeOrgWithPrices(
  prices: Array<{ id: string; label: string; amount: string; currency?: string }>,
): SemanticOrganization {
  return {
    name: "Test Org",
    description: "Test organization",
    url: "https://example.com",
    offer: { prices },
  };
}

function makeModel(org: SemanticOrganization): SemanticPageModel {
  return {
    type: "home",
    lang: "de",
    url: "https://example.com/de",
    title: "Test Page",
    description: "Test description",
    breadcrumbs: [],
    blocks: [],
    organization: org,
  };
}

describe("RFC-0745: buildOrganizationNode makesOffer priceCurrency", () => {
  it("emits priceCurrency when SemanticPrice has currency", () => {
    const org = makeOrgWithPrices([
      { id: "monthly", label: "Monthly", amount: "70.00", currency: "EUR" },
    ]);
    const context = createJsonLdContext(makeModel(org));
    const node = buildOrganizationNode(context);
    const makesOffer = node.makesOffer as Array<Record<string, unknown>>;
    expect(makesOffer).toHaveLength(1);
    expect(makesOffer[0].priceCurrency).toBe("EUR");
    const priceSpec = makesOffer[0].priceSpecification as Record<string, unknown>;
    expect(priceSpec.price).toBe("70.00");
  });

  it("omits priceCurrency when SemanticPrice has no currency", () => {
    const org = makeOrgWithPrices([{ id: "monthly", label: "Monthly", amount: "70.00" }]);
    const context = createJsonLdContext(makeModel(org));
    const node = buildOrganizationNode(context);
    const makesOffer = node.makesOffer as Array<Record<string, unknown>>;
    expect(makesOffer).toHaveLength(1);
    expect(makesOffer[0].priceCurrency).toBeUndefined();
  });

  it("emits priceCurrency for each offer when multiple prices have currency", () => {
    const org = makeOrgWithPrices([
      { id: "monthly", label: "Monthly", amount: "70.00", currency: "EUR" },
      { id: "yearly", label: "Yearly", amount: "840.00", currency: "EUR" },
    ]);
    const context = createJsonLdContext(makeModel(org));
    const node = buildOrganizationNode(context);
    const makesOffer = node.makesOffer as Array<Record<string, unknown>>;
    expect(makesOffer).toHaveLength(2);
    expect(makesOffer[0].priceCurrency).toBe("EUR");
    expect(makesOffer[1].priceCurrency).toBe("EUR");
  });
});

describe("buildOrganizationNode priceRange", () => {
  it("emits priceRange as min–max with currency when multiple prices exist", () => {
    const org = makeOrgWithPrices([
      { id: "monthly", label: "Monthly", amount: "70.00", currency: "EUR" },
      { id: "yearly", label: "Yearly", amount: "700.00", currency: "EUR" },
      { id: "setup", label: "Setup", amount: "200.00", currency: "EUR" },
    ]);
    const context = createJsonLdContext(makeModel(org));
    const node = buildOrganizationNode(context);
    expect(node.priceRange).toBe("70–700 EUR");
  });

  it("emits single-amount priceRange when all prices are equal", () => {
    const org = makeOrgWithPrices([
      { id: "monthly", label: "Monthly", amount: "70.00", currency: "EUR" },
    ]);
    const context = createJsonLdContext(makeModel(org));
    const node = buildOrganizationNode(context);
    expect(node.priceRange).toBe("70 EUR");
  });

  it("omits priceRange when no prices exist", () => {
    const org: SemanticOrganization = {
      name: "Test Org",
      description: "Test organization",
      url: "https://example.com",
    };
    const context = createJsonLdContext(makeModel(org));
    const node = buildOrganizationNode(context);
    expect(node.priceRange).toBeUndefined();
  });

  it("omits priceRange when price amounts are non-numeric", () => {
    const org = makeOrgWithPrices([
      { id: "custom", label: "Custom", amount: "auf Anfrage", currency: "EUR" },
    ]);
    const context = createJsonLdContext(makeModel(org));
    const node = buildOrganizationNode(context);
    expect(node.priceRange).toBe("");
  });

  it("emits priceRange without currency when prices lack currency", () => {
    const org = makeOrgWithPrices([
      { id: "monthly", label: "Monthly", amount: "70.00" },
      { id: "setup", label: "Setup", amount: "200.00" },
    ]);
    const context = createJsonLdContext(makeModel(org));
    const node = buildOrganizationNode(context);
    expect(node.priceRange).toBe("70–200");
  });
});
