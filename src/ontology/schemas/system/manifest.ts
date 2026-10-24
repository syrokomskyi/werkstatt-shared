/*
<MODULE_CONTRACT>
<purpose>Top-level system manifest schema (RFC-0025): binds a client application to a cosmic identity, a single Biome, and optional Constellations.</purpose>
<non-goals>
  <item>Do not introduce app-specific runtime composition or deployment behavior into this reusable package source file.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0384: pseo block — cardinalityLimit (default 10_000 override) + highCardinalityExperiment for surface.plan.generate.</item>
  <item>RFC-1374: pseo autonomy scope sinceAt accepts YAML-native Date scalars via isoDateString — parse normalizes to ISO-8601 strings.</item>
  <item>RFC-1283: step 1 — publication.gate in systemManifestSchema

Per-site PBP publication gate mode (warn | enforce, absent = warn) consumed
by PUBGATE-01 in pbp.content.validate and PUBGATE-02 in
dist.content-references.validate.</item>
  <item>RFC-1293: require timing semantics on time-bound policy fields via contractTerms.gate (RFC-1293)

policySchema gains an optional timing map (pbpTimingSchema: startEvent, clock,
timezone, businessHours, boundary) inherited by every specialized policy.
pbp.content.validate sweeps each pbp/* entity's frontmatter — TIMED_FIELDS
registry paths plus every ISO-8601 duration literal — and emits
PBP-TIMING-01..04 at contractTerms.gate severity (warn|enforce in system.md;
absent = warn). enforce also makes pbp.terms-reference.validate behave as
--strict. New sites register with contractTerms.gate: enforce
(sternsystem-register stub + both onboarding system templates). Live warpgogol
run: 129 PBP-TIMING-01 warnings across policies/offerings/documents/claims —
the owner's contract-decision agenda; no timing values authored, no site gate
flipped. Known registry gap: renewal.renewalPeriod/reminder are not ISO-shaped
and escape the sweep (documented in the RFC evidence). Canary C10 active.</item>
  <item>RFC-1294: require verbatim source provenance for external local facts (RFC-1294)

localFacts[] entries gain sourceUrl/excerpt/excerptLang/scope/reviewedBy/
reviewedAt. surface.evidence.validate sweeps every blueprint dataset record's
localFacts once per source file and emits LOCALFACT-01 (missing
sourceUrl/excerpt), LOCALFACT-02 (off-host sourceUrl — dot-boundary subdomains
of the descriptor endpoint host pass), LOCALFACT-03 (normalized number absent
from the verbatim excerpt), LOCALFACT-04 (stale asOf+reviewEvery, always a
warning). systemManifestSchema gains provenance.gate (warn|enforce, absent =
warn; new sites register enforce). The bake renders 'Geprüfte lokale Fakten'
only when every rendered fact carries a human review record — otherwise the
neutral 'Lokaler Kontext' — plus a Quellen block listing each distinct
sourceUrl with its asOf date. Live warpgogol run: 40 LOCALFACT-01 warnings
across the 12 city demand records — the owner's research backlog; no excerpts,
review records, or gate flips authored. Canary C11 active.</item>
  <history>ADR-0062, ADR-0114, RFC-0303, RFC-0377, RFC-1106, RFC-1161, RFC-1187, RFC-1209, RFC-1229, RFC-1307, RFC-1341</history>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

import { systemSharedContextSchema, systemGrowthSchema } from "./growth.ts";
import { systemReleaseSchema } from "./release.ts";
import { systemTextSchema, systemTypographySchema } from "./text.ts";
import { systemIntegrationsSchema } from "./integrations.ts";
import { systemVerificationSchema } from "./verification.ts";
import { systemShellContractSchema } from "./shell-contract.ts";
import { camAuthoritySchema } from "./authority.ts";
import { resourceBudgetConfigSchema } from "../../../policy/resource-budget.ts";
import { semanticPageTypeSchema, articleMetadataSchema, pageOutputSchema } from "./page-output.ts";
import { isoDateString } from "../iso-date.ts";

/**
 * The per-app system.yaml manifest. Binds the client app to its cosmic identity.
 * One file per app — stored at apps/<app-slug>/system.yaml.
 *
 * Constraints enforced here (structural):
 *   - identity.biome is a scalar (single biome per app — multi-biome is permanently forbidden)
 *   - constellations references are kebab-case slugs matching files in packages/werkstatt-site/src/domain/ontology/constellations/
 *
 * Cross-file constraints (enforced by validators, not this schema):
 *   - identity.systemStar must match a StarCatalog entry used in one page manifest
 *   - identity.biome must match an existing biome YAML id
 *   - constellations[] entries must resolve to existing constellation YAMLs
 */
/**
 * RFC-0052 crawl policy block (`robots:`) consumed by robots.generate and
 * robots.validate. RFC-0784 adds contentSignal; RFC-1161 derives the named
 * AI-training bot group from it (ai-train=no → Disallow group for
 * AI_TRAINING_CRAWLER_REGISTRY train tokens).
 */
export const systemRobotsSchema = z.object({
  defaultPolicy: z.enum(["allow", "disallow"]).optional(),
  disallowedPaths: z.array(z.string()).optional(),
  allowedPaths: z.array(z.string()).optional(),
  crawlerBlocklist: z.array(z.string()).optional(),
  crawlerAllowlist: z.array(z.string()).optional(),
  sitemap: z.string().optional(),
  customRules: z
    .array(
      z.object({
        userAgent: z.string().min(1),
        disallow: z.array(z.string()).optional().default([]),
        allow: z.array(z.string()).optional().default([]),
      }),
    )
    .optional(),
  /** RFC-0784 Content-Signal tokens (e.g. "ai-train=no", "search=yes"). */
  contentSignal: z.array(z.string()).optional(),
});

export const systemManifestSchema = z.object({
  /**
   * Stable kebab-case slug for this app — matches the apps/<slug>/ directory name.
   * Example: "my-app"
   */
  app: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, "app must be kebab-case (lowercase letters, digits, hyphens)"),

  /**
   * Semantic version of this system manifest.
   */
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i, "version must be valid semver"),

  /**
   * Cosmic identity block — assigns this app its place in the cosmic overlay.
   */
  identity: z.object({
    /**
     * The IAU star name that identifies the "home star" of this system.
     * Must match a StarCatalog entry that is also used as the cosmicName
     * of at least one page manifest in this app.
     * Validated cross-file by system.manifest.validate.
     */
    systemStar: z.string().min(1),

    /**
     * The single Biome applied to this app.
     * Must match a biome id from packages/werkstatt-site/src/domain/ontology/biomes/.
     * Multi-biome per app is permanently forbidden (DNA-23, RFC-0025).
     * Validated cross-file by biome.contract.validate.
     */
    biome: z.string().min(1),

    /**
     * Human-readable tagline for this system, shown in the Cosmic Passport.
     * Example: "Building a better future for local communities"
     */
    tagline: z.string().min(1).optional(),

    /**
     * Canonical FQDN for this app (without protocol or path).
     * Seeded by sternsystem.register --intake from the intake's
     * classification.domain when it is confirmed; left unset while the domain
     * is an open onboarding gap (RFC-1307).
     */
    domain: z.string().min(1).optional(),

    /**
     * ADR-0062: App-level default CTA target — the pageId of the contact/CTA page.
     * Per-page `ctaTarget` in pages[] overrides this app-level default.
     * Used by resolve-route.ts to populate `ctaTarget` in PageRouteData.
     */
    ctaTarget: z.string().min(1).optional(),

    /**
     * RFC-0096: Operator details consumed by legal.scaffold to fill
     * Impressum / Datenschutz stubs.
     * ADR-0114: name/vatId carry the rest of the seeded legal identity
     * (pbp/legal-identity legalName + publicIdentifiers.vatId).
     */
    legal: z
      .object({
        responsibleName: z.string().min(1).optional(),
        address: z.string().min(1).optional(),
        email: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        vatId: z.string().min(1).optional(),
      })
      .optional(),
  }),

  /**
   * Internationalization configuration (RFC-0038).
   * Declares default language and supported language map.
   */
  i18n: z
    .object({
      default: z.string().min(1),
      supported: z.record(z.string(), z.any()),
    })
    .optional(),

  /**
   * RFC-1283: PBP publication gate mode; absent = "warn".
   * `enforce` turns references into non-published business-profile entities
   * into PUBGATE-01 violations (pbp.content.validate) and makes distinctive
   * draft-entity values in built output fail PUBGATE-02
   * (dist.content-references.validate); `warn` logs the same findings as
   * warnings. Register-from-intake writes `enforce` for new sites; legacy
   * sites stay on `warn` until a cleanup mission.
   */
  publication: z
    .object({
      gate: z.enum(["warn", "enforce"]),
      /**
       * RFC-1341: content-use ceiling; absent = "public" (today's two-state
       * behaviour). `preview` lets register-gated (ceiling: preview) entities
       * render on PIN-protected channels with a visible badge; the main gate
       * refuses the derived release tier via PUBTIER-01.
       */
      ceiling: z.enum(["public", "preview"]).optional(),
    })
    .strict()
    .optional(),

  /**
   * RFC-1293: contract-terms gate; absent = "warn".
   * `enforce` turns missing/invalid `timing` semantics on time-bound policy
   * fields into PBP-TIMING-01..04 violations (pbp.content.validate) and makes
   * TERMS-DRIFT-* findings blocking in pbp.terms-reference.validate; `warn`
   * logs the same findings as warnings. New sites register with `enforce`;
   * legacy sites stay on `warn` until the owner decides the timing semantics.
   */
  contractTerms: z
    .object({
      gate: z.enum(["warn", "enforce"]),
    })
    .strict()
    .optional(),

  /**
   * RFC-1294: external local-fact provenance gate; absent = "warn".
   * `enforce` turns missing verbatim-source fields, off-host source URLs, and
   * numbers absent from the recorded excerpt into LOCALFACT-01..03 violations
   * (surface.evidence.validate); `warn` logs the same findings as warnings.
   * LOCALFACT-04 (staleness) is always a warning. New sites register with
   * `enforce`; legacy sites stay on `warn` until the owner sources the facts.
   */
  provenance: z
    .object({
      gate: z.enum(["warn", "enforce"]).optional(),
    })
    .strict()
    .optional(),

  /**
   * RFC-1307: ISO 3166-1 alpha-2 legal jurisdiction seeded from the intake
   * classification at birth (sternsystem.register --intake). Optional —
   * pre-intake systems carry no value.
   */
  legalJurisdiction: z
    .string()
    .regex(/^[A-Z]{2}$/, "legalJurisdiction must be an ISO 3166-1 alpha-2 code")
    .optional(),

  /**
   * Constellations (composition patterns) active in this app.
   * Each entry is a kebab-case slug matching a file in packages/werkstatt-site/src/domain/ontology/constellations/.
   * Validated cross-file by constellation.compose.validate.
   * Empty array = no composition-pattern validation is performed.
   */
  constellations: z
    .array(z.string().regex(/^[a-z][a-z0-9-]*$/, "constellation slug must be kebab-case"))
    .optional()
    .default([]),

  /**
   * Client-editable surface declarations — kebab-case keys of content sections
   * that the client may edit without engineering involvement (DNA-22, RFC-0025).
   * Validated by client.edit.validate at deploy time.
   */
  clientEditable: z.array(z.string().min(1)).optional().default([]),

  /**
   * RFC-1259: optional Content-Authority Model block. When present, it is the
   * single authorization model consulted by write paths — `clientEditable[]`
   * becomes its `studio-gate-client` projection, pseo autonomy scopes its
   * `pseo-generator` instance, and approval gates first-class declarations.
   * Absent ⇒ legacy behavior (no CAM consultation). Validated by
   * `authority.model.validate` (CAM-01..05).
   */
  authority: camAuthoritySchema.optional(),

  sharedContext: systemSharedContextSchema.optional(),

  /**
   * Per-page composition pins (RFC-0026, RFC-0048).
   * Each entry pins the section versions active for a given page.
   * Validated by page.block.validate — every blocks[].use in page content must
   * appear in the matching pageId's planets[] list.
   */
  pages: z
    .array(
      z.object({
        /**
         * RFC-0048: Stable page identifier across languages (e.g., "privacyPolicy").
         * Used as the canonical key for page lookup and route resolution.
         */
        pageId: z.string().min(1),

        /**
         * RFC-0048: Language-keyed route slugs (e.g., { de: "datenschutz", en: "privacy" }).
         * Maps each supported language to its localized URL slug.
         */
        routes: z.record(z.string(), z.string()).optional(),

        /**
         * RFC-0048 (legacy): URL route path for this page (e.g. "/", "/spenden").
         * Kept for backward compatibility during migration; use pageId + routes instead.
         */
        route: z.string().min(1).optional(),

        /**
         * RFC-0097: Explicit locale opt-in. When set, the page exists only in
         * these locales — runtime resolvers, getStaticPaths, and the
         * language-switcher all short-circuit silently for locales outside
         * the set. Use for pages whose existence is locale-dependent
         * (Impressum is DE/AT/CH-only; US-specific privacy pages are en-only).
         * Each entry must be a key of `i18n.supported`; cross-validation lives
         * in `system.contract.validate`.
         */
        locales: z.array(z.string().min(1)).optional(),

        /**
         * RFC-0042/RFC-0050: semantic role of the page. Optional — pages without
         * a semanticType do not enter the semantic model (no JSON-LD / llms output).
         */
        semanticType: semanticPageTypeSchema.optional(),

        /**
         * RFC-0377: optional audience override for this page. When absent, the twin generator
         * falls back to the SemanticPageType derivation map (AUDIENCE_BY_PAGE_TYPE).
         */
        audience: z.string().min(1).optional(),

        /**
         * RFC-0229: optional parent pageId for the breadcrumb hierarchy. When set, the page's
         * breadcrumb trail becomes Home → …parent chain… → self instead of the flat Home → self.
         * The referenced pageId must exist in this `pages[]` list and the chain must be acyclic —
         * `breadcrumb.trail.validate` enforces both. Omit for top-level pages (Home → self).
         */
        parentPageId: z.string().min(1).optional(),

        /**
         * Standalone page: exists in the route registry for link/semantic-target
         * resolution but is rendered by a dedicated .astro file (not [...slug].astro).
         * Excluded from getStaticPathsForDefaultLang to avoid route conflicts.
         */
        standalone: z.boolean().optional(),

        /**
         * RFC-0143: per-page output projection container (sitemap, llms, …).
         * Closed object — only known generator keys are accepted.
         */
        output: pageOutputSchema.optional(),

        /**
         * RFC-0803: per-page deployment gating. When production is false,
         * the page is excluded from production builds (no HTML output, no
         * sitemap entry, no navigation links, no llms.txt entry). The page
         * remains visible in astro dev. Defaults to true.
         */
        deployment: z
          .object({
            production: z.boolean().default(true),
          })
          .optional(),

        /** RFC-0167: article metadata — when present, the page emits Article JSON-LD. */
        article: articleMetadataSchema.optional(),

        /**
         * The cosmicName of the page archetype from StarCatalog.
         * Must match the cosmicName of the page's manifest.yaml.
         */
        cosmicStar: z.string().min(1),

        /**
         * Optional constellation slug for this page.
         * When present, constellation.compose.validate checks that the page's
         * planets match the constellation's required slots.
         */
        constellation: z.string().optional(),

        /**
         * Optional shell block configuration for this page.
         * Controls page-level shell elements like background.
         */
        shell: z
          .object({
            background: z
              .object({
                enabled: z.boolean(),
                cosmicMoon: z.string().min(1),
                pin: z.string().min(1),
                props: z.record(z.string(), z.unknown()).optional(),
              })
              .optional(),
            /**
             * RFC-1229: bound shell profile name — resolves the page to a
             * shellContract.profiles entry. Outranks routeProfiles globs.
             */
            profile: z.string().min(1).optional(),
          })
          .optional(),

        /**
         * Ordered list of planet section pins active on this page.
         * Each cosmicPlanet must appear in PlanetCatalog and be used
         * in the page's block-declarative content.
         */
        planets: z
          .array(
            z.object({
              /** PlanetCatalog name for this section archetype. */
              cosmicPlanet: z.string().min(1),
              /**
               * Semver pin against packages/ui section version.
               * "latest" is accepted at MVP for apps without strict version pins.
               */
              pin: z.string().min(1),
            }),
          )
          .optional()
          .default([]),

        /**
         * RFC-0922 / ADR-0062: per-page section nav toggle. When false, the
         * page template skips extractSectionNavItems and the Header secondary
         * nav strip is omitted. Defaults to true when absent.
         */
        sectionNav: z.boolean().optional(),

        /**
         * ADR-0062: per-page CTA target override. When present, overrides the
         * app-level `identity.ctaTarget` for this page.
         */
        ctaTarget: z.string().min(1).optional(),
      }),
    )
    .optional()
    .default([]),

  /**
   * Growth layer binding (RFC-0027).
   * When absent, the growth layer is inactive and <GrowthProvider> is omitted.
   * When present, growth.vendor.adapter determines which adapter is loaded on the client.
   */
  growth: systemGrowthSchema.optional(),

  /**
   * Release configuration (RFC-0028).
   * Controls Cosmic Passport, Star Map, and Pulsar heartbeat.
   * When absent, passport page is not rendered but passport.json is still emitted.
   */
  release: systemReleaseSchema.optional(),

  /**
   * RFC-0052 crawl policy (`robots:`) for robots.generate/robots.validate.
   * RFC-1161: contentSignal ai-train=no derives the named AI-training
   * Disallow group in robots.txt.
   */
  robots: systemRobotsSchema.optional(),

  /**
   * RFC-0235: egress text normalization. Strips AI-authorship typographic
   * signals from all public output at build egress. Adapter, not source rewrite.
   * Absent ⇒ all signals on. Client-writable.
   */
  text: systemTextSchema.optional(),

  /**
   * RFC-1070: typography validator configuration. Allowed tokens and
   * per-locale abbreviation overrides. Client-writable.
   */
  typography: systemTypographySchema.optional(),

  /**
   * RFC-1209: resource-budget declaration. `resourceBudget` carries per-site
   * byte/request ceilings (`maxPageWeightKb`, `maxJsKb`, `maxRequests`,
   * `maxThirdPartyOrigins`), an `enforce` mode (advisory default; blocking is
   * per-site opt-in), and optional `routeOverrides`. When omitted the site
   * resolves to the workspace baseline in `RESOURCE_BUDGET_BASELINE`
   * (`@warpgogol/werkstatt-shared/policy/resource-budget`). Measured on-disk
   * against `dist/client` by `resource.budget.validate`; the public report is
   * emitted to `public/.well-known/resource-budget.json` by
   * `resource.budget.report`. Client-writable.
   */
  resourceBudget: resourceBudgetConfigSchema.optional(),

  /**
   * RFC-0169: subscription billing binding. `billing.stripeCustomerId` is the
   * Stripe customer whose active Entitlements gate this site's paid modules.
   */
  billing: z
    .object({
      stripeCustomerId: z.string().min(1).optional(),
      // RFC-0196: offline/dogfood Programmatic Surface index budget (top-K indexable pages by
      // substance). With Stripe, the budget is derived from the tier lookup-key (PSEO_TIER_BUDGET).
      pseoIndexBudget: z.number().int().min(0).optional(),
      // RFC-0240: offline/dogfood regional-hub-or-higher pseo tier unlock (unlocks d3 region hubs).
      // With Stripe, this is derived from the active tier lookup-key (PSEO_REGIONAL_TIERS).
      pseoRegionalUnlocked: z.boolean().optional(),
    })
    .optional(),

  /**
   * RFC-0169: offline entitlement override for dev/CI (deterministic, no network).
   * When present, wins over Stripe resolution.
   */
  entitlementsOverride: z.array(z.string().min(1)).optional(),

  /**
   * RFC-0384: Programmatic Surface plan policy. `cardinalityLimit` overrides the 10_000
   * default single-site candidate-page limit; `highCardinalityExperiment` suppresses the
   * cardinality warning/gate entirely for declared experiments.
   */
  pseo: z
    .object({
      cardinalityLimit: z.number().int().min(1).optional(),
      highCardinalityExperiment: z.boolean().optional(),
    })
    .strict()
    .optional(),

  /**
   * RFC-0193: explicit Programmatic Surface adoption. `surface.blueprints` lists the Blueprint ids
   * (in packages/werkstatt-site/src/domain/ontology/blueprints/) this site compiles. When declared, only listed Blueprints
   * apply (and blueprint.validate requires their datasets). When omitted, the engine falls back to
   * implicit opt-in by datasets (a Blueprint applies if the app ships its dataset collection).
   */
  surface: z
    .object({
      blueprints: z.array(z.string().min(1)).optional(),
      /**
       * RFC-1259: per-module authored surface config — kept through parse so
       * RFC-0278 `autonomy.scopes[]` reaches consumers (previously stripped as
       * an undeclared key). Loose: modules may carry additional keys.
       */
      modules: z
        .record(
          z.string(),
          z.looseObject({
            masterLocale: z.string().min(1).optional(),
            publishedLocales: z.array(z.string().min(1)).optional(),
            autonomy: z
              .looseObject({
                scopes: z
                  .array(
                    z.looseObject({
                      fieldClass: z.string().min(1),
                      locale: z.string().min(1),
                      level: z.string().min(1).optional(),
                      ceiling: z.string().min(1).optional(),
                      sinceAt: isoDateString(z.string().min(1)).optional(),
                      evidenceRef: z.string().min(1).optional(),
                    }),
                  )
                  .optional(),
              })
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),

  /**
   * RFC-0211..0218: Content Knowledge Lifecycle policy. `freshness.soonWindowDays`
   * sets the expiring-soon horizon; `freshness.critical` maps subject-address globs
   * to a criticality so the maintenance-plan gate (RFC-0216) can promote selected
   * facts (e.g. price, legal) from advisory amber to blocking red.
   */
  knowledge: z
    .object({
      freshness: z
        .object({
          soonWindowDays: z.number().int().positive().optional().default(30),
          critical: z
            .array(
              z.object({
                match: z.string().min(1),
                criticality: z.enum(["advisory", "important", "blocking"]),
              }),
            )
            .optional()
            .default([]),
        })
        .optional(),
      derivation: z
        .object({
          critical: z
            .array(
              z.object({
                match: z.string().min(1),
                criticality: z.enum(["advisory", "important", "blocking"]),
              }),
            )
            .optional()
            .default([]),
        })
        .optional(),
      /**
       * RFC-0216: maintenance-plan policy. Controls how the planner schedules and
       * routes tasks: leadTimeDays (how far before validUntil a task is raised),
       * the default owner for tasks the claim does not name, and a glob→criticality
       * map that promotes specific subjects above their trigger's default.
       */
      plan: z
        .object({
          leadTimeDays: z.number().int().positive().optional().default(30),
          defaultOwner: z.string().min(1).optional(),
          criticalityMap: z
            .array(
              z.object({
                match: z.string().min(1),
                criticality: z.enum(["advisory", "important", "blocking"]),
              }),
            )
            .optional()
            .default([]),
        })
        .optional(),
    })
    .optional(),

  /**
   * RFC-0171: content-source adapter selection (Content Source Provider port).
   * Defaults to the filesystem adapter; CMS adapters are opt-in per app.
   */
  contentSource: z
    .object({
      adapter: z.enum(["fs", "cms-git", "cms-api"]).default("fs"),
      options: z.record(z.string(), z.string()).optional(),
    })
    .optional(),

  /**
   * RFC-0168: Integration Port configuration (outbound channels + optional CRM).
   * When absent, channels self-enable by secret presence and the integration
   * validators are a no-op pass.
   */
  integrations: systemIntegrationsSchema.optional(),

  /**
   * RFC-0182: Deployment and infrastructure residency configuration.
   * Declares Cloudflare Regional Services policy and allowed execution zones.
   */
  deployment: z
    .object({
      cloudflare: z
        .object({
          /**
           * Hostnames to validate for Regional Services.
           * Defaults to [identity.domain] when empty.
           */
          hostnames: z.array(z.string().min(1)).optional().default([]),
          /**
           * Regional Services policy — empty array means all zones acceptable.
           */
          regionalServices: z
            .object({
              allowedZones: z
                .array(z.enum(["eu", "us"]))
                .optional()
                .default([]),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),

  /**
   * RFC-0257: App-level output projection. Controls build-time artifact generation
   * that applies to the whole app, not individual pages.
   */
  output: z
    .object({
      /** Enable SSG PDF generation via Playwright during build.post. Default false. */
      printPdf: z.boolean().optional(),
    })
    .optional(),

  /**
   * RFC-0286: Agent Surface policy. Absent ⇒ enabled: true — the read tier
   * (knowledge files, discovery, OpenAPI; RFC-0287/0289) is free visibility like
   * llms.txt. Set `enabled: false` to disable the whole agent surface for a site.
   */
  agent: z
    .object({
      enabled: z.boolean().optional(),
      /** RFC-0287: domains to withhold from the knowledge tier even if content exists. */
      knowledgeDisabled: z.array(z.string().min(1)).optional(),
      /** RFC-0288: capability ids to withhold from the action tier even if otherwise active. */
      actionsDisabled: z.array(z.string().min(1)).optional(),
      /**
       * RFC-1187: worker-hosted agent authorization server — opt-in. When
       * `auth.enabled` is true AND a signing key is configured at generation
       * time, the site emits OAuth discovery metadata (RFC 8414 + RFC 9728),
       * registration/token/JWKS routes, and the auth.md key_proof flow.
       * Absent/false preserves the anonymous baseline.
       */
      auth: z
        .object({
          enabled: z.boolean().optional(),
        })
        .strict()
        .optional(),
    })
    .strict()
    .optional(),

  /**
   * RFC-0487: Business model declaration. Closed enum — currently only "b2b-only".
   * When declared, b2b.model.validate checks that no B2C-specific page IDs, route
   * slugs, navigation labels, or consumer-law prose references exist.
   * Future RFCs may add values (b2c, marketplace) as needed.
   */
  businessModel: z.enum(["b2b-only"]).optional(),

  /**
   * RFC-0487/RFC-0509: Retired page routes — declarative audit trail of removed page slugs.
   * The _redirects generator reads this and emits HTTP 410 Gone tombstones or 301 redirects.
   * When status is 301, `to` is required and specifies the redirect target URL path.
   * When status is 410, `to` is forbidden (tombstone has no redirect target).
   */
  retiredRoutes: z
    .array(
      z.union([
        z.object({
          slug: z.string().min(1),
          status: z.literal(410),
        }),
        z.object({
          slug: z.string().min(1),
          status: z.literal(301),
          to: z.string().min(1),
        }),
      ]),
    )
    .optional()
    .default([]),

  /**
   * UI-level rendering toggles. Currently controls the column order of
   * controlled-responsibility-block sections (split-list body). When
   * `responsibilityBlock.swapOrder` is true, the page handler swaps
   * primaryItems/secondaryItems and labels.primary/labels.secondary at
   * render time. Default false = render as authored in content.
   * RFC-1087: `codeHighlightTheme` selects the Shiki theme for build-time
   * syntax highlighting. Default "github-light" when absent.
   */
  ui: z
    .object({
      responsibilityBlock: z
        .object({
          swapOrder: z.boolean().optional().default(false),
        })
        .optional(),
      codeHighlightTheme: z.string().min(1).optional(),
    })
    .optional(),

  /**
   * Search engine verification config (RFC-0909).
   * Declares per-engine verification method and token.
   * When absent, search.verification.validate emits SEARCH-VERIFY-01.
   */
  verification: systemVerificationSchema.optional(),

  /**
   * RFC-1229: site shell contract — named shell profiles (required regions +
   * document-level script policy) and route→profile bindings enforced on
   * emitted markup by site.shell.contract.validate. Absent = report mode
   * with no route bindings (implicit "default" profile assumed).
   */
  shellContract: systemShellContractSchema.optional(),

  /**
   * RFC-0911: SEO validator configuration extension point.
   * Sites extend the built-in de/uk anchor-text stop-list via
   * `seo.anchorText.extraStopPhrases` (lang → phrases).
   */
  seo: z
    .object({
      anchorText: z
        .object({
          extraStopPhrases: z.record(z.string(), z.array(z.string())).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type SystemManifest = z.infer<typeof systemManifestSchema>;

/** A single page route pin entry from system.yaml pages[]. */
export type SystemPagePin = NonNullable<SystemManifest["pages"]>[number];
/** A single planet pin within a page-route entry. */
export type SystemPlanetPin = NonNullable<SystemManifest["pages"][number]["planets"]>[number];

/**
 * ADR-0062: Lenient schema for the `system` Astro content collection.
 *
 * `systemManifestSchema` is the strict validation schema used by `system.manifest.validate`.
 * The content collection schema needs to be more lenient:
 *   - `.partial()` — all top-level fields are optional (system.md content varies per site)
 *   - `.loose()` — unknown top-level keys pass through (e.g. `policy`, `seo`)
 *
 * This schema is used in `src/content/config.ts` via `defineCollection({ schema: systemCollectionSchema })`.
 * It provides compile-time typing for `getCollection("system")` consumers, eliminating `as any` casts.
 */
export const systemCollectionSchema = systemManifestSchema.partial().loose();

/** Inferred type for the `system` content collection data. */
export type SystemCollectionData = z.infer<typeof systemCollectionSchema>;
