import { describe, expect, it } from "vitest";
import { buildOrganizationProfile } from "../organization-profile.ts";

const baseInput = {
  lang: "de",
  siteUrl: "https://example.com",
  brandName: "Warpgogol",
  description: "Digital infrastructure",
  founders: [],
  boardMembers: [],
};

describe("buildOrganizationProfile", () => {
  it("builds organization with canonical root URL", () => {
    const result = buildOrganizationProfile(baseInput);
    expect(result.organization.name).toBe("Warpgogol");
    expect(result.organization.url).toBe("https://example.com/");
    expect(result.organization.description).toBe("Digital infrastructure");
  });

  it("emits image as og-image.png absolute URL", () => {
    const result = buildOrganizationProfile(baseInput);
    expect(result.organization.image).toBe("https://example.com/og-image.png");
  });

  it("deduplicates people by name", () => {
    const result = buildOrganizationProfile({
      ...baseInput,
      founders: [{ name: "Jane" }, { name: "John" }],
      boardMembers: [{ name: "Jane" }, { name: "Bob" }],
    });
    expect(result.people.map((p) => p.name).sort()).toEqual(["Bob", "Jane", "John"]);
  });

  it("prefers team over founders+board when available", () => {
    const result = buildOrganizationProfile({
      ...baseInput,
      founders: [{ name: "Founder" }],
      boardMembers: [{ name: "Board" }],
      team: [{ name: "Team Member" }],
    });
    expect(result.people).toHaveLength(1);
    expect(result.people[0].name).toBe("Team Member");
  });

  it("builds address from primitives", () => {
    const result = buildOrganizationProfile({
      ...baseInput,
      address: { street: "Test St", streetNumber: "1", zip: "12345", city: "Berlin", country: "DE" },
    });
    expect(result.organization.address).toEqual({
      streetAddress: "Test St 1",
      postalCode: "12345",
      addressLocality: "Berlin",
      addressCountry: "DE",
    });
  });

  it("emits contactPoints when email or contactType provided", () => {
    const result = buildOrganizationProfile({
      ...baseInput,
      email: "info@example.com",
      contactType: "support",
    });
    expect(result.organization.contactPoints).toEqual([
      { contactType: "support", email: "info@example.com" },
    ]);
  });

  it("emits donationAccount from bank primitives", () => {
    const result = buildOrganizationProfile({
      ...baseInput,
      bank: { accountHolder: "Org", iban: "DE00", bic: "BIC", bankName: "Bank", konto: "1", blz: "2" },
    });
    expect(result.organization.donationAccount).toEqual({
      accountHolder: "Org",
      iban: "DE00",
      bic: "BIC",
      bankName: "Bank",
      accountNumber: "1",
      bankCode: "2",
    });
  });

  it("emits sameAs and logo when provided", () => {
    const result = buildOrganizationProfile({
      ...baseInput,
      sameAs: ["https://twitter.com/example"],
      logoUrl: "https://example.com/logo.png",
    });
    expect(result.organization.sameAs).toEqual(["https://twitter.com/example"]);
    expect(result.organization.logo).toBe("https://example.com/logo.png");
  });

  it("emits schemaType override", () => {
    const result = buildOrganizationProfile({
      ...baseInput,
      schemaType: ["Organization", "ProfessionalService"],
    });
    expect(result.organization.schemaType).toEqual(["Organization", "ProfessionalService"]);
  });

  it("returns empty initiatives array", () => {
    const result = buildOrganizationProfile(baseInput);
    expect(result.initiatives).toEqual([]);
  });
});
