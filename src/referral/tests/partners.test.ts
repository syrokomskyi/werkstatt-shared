/*
<MODULE_CONTRACT>
<purpose>
[RFC-1222] Unit tests for the referral-partner contract: v2 schema boundaries
(status lifecycle, structured consent union, role, retiredAt), loader
classification (pending|active|retired, malformed, reserved, duplicate),
resolveReferralPartner normalization, and the slug-PII guard.
</purpose>
<non-goals>
  <item>Does not test route generation or HTTP — loader/resolver purity only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198: created.</item>
  <item>RFC-1222: rewritten for schema v2 — lifecycle sets, consent union (none|document|channel), active⇒consent and retired⇒retiredAt refinements, slugContainsNameToken; v1 field rejection asserted (forward-only).</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, test } from "vitest";
import {
  loadActiveReferralPartners,
  loadReferralLandingConfig,
  loadReferralPartners,
  REF_PARAM_PATTERN,
  REFERRER_MAX_LENGTH,
  ReferralPartnerSchema,
  resolveReferralPartner,
  RESERVED_REFERRAL_SLUGS,
  slugContainsNameToken,
  type ReferralPartner,
} from "../partners.ts";

const ACTIVE: ReferralPartner = {
  slug: "ostpost",
  displayName: "Luba Kemenova",
  compensation: "referral-fee",
  locales: ["de", "uk"],
  status: "active",
  consent: { method: "document", ref: "trust/consents/ostpost", grantedAt: "2026-10-01" },
};

const PENDING: ReferralPartner = {
  ...ACTIVE,
  status: "pending",
  consent: { method: "none" },
};

const RETIRED: ReferralPartner = {
  ...ACTIVE,
  status: "retired",
  retiredAt: "2026-12-31",
};

function yamlOf(body: string): Record<string, string> {
  return { "/src/content/referral-partners/partners.yaml": body };
}

const partnerYaml = (extra = "") => `partners:
  - slug: "ostpost"
    displayName: "Luba Kemenova"
    compensation: "referral-fee"
    locales: ["de", "uk"]
    status: "active"
    consent: { method: "document", ref: "trust/consents/ostpost", grantedAt: "2026-10-01" }
${extra}`;

describe("ReferralPartnerSchema v2", () => {
  test("accepts a fully-specified active partner", () => {
    expect(ReferralPartnerSchema.parse(ACTIVE)).toEqual(ACTIVE);
  });

  test("accepts pending with consent.method none", () => {
    expect(ReferralPartnerSchema.parse(PENDING)).toEqual(PENDING);
  });

  test("accepts channel consent", () => {
    const p = {
      ...ACTIVE,
      consent: { method: "channel", channel: "telegram", grantedAt: "2026-10-01" },
    };
    expect(ReferralPartnerSchema.parse(p)).toEqual(p);
  });

  test.each([
    ["active with consent.method none", { ...ACTIVE, consent: { method: "none" } }],
    [
      "active with consent lacking grantedAt",
      { ...ACTIVE, consent: { method: "document", ref: "x" } },
    ],
    ["retired without retiredAt", { ...ACTIVE, status: "retired" }],
    ["pending carrying retiredAt", { ...PENDING, retiredAt: "2026-12-31" }],
    ["legacy v1 field publicNameConsentRef", { ...ACTIVE, publicNameConsentRef: "c" }],
    ["legacy v1 field active", { ...ACTIVE, active: true }],
    [
      "consent with unknown key",
      { ...ACTIVE, consent: { method: "none", grantedAt: "2026-10-01" } },
    ],
    ["role locale outside locales", { ...ACTIVE, role: { fr: "Rôle" } }],
  ])("rejects %s", (_label, partner) => {
    const result = ReferralPartnerSchema.safeParse(partner);
    expect(
      result.success,
      "v2 schema must reject this shape — check ReferralPartnerSchema superRefine/strict members",
    ).toBe(false);
  });

  test.each([
    ["too short", "ab"],
    ["too long", "a".repeat(33)],
    ["uppercase", "Anna"],
    ["leading dash", "-anna"],
    ["double dash", "an--na"],
    ["reserved", "admin"],
  ])("rejects invalid slug: %s", (_label, slug) => {
    expect(ReferralPartnerSchema.safeParse({ ...ACTIVE, slug }).success).toBe(false);
  });
});

describe("loadReferralPartners lifecycle classification", () => {
  test("classifies pending/active/retired into separate sets", () => {
    const raw = `partners:
  - slug: "ostpost"
    displayName: "Luba Kemenova"
    compensation: "referral-fee"
    locales: ["de"]
    status: "pending"
    consent: { method: "none" }
  - slug: "markt-blick"
    displayName: "Maria I."
    compensation: "steward"
    locales: ["de"]
    status: "active"
    consent: { method: "channel", channel: "email", grantedAt: "2026-09-15" }
  - slug: "alt-werk"
    displayName: "Peter P."
    compensation: "none"
    locales: ["de"]
    status: "retired"
    retiredAt: "2026-08-01"
    consent: { method: "document", ref: "trust/consents/alt-werk", grantedAt: "2026-01-10" }
`;
    const sets = loadReferralPartners(yamlOf(raw));
    expect(sets.pending.map((p) => p.slug)).toEqual(["ostpost"]);
    expect(sets.active.map((p) => p.slug)).toEqual(["markt-blick"]);
    expect(sets.retired.map((p) => p.slug)).toEqual(["alt-werk"]);
  });

  test("loadActiveReferralPartners returns only the active set", () => {
    const raw = `partners:
  - slug: "ostpost"
    displayName: "Luba Kemenova"
    compensation: "referral-fee"
    locales: ["de"]
    status: "pending"
    consent: { method: "none" }
`;
    expect(loadActiveReferralPartners(yamlOf(raw))).toEqual([]);
  });

  test("returns empty sets for missing file", () => {
    expect(loadReferralPartners({})).toEqual({ active: [], retired: [], pending: [], paused: [] });
  });

  test("rejects duplicate slugs — the whole file fails schema validation", () => {
    const warns: { code: string; data: Record<string, unknown> }[] = [];
    const dup = partnerYaml(`  - slug: "ostpost"
    displayName: "Other"
    compensation: "none"
    locales: ["de"]
    status: "pending"
    consent: { method: "none" }
`);
    const sets = loadReferralPartners(yamlOf(dup), (c, d) => warns.push({ code: c, data: d }));
    expect(sets.active).toEqual([]);
    expect(warns.map((w) => w.code)).toContain("referral.partners.invalid");
    expect(warns[0]?.data.detail).toContain("duplicate partner slug");
  });

  test("warns and skips a malformed file instead of throwing", () => {
    const warns: string[] = [];
    expect(
      loadReferralPartners({ "partners.yaml": "partners: [{broken" }, (c) => warns.push(c)),
    ).toEqual({ active: [], retired: [], pending: [], paused: [] });
    expect(warns).toContain("referral.partners.invalid");
  });

  test("a legacy v1 file invalidates the whole registry (forward-only)", () => {
    const warns: { code: string; data: Record<string, unknown> }[] = [];
    const legacy = `partners:
  - slug: "ostpost"
    displayName: "Luba Kemenova"
    compensation: "referral-fee"
    locales: ["de"]
    active: true
    publicNameConsentRef: "consent-1"
`;
    const sets = loadReferralPartners(yamlOf(legacy), (c, d) => warns.push({ code: c, data: d }));
    expect(sets.active).toEqual([]);
    expect(warns.map((w) => w.code)).toContain("referral.partners.invalid");
  });
});

describe("loadReferralLandingConfig", () => {
  test("returns the authored landing block verbatim", () => {
    const raw = `landing:
  rewardPhrases:
    referral-fee: { de: "70 €", uk: "70 €" }
  stewardRole: { de: "Markt-Steward" }
  audiencePhrase: { de: "Firmenwebsites", uk: "вебсайти" }
  conditionsNote: { de: "(AGB § 3 Abs. 5)" }
${partnerYaml()}`;
    const config = loadReferralLandingConfig({ "partners.yaml": raw });
    expect(config?.stewardRole?.de).toBe("Markt-Steward");
    expect(config?.rewardPhrases?.["referral-fee"]?.uk).toBe("70 €");
    expect(config?.audiencePhrase?.de).toBe("Firmenwebsites");
    expect(config?.conditionsNote?.de).toBe("(AGB § 3 Abs. 5)");
  });

  test("returns null when the block is absent or malformed", () => {
    expect(loadReferralLandingConfig(yamlOf(partnerYaml()))).toBeNull();
    expect(
      loadReferralLandingConfig({ "partners.yaml": "landing: { bogus: 1 }\npartners: []" }),
    ).toBeNull();
  });
});

describe("resolveReferralPartner", () => {
  const partners = [ACTIVE];

  test("resolves an exact slug", () => {
    expect(resolveReferralPartner("ostpost", partners)).toEqual(ACTIVE);
  });

  test("trims and lower-cases before matching", () => {
    expect(resolveReferralPartner("  OSTPOST  ", partners)).toEqual(ACTIVE);
  });

  test("never resolves a pending or retired slug", () => {
    expect(resolveReferralPartner("ostpost", [PENDING])).toBeNull();
    expect(resolveReferralPartner("ostpost", [RETIRED])).toBeNull();
  });

  test.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["unknown slug", "boris"],
    ["over-length", "a".repeat(REFERRER_MAX_LENGTH + 1)],
    ["free text", "mein Nachbar hat empfohlen"],
  ])("returns null for %s", (_label, input) => {
    expect(resolveReferralPartner(input, partners)).toBeNull();
  });
});

describe("slugContainsNameToken (slug-PII guard)", () => {
  test("flags a slug carrying a displayName token", () => {
    expect(slugContainsNameToken("luba-kemenova", "Luba Kemenova")).toBe(true);
    expect(slugContainsNameToken("luba-tipps", "Luba Kemenova")).toBe(true);
  });

  test("accepts a pseudonymous slug", () => {
    expect(slugContainsNameToken("ostpost", "Luba Kemenova")).toBe(false);
  });

  test("ignores short tokens and substring-only overlap", () => {
    expect(slugContainsNameToken("marktplatz-ost", "Max Os")).toBe(false);
    expect(slugContainsNameToken("annate", "Anna Beispiel")).toBe(false);
  });
});

describe("patterns", () => {
  test("REF_PARAM_PATTERN bounds ?ref values to slug-like charset", () => {
    expect(REF_PARAM_PATTERN.test("ostpost")).toBe(true);
    expect(REF_PARAM_PATTERN.test("a-b-c")).toBe(true);
    expect(REF_PARAM_PATTERN.test("ab")).toBe(false);
    expect(REF_PARAM_PATTERN.test("anna<script>")).toBe(false);
    expect(REF_PARAM_PATTERN.test("a".repeat(33))).toBe(false);
  });

  test("reserved list covers platform namespaces only, not site routes", () => {
    for (const slug of ["admin", "api", "portal", "r", "robots", "sitemap", "well-known"]) {
      expect(RESERVED_REFERRAL_SLUGS).toContain(slug);
    }
    for (const slug of ["kontakt", "agb", "datenschutz", "uk", "de"]) {
      expect(RESERVED_REFERRAL_SLUGS).not.toContain(slug);
    }
  });
});
