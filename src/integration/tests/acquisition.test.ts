/*
<MODULE_CONTRACT>
<purpose>Unit tests for the RFC-1241 first-touch UTM acquisition module:
capture semantics (first-touch, sentinels, charset), storage-injected reads,
and the shared structural validator.</purpose>
<non-goals>
  <item>Do not test browser APIs — storage is faked; no jsdom dependency.</item>
</non-goals>
</MODULE_CONTRACT>
*/

import { test, expect } from "vitest";
import {
  captureAcquisition,
  readAcquisition,
  isValidAcquisitionContext,
  ACQUISITION_STORAGE_KEY,
  type AcquisitionStorage,
} from "../acquisition.ts";

function fakeStorage(initial?: Record<string, string>): AcquisitionStorage & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...(initial ?? {}) };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const FULL_SEARCH =
  "?utm_source=meta&utm_medium=paid_social&utm_campaign=sit001-bw-v1" +
  "&utm_term=var_a1&utm_content=cre_b3d8e2f1&utm_id=exp_7f2a91c4";

test("capture: all six params stored verbatim", () => {
  const s = fakeStorage();
  captureAcquisition(FULL_SEARCH, s);
  expect(readAcquisition(s)).toEqual({
    schema: "acquisition-context/v1",
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "sit001-bw-v1",
    utm_term: "var_a1",
    utm_content: "cre_b3d8e2f1",
    utm_id: "exp_7f2a91c4",
  });
});

test("capture: absent secondary keys become the '-' sentinel", () => {
  const s = fakeStorage();
  captureAcquisition("?utm_source=meta&utm_medium=cpc", s);
  expect(readAcquisition(s)).toEqual({
    schema: "acquisition-context/v1",
    utm_source: "meta",
    utm_medium: "cpc",
    utm_campaign: "-",
    utm_term: "-",
    utm_content: "-",
    utm_id: "-",
  });
});

test("capture: no utm_source stores nothing", () => {
  const s = fakeStorage();
  captureAcquisition("?utm_medium=cpc&utm_campaign=x", s);
  expect(s.data[ACQUISITION_STORAGE_KEY]).toBeUndefined();
});

test("capture: charset-invalid utm_source stores nothing", () => {
  const s = fakeStorage();
  captureAcquisition("?utm_source=meta%20ads+spam", s);
  expect(s.data[ACQUISITION_STORAGE_KEY]).toBeUndefined();
  captureAcquisition("?utm_source=facebook.com/x", s); // '/' not in charset
  expect(s.data[ACQUISITION_STORAGE_KEY]).toBeUndefined();
});

test("capture: invalid secondary value becomes '-' while block still stores", () => {
  const s = fakeStorage();
  captureAcquisition("?utm_source=meta&utm_campaign=hello%20world", s);
  const block = readAcquisition(s);
  expect(block?.utm_source).toBe("meta");
  expect(block?.utm_campaign).toBe("-");
});

test("capture: first-touch — earlier capture is never overwritten", () => {
  const s = fakeStorage();
  captureAcquisition("?utm_source=first&utm_medium=a", s);
  captureAcquisition("?utm_source=second&utm_medium=b", s);
  expect(readAcquisition(s)?.utm_source).toBe("first");
  captureAcquisition("?utm_medium=only", s); // would be a no-op anyway
  expect(readAcquisition(s)?.utm_source).toBe("first");
});

test("capture: accepts URLSearchParams", () => {
  const s = fakeStorage();
  captureAcquisition(new URLSearchParams("utm_source=meta"), s);
  expect(readAcquisition(s)?.utm_source).toBe("meta");
});

test("capture: storage exceptions are swallowed", () => {
  const throwing: AcquisitionStorage = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
  expect(() => captureAcquisition("?utm_source=meta", throwing)).not.toThrow();
});

test("read: missing key returns undefined", () => {
  expect(readAcquisition(fakeStorage())).toBeUndefined();
});

test("read: corrupt JSON returns undefined", () => {
  const s = fakeStorage({ [ACQUISITION_STORAGE_KEY]: "{not-json" });
  expect(readAcquisition(s)).toBeUndefined();
});

test("read: structurally invalid stored block returns undefined", () => {
  const s = fakeStorage({
    [ACQUISITION_STORAGE_KEY]: JSON.stringify({ schema: "acquisition-context/v1" }),
  });
  expect(readAcquisition(s)).toBeUndefined();
});

test("validator: rejects wrong schema, missing keys, extra keys, bad charset", () => {
  const valid = {
    schema: "acquisition-context/v1",
    utm_source: "a",
    utm_medium: "-",
    utm_campaign: "c",
    utm_term: "-",
    utm_content: "-",
    utm_id: "x",
  };
  expect(isValidAcquisitionContext(valid)).toBe(true);
  expect(isValidAcquisitionContext({ ...valid, schema: "other/v1" })).toBe(false);
  expect(isValidAcquisitionContext({ ...valid, extra: "x" })).toBe(false);
  const { utm_id: _dropped, ...missing } = valid;
  expect(isValidAcquisitionContext(missing)).toBe(false);
  expect(isValidAcquisitionContext({ ...valid, utm_source: "has space" })).toBe(false);
  expect(isValidAcquisitionContext({ ...valid, utm_medium: 42 })).toBe(false);
  expect(isValidAcquisitionContext(null)).toBe(false);
  expect(isValidAcquisitionContext("string")).toBe(false);
});
