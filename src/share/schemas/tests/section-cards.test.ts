import { describe, it, expect } from "vitest";
import { standardCardSchema } from "../section-cards.ts";

describe("standardCardSchema", () => {
  it("accepts a valid card", () => {
    const result = standardCardSchema.safeParse({
      title: "Test Card",
      description: "Card body text",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = standardCardSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
