/*
<MODULE_CONTRACT>
<purpose>
[RFC-1198] Unit tests for the referral-partner contract: schema boundaries,
loadActiveReferralPartners filtering (inactive, consent-missing, malformed,
reserved, duplicate), and resolveReferralPartner normalization.
</purpose>
<non-goals>
  <item>Does not test route generation or HTTP — loader/resolver purity only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1198: created.</item>
  <item>RFC-1198: cookie-free referral attribution — /r/<slug> partner landings + voluntary referrer field

Replace the RFC-1191 wg_ref cookie capture with URL+form attribution:
static /r/<slug> and /<lang>/r/<slug> partner landings (noindex, zero JS,
consent-gated via publicNameConsentRef), ?ref prefill on the existing
referrerField rail, server-side slug resolution against the bundled
partners.yaml, referral_partner_slug/name on the Lagebild ingress contract,
legacy /?ref -> /r/<slug> 302 in the generated worker, and full removal of
the cookie capture module (wg_ref, referral.attribution entitlement,
payload.attribution).</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, test } from "vitest";
import {
  loadActiveReferralPartners,
  loadReferralLandingConfig,
  REF_PARAM_PATTERN,
  REFERRER_MAX_LENGTH,
  ReferralPartnerSchema,
  resolveReferralPartner,
  RESERVED_REFERRAL_SLUGS,
  type ReferralPartner,
} from "../partners.ts";

const VALID: ReferralPartner = {
  slug: "anna",
  displayName: "Anna Beispiel",
  compensation: "referral-fee",
  locales: ["de", "uk"],
  active: true,
  publicNameConsentRef: "consent-2026-10-01",
};

function yamlOf(partners: unknown): Record<string, string> {
  return { "/src/content/referral-partners/partners.yaml": toYaml(partners) };
}

function toYaml(partners: unknown): string {
  const list = (partners as Record<string, unknown>[]).map((p) => {
    const entries = Object.entries(p).map(([k, v]) => {
      if (Array.isArray(v)) return `  ${k}: [${v.map((x) => `"${x}"`).join(", ")}]`;
      if (typeof v === "boolean") return `  ${k}: ${v}`;
      return `  ${k}: "${String(v).replace(/"/g, '\\"')}"`;
    });
    return `- slug: "${(p as { slug: string }).slug}"\n${entries.filter((e) => !e.startsWith("  slug:")).join("\n")}`;
  });
  return `partners:\n${list.join("\n")}`;
}

describe("ReferralPartnerSchema", () => {
  test("accepts a fully-specified partner", () => {
    expect(ReferralPartnerSchema.parse(VALID)).toEqual(VALID);
  });

  test.each([
    ["too short", "ab"],
    ["too long", "a".repeat(33)],
    ["uppercase", "Anna"],
    ["leading dash", "-anna"],
    ["trailing dash", "anna-"],
    ["double dash", "an--na"],
    ["underscore", "an_na"],
    ["reserved", "admin"],
  ])("rejects invalid slug: %s", (_label, slug) => {
    expect(ReferralPartnerSchema.safeParse({ ...VALID, slug }).success).toBe(false);
  });

  test("rejects unknown compensation variant", () => {
    expect(ReferralPartnerSchema.safeParse({ ...VALID, compensation: "cash" }).success).toBe(false);
  });

  test("rejects empty locales", () => {
    expect(ReferralPartnerSchema.safeParse({ ...VALID, locales: [] }).success).toBe(false);
  });
});

describe("loadActiveReferralPartners", () => {
  test("returns active partners with consent ref", () => {
    expect(loadActiveReferralPartners(yamlOf([VALID]))).toEqual([VALID]);
  });

  test("returns empty for missing file", () => {
    expect(loadActiveReferralPartners({})).toEqual([]);
  });

  test.each([
    ["inactive", { ...VALID, active: false }],
    ["empty consent ref", { ...VALID, publicNameConsentRef: "   " }],
    ["reserved slug", { ...VALID, slug: "admin" }],
  ])("excludes %s partners", (_label, partner) => {
    const warns: string[] = [];
    expect(loadActiveReferralPartners(yamlOf([partner]), (c) => warns.push(c))).toEqual([]);
  });

  test("rejects duplicate slugs — the whole file fails schema validation", () => {
    // A duplicate slug is ambiguous attribution (which partner is paid?) —
    // the schema refuses the file outright instead of silently keeping the
    // first entry. The loader surfaces the failure as referral.partners.invalid.
    const other = { ...VALID, displayName: "Other" };
    const warns: { code: string; data: Record<string, unknown> }[] = [];
    const out = loadActiveReferralPartners(yamlOf([VALID, other]), (c, d) =>
      warns.push({ code: c, data: d }),
    );
    expect(out).toEqual([]);
    expect(warns.map((w) => w.code)).toContain("referral.partners.invalid");
    expect(warns[0]?.data.detail).toContain("duplicate partner slug");
  });

  test("warns and skips a malformed file instead of throwing", () => {
    const warns: string[] = [];
    expect(
      loadActiveReferralPartners({ "partners.yaml": "partners: [{broken" }, (c) => warns.push(c)),
    ).toEqual([]);
    expect(warns).toContain("referral.partners.invalid");
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
partners:
  - slug: "anna"
    displayName: "Anna"
    compensation: "referral-fee"
    locales: ["de"]
    active: true
    publicNameConsentRef: "consent-1"
`;
    const config = loadReferralLandingConfig({ "partners.yaml": raw });
    expect(config?.stewardRole?.de).toBe("Markt-Steward");
    expect(config?.rewardPhrases?.["referral-fee"]?.uk).toBe("70 €");
    expect(config?.audiencePhrase?.de).toBe("Firmenwebsites");
    expect(config?.conditionsNote?.de).toBe("(AGB § 3 Abs. 5)");
  });

  test("returns null when the block is absent or malformed", () => {
    expect(loadReferralLandingConfig(yamlOf([VALID]))).toBeNull();
    expect(
      loadReferralLandingConfig({ "partners.yaml": "landing: { bogus: 1 }\npartners: []" }),
    ).toBeNull();
  });
});

describe("resolveReferralPartner", () => {
  const partners = [VALID];

  test("resolves an exact slug", () => {
    expect(resolveReferralPartner("anna", partners)).toEqual(VALID);
  });

  test("trims and lower-cases before matching", () => {
    expect(resolveReferralPartner("  ANNA  ", partners)).toEqual(VALID);
  });

  test.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["unknown slug", "boris"],
    ["over-length", "a".repeat(REFERRER_MAX_LENGTH + 1)],
    ["free text", "mein Nachbar Anna hat empfohlen"],
  ])("returns null for %s", (_label, input) => {
    expect(resolveReferralPartner(input, partners)).toBeNull();
  });
});

describe("patterns", () => {
  test("REF_PARAM_PATTERN bounds ?ref values to slug-like charset", () => {
    expect(REF_PARAM_PATTERN.test("anna")).toBe(true);
    expect(REF_PARAM_PATTERN.test("a-b-c")).toBe(true);
    expect(REF_PARAM_PATTERN.test("ab")).toBe(false);
    expect(REF_PARAM_PATTERN.test("anna<script>")).toBe(false);
    expect(REF_PARAM_PATTERN.test("a".repeat(33))).toBe(false);
  });

  test("reserved list covers platform namespaces only, not site routes", () => {
    for (const slug of ["admin", "api", "portal", "r", "robots", "sitemap", "well-known"]) {
      expect(RESERVED_REFERRAL_SLUGS).toContain(slug);
    }
    // Site route names (kontakt, agb, datenschutz) are site content, not a
    // platform concern — a slug colliding with a route 404s at build time
    // via the routes manifest, not via this list.
    for (const slug of ["kontakt", "agb", "datenschutz", "uk", "de"]) {
      expect(RESERVED_REFERRAL_SLUGS).not.toContain(slug);
    }
  });
});
