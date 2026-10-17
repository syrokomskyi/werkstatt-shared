import { test, expect } from "vitest";
import { createDevPropsValidator } from "../dev-props-validator.ts";

/*
<MODULE_CONTRACT>
<purpose>
Unit tests for create dev props validator covering its documented public contract and regression-sensitive edge cases.
</purpose>
<non-goals>
  <item>Not a contract source of truth — the module under test owns the authoritative behavior; fixtures are minimal scaffolding only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1311: Compass header sweep — declares the create suite's contract for test-file scaffold coverage.</item>
</CHANGE_SUMMARY>
*/

test("createDevPropsValidator: passes valid Europa (hero-section) props", async () => {
  const validate = createDevPropsValidator();
  await validate("Europa", { header: { heading: "Hello" } }, "hero-block"); // cosmic-literals-ignore: fixture cosmicName exercising the real hero-section manifest
});

test("createDevPropsValidator: throws PAGE-PROPS-01 on an undeclared prop key", async () => {
  const validate = createDevPropsValidator();
  try {
    await validate(
      "Europa", // cosmic-literals-ignore: fixture cosmicName exercising the real hero-section manifest
      { header: { heading: "Hello" }, totallyUnknownField: true },
      "hero-block",
    ); // cosmic-literals-ignore: fixture cosmicName exercising the real hero-section manifest
    expect.fail("should have thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/PAGE-PROPS-01/);
    expect((error as Error).message).toMatch(/hero-block/);
  }
});

test("createDevPropsValidator: an unknown planetName resolves no schema and does not throw", async () => {
  const validate = createDevPropsValidator();
  await validate("NotARealPlanet", { anything: true }, null);
});
