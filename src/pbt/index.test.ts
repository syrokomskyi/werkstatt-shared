import { describe, it, expect } from "vitest";
import {
  fcAssert,
  letterString,
  composeWord,
  safeText,
  DEFAULT_NUM_RUNS,
  DEFAULT_MAX_SKIPS_PER_RUN,
} from "./index.ts";
import fc from "fast-check";

describe("PBT helpers", () => {
  describe("constants", () => {
    it("DEFAULT_NUM_RUNS is 50", () => {
      expect(DEFAULT_NUM_RUNS).toBe(50);
    });

    it("DEFAULT_MAX_SKIPS_PER_RUN is 100", () => {
      expect(DEFAULT_MAX_SKIPS_PER_RUN).toBe(100);
    });
  });

  describe("letterString", () => {
    it("generates only letters (\\p{L}+)", () => {
      fcAssert(
        fc.property(letterString(1, 10), (word) => {
          return /^\p{L}+$/u.test(word);
        }),
      );
    });

    it("respects minLength", () => {
      fcAssert(
        fc.property(letterString(3, 5), (word) => {
          return word.length >= 3 && word.length <= 5;
        }),
      );
    });

    it("never generates empty string when minLength=1", () => {
      fcAssert(
        fc.property(letterString(1, 5), (word) => {
          return word.length > 0;
        }),
      );
    });
  });

  describe("composeWord", () => {
    it("generates letter + separator + letter", () => {
      const sep = "\u2019";
      fcAssert(
        fc.property(composeWord(sep), (word) => {
          return /\p{L}+\u2019\p{L}+/u.test(word);
        }),
      );
    });

    it("contains exactly one separator", () => {
      const sep = "-";
      fcAssert(
        fc.property(composeWord(sep), (word) => {
          const count = (word.match(/-/g) ?? []).length;
          return count === 1;
        }),
      );
    });
  });

  describe("safeText", () => {
    it("respects maxLength", () => {
      fcAssert(
        fc.property(safeText(50), (text) => {
          return text.length <= 50;
        }),
      );
    });
  });

  describe("fcAssert", () => {
    it("accepts custom numRuns", () => {
      fcAssert(
        fc.property(letterString(1, 3), (word) => word.length > 0),
        { numRuns: 10 },
      );
    });

    it("accepts custom maxSkipsPerRun", () => {
      fcAssert(
        fc.property(letterString(1, 3), (word) => word.length > 0),
        { maxSkipsPerRun: 50 },
      );
    });
  });
});
