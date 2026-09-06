import { describe, it, expect } from "vitest";
import { statItemSchema } from "../section-stats.ts";

describe("statItemSchema", () => {
  it("accepts a valid stat item", () => {
    const result = statItemSchema.safeParse({
      label: "Users",
      value: "10K",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = statItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
