/*
<MODULE_CONTRACT>
<purpose>
RFC-0289: pure, dependency-free formatter that projects a site's Agent Surface
Manifest (+ the capability schemas for its active actions) into a static
OpenAPI 3.1 document. No transformation of capability schemas — they are
copied verbatim (AGO-04 enforces this).
</purpose>
<non-goals>
  <item>Do not read files or resolve capabilities — the kernel command does that
        and passes the manifest + capability schemas here.</item>
  <item>Do not adopt an OpenAPI library/types package — this is a small, closed
        structural subset (AS-5: protocols are disposable).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0289: initial OpenAPI projection.</item>
  <item>RFC-0954: add /api/agent/search path with dynamic lang enum from manifest.languages.supported.</item>
  <item>RFC-1112: Idempotency-Key header param + application/problem+json error responses on action paths.</item>
  <item>RFC-1115: agentGuidance renders into operation descriptions — model-oriented guidance for when/when-not/retry.</item>
  <item>RFC-1169: CapabilitySchemaInput gains sideEffect + widened output type; sideEffect "none" actions omit the declared 422 (violations answer 200 ready:false).</item>
</CHANGE_SUMMARY>
*/

import type { AgentSurfaceManifest } from "./manifest.ts";
import type {
  CapabilityInputOutputSchema,
  CapabilityOutputSchema,
} from "@warpgogol/werkstatt-shared/ontology";
import { renderAgentGuidanceDescription, type CapabilityAgentGuidance } from "./guidance.ts";

export interface OpenApiSchemaObject {
  type: string;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, unknown>;
  description?: string;
}

export interface OpenApiOperation {
  operationId: string;
  summary?: string;
  description?: string;
  /** RFC-1171: OpenAPI 3.1 deprecation flag — set on alias operations. */
  deprecated?: boolean;
  /** RFC-1212: machine-readable pricing — the agent.json `pricing` projection. */
  "x-gogol-pricing"?: unknown;
  tags: string[];
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema: Record<string, unknown>;
    description?: string;
  }>;
  requestBody?: {
    required: true;
    content: { "application/json": { schema: OpenApiSchemaObject } };
  };
  responses: Record<
    string,
    {
      description: string;
      content?: Partial<
        Record<"application/json" | "application/problem+json", { schema: unknown }>
      >;
    }
  >;
}

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: { title: string; version: string; "x-gogol-content-hash": string };
  servers: Array<{ url: string }>;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: Record<string, unknown> };
  externalDocs?: { url: string; description: string };
  "x-gogol-mcp"?: { url: string; protocolVersion: string };
  "x-gogol-proof"?: unknown;
}

/** One active capability's schemas — the exact shapes referenced by its AgentActionRef. */
export interface CapabilitySchemaInput {
  id: string;
  input: CapabilityInputOutputSchema;
  output: CapabilityOutputSchema;
  /** RFC-1169: preview capabilities ("none") drop the 422 — violations answer 200. */
  sideEffect?: "write" | "none";
  /** RFC-1115: localized base description for operation docs. */
  description?: Record<string, string>;
  /** RFC-1115: model-oriented guidance rendered into the operation description. */
  agentGuidance?: CapabilityAgentGuidance;
}

/** RFC-1112: shared RFC 9457 problem-details schema referenced by every action error response. */
function problemDetailsSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["type", "title", "status", "code", "retryable"],
    properties: {
      type: { type: "string" },
      title: { type: "string" },
      status: { type: "integer" },
      detail: { type: "string" },
      code: {
        type: "string",
        enum: [
          "invalid-json",
          "schema-violation",
          "unknown-capability",
          "payload-too-large",
          "rate-limited",
          "dispatch-failed",
          "idempotency-key-reuse",
        ],
      },
      retryable: { type: "boolean" },
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: { path: { type: "string" }, message: { type: "string" } },
        },
      },
      schemaRef: { type: "string" },
      retryAfterSeconds: { type: "integer" },
    },
  };
}

/**
 * RFC-1112: the standard error responses every action path declares.
 * RFC-1169: `sideEffect: "none"` actions omit the 422 — schema violations on
 * the preview path answer 200 with the readiness envelope, so declaring the
 * response would lie to agents.
 */
function actionErrorResponses(sideEffect?: "write" | "none"): OpenApiOperation["responses"] {
  const problem = {
    "application/problem+json": {
      schema: { $ref: "#/components/schemas/problem-details" },
    },
  };
  const responses: OpenApiOperation["responses"] = {
    "400": { description: "Request body is not valid JSON", content: problem },
    "409": {
      description: "Idempotency-Key was used with a different payload",
      content: problem,
    },
    "413": { description: "Payload exceeds the capability limit", content: problem },
    "429": { description: "Rate limit exceeded", content: problem },
    "502": { description: "Delivery substrate rejected the event", content: problem },
  };
  if (sideEffect !== "none") {
    responses["422"] = {
      description: "Input failed schema validation",
      content: problem,
    };
  }
  return responses;
}

/** Generic envelope schema — every knowledge domain shares this wrapper shape (RFC-0287); only `data`'s inner shape varies by domain and is intentionally left untyped here. */
function knowledgeEnvelopeSchema(): OpenApiSchemaObject {
  return {
    type: "object",
    required: ["schema", "site", "baseUrl", "languages", "contentHash", "data"],
    properties: {
      schema: { type: "string" },
      site: { type: "string" },
      baseUrl: { type: "string" },
      languages: { type: "object" },
      contentHash: { type: "string" },
      freshness: { type: "object" },
      data: { type: "object", description: "Per-language payload; shape varies by domain." },
    },
  };
}

/**
 * Pure: project the manifest (+ active capabilities' schemas) into an OpenAPI
 * 3.1 document. Exhaustive per the RFC-0289 projection table — adds nothing beyond it.
 */
export function formatAgentOpenApi(
  manifest: AgentSurfaceManifest,
  capabilitySchemas: CapabilitySchemaInput[],
): OpenApiDocument {
  const schemasById = new Map(capabilitySchemas.map((c) => [c.id, c]));
  const paths: OpenApiDocument["paths"] = {};
  const componentSchemas: Record<string, unknown> = {};

  for (const ref of manifest.knowledge) {
    componentSchemas[`knowledge-${ref.domain}`] = knowledgeEnvelopeSchema();
    paths[ref.url] = {
      get: {
        operationId: `knowledge.${ref.domain}.get`,
        tags: ["knowledge"],
        responses: {
          "200": {
            description: `${ref.domain} knowledge envelope`,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/knowledge-${ref.domain}` },
              },
            },
          },
        },
      },
    };
  }

  componentSchemas["problem-details"] = problemDetailsSchema();

  for (const ref of manifest.actions) {
    const schemas = schemasById.get(ref.id);
    if (!schemas) continue; // defensive — AGO-04-checked at validate time
    componentSchemas[`${ref.id}-input`] = schemas.input;
    componentSchemas[`${ref.id}-output`] = schemas.output;
    // RFC-1115: agentGuidance composes a model-oriented operation description;
    // absent guidance falls back to the base capability description.
    const baseDescription =
      schemas.description?.[manifest.languages.default] ??
      ref.title[manifest.languages.default] ??
      ref.id;
    paths[ref.url] = {
      post: {
        operationId: `action.${ref.id}`,
        summary: ref.title[manifest.languages.default] ?? ref.id,
        description: renderAgentGuidanceDescription(baseDescription, schemas.agentGuidance),
        tags: ["actions"],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string", maxLength: 255 },
            description:
              "Optional dedup key. Repeating a request with the same key and body returns the original receipt; the same key with a different body is rejected with 409.",
          },
        ],
        // RFC-1212: machine-readable pricing on metered capabilities — the
        // same projection agent.json carries, exposed as an OpenAPI extension.
        ...(ref.pricing ? { "x-gogol-pricing": ref.pricing } : {}),
        requestBody: {
          required: true,
          content: { "application/json": { schema: schemas.input } },
        },
        responses: {
          "200": {
            description: `${ref.id} accepted`,
            content: { "application/json": { schema: schemas.output } },
          },
          ...actionErrorResponses(schemas.sideEffect),
        },
      },
    };
  }

  // RFC-1171: deprecated alias paths are projected as deprecated operations —
  // every agent reading the document sees the successor pointer on the alias.
  for (const dep of manifest.deprecations ?? []) {
    for (const ref of manifest.actions) {
      const successorUrl = dep.successor.replaceAll("{id}", ref.id);
      if (successorUrl !== ref.url) continue;
      const canonical = paths[ref.url]?.post;
      if (!canonical) continue;
      const aliasPath = dep.path.replaceAll("{id}", ref.id);
      paths[aliasPath] = {
        post: {
          ...canonical,
          operationId: `action.${ref.id}.deprecated`,
          deprecated: true,
          description: `Deprecated since ${dep.deprecateAt} — use ${successorUrl} instead (sunset ${dep.sunsetAt}). ${dep.reason}`,
        },
      };
    }
  }

  if (manifest.interfaces.search) {
    const searchSchema: OpenApiSchemaObject = {
      type: "object",
      required: ["query", "results", "tookMs"],
      properties: {
        query: { type: "string" },
        results: {
          type: "array",
          items: {
            type: "object",
            required: ["title", "canonicalUrl", "updatedAt", "lang", "type", "score", "text"],
            properties: {
              title: { type: ["string", "null"] },
              canonicalUrl: { type: "string" },
              updatedAt: { type: ["string", "null"] },
              lang: { type: "string" },
              type: { type: "string", enum: ["page", "knowledge", "faq", "prose"] },
              score: { type: "number" },
              text: { type: "string" },
            },
          },
        },
        tookMs: { type: "number" },
      },
    };
    componentSchemas["search-response"] = searchSchema;
    const langEnum = manifest.languages.supported;
    paths[manifest.interfaces.search.url] = {
      get: {
        operationId: "search.query",
        summary: "Semantic search over site content",
        tags: ["search"],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/search-response" } },
            },
          },
          "400": { description: "Invalid query" },
          "503": { description: "Search index not available" },
        },
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string", maxLength: 1000 },
            description: "Natural language search query",
          },
          {
            name: "lang",
            in: "query",
            required: false,
            schema: { type: "string", enum: langEnum },
            description: "Filter by language",
          },
          {
            name: "type",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["page", "knowledge", "faq", "prose"] },
            description: "Filter by content type",
          },
          {
            name: "topK",
            in: "query",
            required: false,
            schema: { type: "integer", default: 5, maximum: 20 },
            description: "Number of results to return",
          },
        ],
      },
    };
  }

  const doc: OpenApiDocument = {
    openapi: "3.1.0",
    info: {
      title: `${manifest.site} agent surface`,
      version: manifest.surfaceVersion,
      "x-gogol-content-hash": manifest.contentHash,
    },
    servers: [{ url: manifest.baseUrl }],
    paths,
    components: { schemas: componentSchemas },
    externalDocs: {
      url: `${manifest.baseUrl}${manifest.interfaces.llms}`,
      description: "LLM-oriented text surface",
    },
  };
  if (manifest.interfaces.mcp) doc["x-gogol-mcp"] = manifest.interfaces.mcp;
  if (manifest.proof) doc["x-gogol-proof"] = manifest.proof;
  return doc;
}
