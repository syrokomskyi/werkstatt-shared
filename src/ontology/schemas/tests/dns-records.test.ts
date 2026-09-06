import { describe, it, expect } from "vitest";
import { dnsRecordTypeSchema } from "../dns-records.ts";

describe("dnsRecordTypeSchema", () => {
  it("accepts valid DNS record types", () => {
    const result = dnsRecordTypeSchema.safeParse("A");
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(() => dnsRecordTypeSchema.parse("INVALID")).toThrow();
  });
});
