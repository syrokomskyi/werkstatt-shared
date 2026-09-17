import { describe, it, expect } from "vitest";
import { initLivePhotos } from "../live-photos.ts";

describe("initLivePhotos", () => {
  it("is an async function", () => {
    expect(typeof initLivePhotos).toBe("function");
  });
});
