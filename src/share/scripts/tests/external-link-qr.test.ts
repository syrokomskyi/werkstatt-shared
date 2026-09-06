import { describe, it, expect } from "vitest";
import { initExternalLinkQr } from "../external-link-qr.ts";

describe("initExternalLinkQr", () => {
  it("is a function", () => {
    expect(typeof initExternalLinkQr).toBe("function");
  });
});
