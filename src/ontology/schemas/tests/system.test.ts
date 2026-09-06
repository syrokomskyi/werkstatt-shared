import { describe, it, expect } from "vitest";
import * as systemModule from "../system.ts";

describe("system.ts barrel re-exports", () => {
  it("re-exports systemManifestSchema", () => {
    expect(systemModule.systemManifestSchema).toBeDefined();
  });

  it("re-exports systemIntegrationsSchema", () => {
    expect(systemModule.systemIntegrationsSchema).toBeDefined();
  });

  it("re-exports systemPassportSchema", () => {
    expect(systemModule.systemPassportSchema).toBeDefined();
  });

  it("re-exports systemReleaseSchema", () => {
    expect(systemModule.systemReleaseSchema).toBeDefined();
  });
});
