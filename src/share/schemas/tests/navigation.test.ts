import { describe, it, expect } from "vitest";
import {
  createNavigationGroupEnum,
  defaultNavigationGroups,
  navigationTargetSchema,
  navigationSchema,
} from "../navigation.ts";

describe("defaultNavigationGroups", () => {
  it("contains expected groups", () => {
    expect(defaultNavigationGroups).toEqual(["navigation", "legal", "contact"]);
  });
});

describe("createNavigationGroupEnum", () => {
  it("creates a Zod enum from group names", () => {
    const enumSchema = createNavigationGroupEnum(["main", "footer"]);
    expect(enumSchema.parse("main")).toBe("main");
    expect(enumSchema.parse("footer")).toBe("footer");
  });

  it("rejects values not in the enum", () => {
    const enumSchema = createNavigationGroupEnum(["main"]);
    expect(() => enumSchema.parse("footer")).toThrow();
  });
});

describe("navigationTargetSchema", () => {
  it("validates a target with valid group", () => {
    const groupEnum = createNavigationGroupEnum(["navigation", "legal"]);
    const schema = navigationTargetSchema(groupEnum);
    const result = schema.safeParse({
      id: "home",
      label: "Home",
      semanticTarget: { kind: "internal", pageId: "home" },
      group: "navigation",
    });
    expect(result.success).toBe(true);
  });
});

describe("navigationSchema", () => {
  it("validates a navigation object with targets", () => {
    const groupEnum = createNavigationGroupEnum(["navigation"]);
    const schema = navigationSchema(groupEnum);
    const result = schema.safeParse({
      targets: [
        {
          id: "home",
          label: "Home",
          semanticTarget: { kind: "internal", pageId: "home" },
          group: "navigation",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
