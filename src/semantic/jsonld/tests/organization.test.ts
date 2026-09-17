import { describe, expect, it } from "vitest";
import { buildOrganizationNode } from "../organization.ts";
import { createJsonLdContext } from "../context.ts";
import { makePage } from "../../tests/helpers.ts";

describe("buildOrganizationNode", () => {
  it("builds Organization node with default schemaType", () => {
    const page = makePage();
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node["@type"]).toEqual(["Organization", "NGO"]);
    expect(node["@id"]).toBe(ctx.ids.organization);
    expect(node.name).toBe("Warpgogol");
    expect(node.description).toBe("Digital infrastructure for nonprofits");
    expect(node.url).toBe("https://example.com");
  });

  it("uses custom schemaType when provided", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.schemaType = ["Organization", "ProfessionalService"];
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node["@type"]).toEqual(["Organization", "ProfessionalService"]);
  });

  it("emits legalName, email, foundingYear, registration when present", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.legalName = "Warpgogol GmbH";
    page.organization.email = "info@example.com";
    page.organization.foundingYear = "2020";
    page.organization.registration = "HRB 12345";
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node.legalName).toBe("Warpgogol GmbH");
    expect(node.email).toBe("info@example.com");
    expect(node.foundingDate).toBe("2020");
    expect(node.identifier).toBe("HRB 12345");
  });

  it("emits address when present", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.address = {
      streetAddress: "Test Str. 1",
      postalCode: "12345",
      addressLocality: "Berlin",
      addressCountry: "DE",
    };
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Test Str. 1",
      postalCode: "12345",
      addressLocality: "Berlin",
      addressCountry: "DE",
    });
  });

  it("emits contactPoints when present", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.contactPoints = [
      { contactType: "customer service", email: "support@example.com" },
    ];
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node.contactPoint).toHaveLength(1);
    expect((node.contactPoint as unknown[])[0]).toMatchObject({
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "support@example.com",
    });
  });

  it("emits sameAs links", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.sameAs = ["https://twitter.com/example", "https://github.com/example"];
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node.sameAs).toEqual(["https://twitter.com/example", "https://github.com/example"]);
  });

  it("emits logo and image", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.logo = "https://example.com/logo.png";
    page.organization.image = "https://example.com/image.png";
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node.logo).toEqual({ "@type": "ImageObject", url: "https://example.com/logo.png" });
    expect(node.image).toBe("https://example.com/image.png");
  });

  it("emits founders as Person references", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.founders = [{ name: "Jane Doe" }];
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node.founder).toEqual([{ "@id": ctx.ids.person("Jane Doe") }]);
  });

  it("emits areaServed when present", () => {
    const page = makePage({
      organization: makePage().organization,
    });
    page.organization.areaServed = ["Berlin", "Brandenburg"];
    const ctx = createJsonLdContext(page);
    const node = buildOrganizationNode(ctx);
    expect(node.areaServed).toEqual(["Berlin", "Brandenburg"]);
  });
});
