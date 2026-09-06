import { describe, expect, it } from "vitest";
import {
  BUSINESS_DOMAIN_VISIBILITY,
  projectLocation,
  projectOffer,
  projectPeople,
  projectServices,
  projectWeb,
} from "../business-projection.ts";

describe("BUSINESS_DOMAIN_VISIBILITY", () => {
  it("marks company as public", () => {
    expect(BUSINESS_DOMAIN_VISIBILITY.company).toBe("public");
  });

  it("marks compliance as none", () => {
    expect(BUSINESS_DOMAIN_VISIBILITY.compliance).toBe("none");
  });

  it("marks externalServices as none", () => {
    expect(BUSINESS_DOMAIN_VISIBILITY.externalServices).toBe("none");
  });

  it("marks meta as pageMeta", () => {
    expect(BUSINESS_DOMAIN_VISIBILITY.meta).toBe("pageMeta");
  });
});

describe("projectOffer", () => {
  it("returns undefined for no data", () => {
    expect(projectOffer(undefined)).toBeUndefined();
  });

  it("projects prices with labels", () => {
    const result = projectOffer({ price: { monthly: "10", yearly: "100" }, currency: "EUR" });
    expect(result?.prices).toHaveLength(2);
    expect(result?.prices![0]).toEqual({
      id: "monthly",
      label: "Monthly",
      amount: "10",
      currency: "EUR",
    });
  });

  it("projects guarantees", () => {
    const result = projectOffer({
      guarantees: { availability: { label: "99.9% Uptime", detail: "SLA guaranteed" } },
    });
    expect(result?.guarantees).toHaveLength(1);
    expect(result?.guarantees![0]).toEqual({
      id: "availability",
      label: "99.9% Uptime",
      detail: "SLA guaranteed",
    });
  });

  it("projects growth modules", () => {
    const result = projectOffer({
      growthModules: { pro: { label: "Pro", description: "Advanced features", price: "50" } },
    });
    expect(result?.growthModules).toHaveLength(1);
    expect(result?.growthModules![0]).toEqual({
      id: "pro",
      label: "Pro",
      description: "Advanced features",
      price: "50",
    });
  });

  it("projects terms (changePrice, hourlyRate, billingDay)", () => {
    const result = projectOffer({ changePrice: "5", hourlyRate: "80", billingDay: "15" });
    expect(result?.changePrice).toBe("5");
    expect(result?.hourlyRate).toBe("80");
    expect(result?.billingDay).toBe("15");
  });
});

describe("projectPeople", () => {
  it("returns empty array for no records", () => {
    expect(projectPeople(undefined)).toEqual([]);
  });

  it("projects people with name and role", () => {
    const result = projectPeople([{ name: "Jane", role: "CEO", bio: "Leader" }]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Jane");
    expect(result[0].role).toBe("CEO");
    expect(result[0].description).toBe("Leader");
  });

  it("skips records without name", () => {
    const result = projectPeople([{ role: "CEO" }, { name: "Jane" }]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Jane");
  });

  it("maps sameAs and affiliations", () => {
    const result = projectPeople([
      {
        name: "Jane",
        sameAs: ["https://twitter.com/jane"],
        affiliations: ["Org A"],
      },
    ]);
    expect(result[0].sameAs).toEqual(["https://twitter.com/jane"]);
    expect(result[0].affiliations).toEqual(["Org A"]);
  });

  it("maps birth/death dates", () => {
    const result = projectPeople([{ name: "Jane", lifespan: { born: "1980", died: "2020" } }]);
    expect(result[0].birthDate).toBe("1980");
    expect(result[0].deathDate).toBe("2020");
    expect(result[0].isDeceased).toBe(true);
  });
});

describe("projectLocation", () => {
  it("returns undefined for no data", () => {
    expect(projectLocation(undefined)).toBeUndefined();
  });

  it("projects city, region, country", () => {
    const result = projectLocation({
      city: { name: "Berlin" },
      region: { name: "BE" },
      country: { name: "DE" },
    });
    expect(result?.locality).toBe("Berlin");
    expect(result?.region).toBe("BE");
    expect(result?.country).toBe("DE");
  });

  it("projects serviceArea", () => {
    const result = projectLocation({ serviceArea: ["Berlin", "Potsdam"] });
    expect(result?.serviceArea).toEqual(["Berlin", "Potsdam"]);
  });

  it("returns undefined when all fields empty", () => {
    expect(projectLocation({})).toBeUndefined();
  });
});

describe("projectServices", () => {
  it("returns empty for no records", () => {
    expect(projectServices(undefined)).toEqual([]);
  });

  it("projects services with name and description", () => {
    const result = projectServices([
      { name: "Hosting", slug: "hosting", description: "Web hosting" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: "hosting", name: "Hosting", description: "Web hosting" });
  });

  it("uses name as id when slug missing", () => {
    const result = projectServices([{ name: "Consulting" }]);
    expect(result[0].id).toBe("Consulting");
  });

  it("drops records without name", () => {
    expect(projectServices([{ description: "No name" }])).toEqual([]);
  });
});

describe("projectWeb", () => {
  it("returns undefined for no data", () => {
    expect(projectWeb(undefined)).toBeUndefined();
  });

  it("projects primaryUrl and statusUrl", () => {
    const result = projectWeb({
      primaryUrl: "https://example.com",
      statusUrl: "https://status.example.com",
    });
    expect(result?.primaryUrl).toBe("https://example.com");
    expect(result?.statusUrl).toBe("https://status.example.com");
  });

  it("projects domains", () => {
    const result = projectWeb({ domains: { primary: "example.com", german: "example.de" } });
    expect(result?.domains).toEqual({ primary: "example.com", german: "example.de" });
  });

  it("returns undefined when all fields empty", () => {
    expect(projectWeb({})).toBeUndefined();
  });
});
