import { describe, it, expect } from "vitest";
import { standardListItemSchema } from "../standard-list-item.ts";

describe("standardListItemSchema", () => {
  it("accepts a valid list item", () => {
    const result = standardListItemSchema.safeParse({
      text: "Test item",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = standardListItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
