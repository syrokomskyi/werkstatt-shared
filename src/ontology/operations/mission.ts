/*
<MODULE_CONTRACT>
<purpose>RFC-0355: Zod schemas for Mission lifecycle and Bordbuch (hash-chain logbook).</purpose>
<non-goals>
  <item>Does not define materialization — that is RFC-0356.</item>
  <item>Does not define release discipline — that is RFC-0357.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1295</item>
  <item>RFC-1297: bordbuchEntryKindSchema gains deployment-rolled-back + live-state-reconciled.</item>
  <item>RFC-1336: bordbuchEntryKindSchema gains authority-delegation + authority-delegation-revoked.</item>
  <item>RFC-1485: sweep compass headers — shared-tail</item>
  <item>RFC-1492: rename production deploy channel main to prod with single DEPLOY_CHANNELS definition and CHANNEL-01 guard</item>
  <history>RFC-0355, RFC-0473, RFC-0479, RFC-0480, RFC-0517, RFC-0706, RFC-0715, RFC-1097, RFC-1210, RFC-1263</history>
</CHANGE_SUMMARY>
*/

import { z } from "zod";

const missionIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*-m\d{6}$/;
const systemIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const eventIdRegex = /^event-\d{6}$/;

export const missionStateSchema = z.enum(["open", "closed", "aborted"]);

export const missionManifestSchema = z.object({
  schemaVersion: z.string().min(1),
  missionId: z.string().regex(missionIdRegex),
  systemId: z.string().regex(systemIdRegex),
  state: missionStateSchema,
  brief: z.string().min(1),
  openedAt: z.string().datetime(),
  openedBy: z.string().min(1),
  closedAt: z.string().datetime().nullable(),
  closedBy: z.string().nullable(),
  pinAtOpen: z.string().min(1),
  materializedAt: z.string().datetime().nullable(),
  reconciledAt: z.string().datetime().nullable(),
  migratedAt: z.string().datetime().nullable(),
  releaseId: z.string().nullable(),
  rfcId: z.string().nullable().default(null),
  operationId: z.string().min(1),
  // RFC-1263: declared mission lane — "content" marks a mission opened for the
  // content fast lane (`mission.open --lane content` / `mission.content-edit`).
  lane: z.enum(["content", "full"]).optional(),
  // RFC-1263: composite gate record written by mission.content-edit once the
  // fast-lane gate set has run. `green: true` satisfies the reconcile/close
  // coverage precondition in place of a green mission.validate report — the
  // fast lane never writes validation-report.json itself.
  fastLane: z
    .object({
      green: z.boolean(),
      gates: z.array(
        z.object({
          gate: z.string().min(1),
          status: z.enum(["pass", "fail", "advisory"]),
          violations: z.number().optional(),
        }),
      ),
      recordedAt: z.string().datetime(),
    })
    .optional(),
});

// When renaming or removing a value from this enum, add the old value to
// DEPRECATED_KIND_MIGRATIONS in packages/os/site-kernel-handoff/src/bordbuch/bordbuch-io.ts
// so that existing bordbuch entries on disk are normalized during readBordbuch.
export const bordbuchEntryKindSchema = z.enum([
  "mission-open",
  "mission-close",
  "mission-abort",
  "mission-open-rolled-back",
  "mission-reconcile",
  "release-ready",
  "release-rolled-back",
  "pin-update",
  "deployment",
  // RFC-1297: recorded-vs-live channel drift outcomes
  "deployment-rolled-back",
  "live-state-reconciled",
  "notausgang-export",
  "operator-note",
  "erratum",
  "mirror-sync",
  "pseo",
  "indexnow.submit",
  "mission-migrate",
  "preflight-skipped",
  // RFC-0706 / ADR-0028: Nachweisregister trust lifecycle
  "nachweis-record",
  "nachweis-consent",
  // RFC-0715: N3 cryptographic verification (operator signature + RFC 3161 timestamp)
  "nachweis-signed",
  "nachweis-timestamped",
  // RFC-0888: Sichtpass lifecycle audit trail
  "sichtpass",
  // RFC-0968: Sternsystem handover protocol
  "handover",
  // RFC-1031: Evolution controller candidate lifecycle
  "candidate",
  // RFC-1037: External-effect compensation verification
  "effect",
  // RFC-1035: Isolation controller sandbox lifecycle events
  "isolation",
  // RFC-1210: closed-loop remediation — a bounded mission opened by a signal
  "remediation-mission",
  // RFC-1295: human editorial sign-off recorded at promote-prod
  "editorial-signoff",
  // RFC-1336: operator-authority delegation lifecycle (grant / revoke)
  "authority-delegation",
  "authority-delegation-revoked",
]);

export const bordbuchEntryStatusSchema = z.enum(["done", "failed", "waiting", "escalated"]);

export const bordbuchEntrySchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string().regex(eventIdRegex),
  systemId: z.string().min(1),
  occurredAt: z.string().datetime(),
  kind: bordbuchEntryKindSchema,
  status: bordbuchEntryStatusSchema,
  missionId: z.string().nullable(),
  releaseId: z.string().nullable(),
  actor: z.string().min(1),
  summary: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  previousHash: z.string().nullable(),
  hash: z.string().min(1),
  erratumOf: z.string().optional(),
});

export type MissionState = z.infer<typeof missionStateSchema>;
export type MissionManifest = z.infer<typeof missionManifestSchema>;
export type BordbuchEntryKind = z.infer<typeof bordbuchEntryKindSchema>;
export type BordbuchEntryStatus = z.infer<typeof bordbuchEntryStatusSchema>;
export type BordbuchEntry = z.infer<typeof bordbuchEntrySchema>;
