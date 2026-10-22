/*
<MODULE_CONTRACT>
<purpose>RFC-1368: signature-matrix tests for sniffMediaType — every media type
the intake bundle permits is detected, and unknown/text-class payloads return
undefined so callers can apply their own policy.</purpose>
<non-goals>
  <item>Do not test INTAKE-34 policy here — declared-vs-sniffed verdicts live in intake-validate.test.ts; this file pins signature detection only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1368: created — full signature matrix + negatives; review r1 — generic-XML/lookalike prolog regressions.</item>
</CHANGE_SUMMARY>
*/

import { describe, expect, it } from "vitest";

import { sniffMediaType } from "../sniff-media-type.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const AVIF = new Uint8Array([
  0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
]);
const MP4 = new Uint8Array([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82]);
const WOFF = new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0x00, 0x01]);
const WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01]);
const SVG = new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg"/>`);
const SVG_XML_PROLOG = new TextEncoder().encode(`<?xml version="1.0"?><svg/>`);
const SVG_WS = new TextEncoder().encode(`  \n\t<svg/>`);
const SVG_BOM = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(`<svg/>`)]);
const SVG_COMMENT = new TextEncoder().encode(`<!-- generated --><svg/>`);
const SVG_DOCTYPE = new TextEncoder().encode(
  `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg/>`,
);
const SVG_DOCTYPE_SUBSET = new TextEncoder().encode(`<!DOCTYPE svg [ <!ENTITY x "y"> ]><svg/>`);
const SVG_FULL_PROLOG = new TextEncoder().encode(
  `<?xml version="1.0" encoding="UTF-8"?>\n<!-- c -->\n<svg/>`,
);
const GENERIC_XML = new TextEncoder().encode(`<?xml version="1.0"?><config a="1"/>`);
const XML_NO_PROLOG = new TextEncoder().encode(`<rss version="2.0"></rss>`);
const SVG_LOOKALIKE = new TextEncoder().encode(`<svgx not-svg="1"/>`);
const UNKNOWN_BIN = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
const TEXT = new TextEncoder().encode(`# A markdown asset\n`);

describe("sniffMediaType — signature coverage", () => {
  it.each([
    ["image/png", PNG],
    ["image/jpeg", JPEG],
    ["image/gif", GIF],
    ["image/webp", WEBP],
    ["application/pdf", PDF],
    ["image/avif", AVIF],
    ["video/mp4", MP4],
    ["video/webm", WEBM],
    ["font/woff", WOFF],
    ["font/woff2", WOFF2],
    ["image/svg+xml", SVG],
    ["image/svg+xml", SVG_XML_PROLOG],
    ["image/svg+xml", SVG_WS],
    ["image/svg+xml", SVG_BOM],
    ["image/svg+xml", SVG_COMMENT],
    ["image/svg+xml", SVG_DOCTYPE],
    ["image/svg+xml", SVG_DOCTYPE_SUBSET],
    ["image/svg+xml", SVG_FULL_PROLOG],
  ])("detects %s", (expected, bytes) => {
    expect(sniffMediaType(bytes)).toBe(expected);
  });
});

describe("sniffMediaType — negatives", () => {
  it("unknown binary returns undefined", () => {
    expect(sniffMediaType(UNKNOWN_BIN)).toBeUndefined();
  });

  it("plain text returns undefined (caller owns the text-class exemption)", () => {
    expect(sniffMediaType(TEXT)).toBeUndefined();
  });

  it("empty and truncated buffers return undefined", () => {
    expect(sniffMediaType(new Uint8Array(0))).toBeUndefined();
    expect(sniffMediaType(new Uint8Array([0x89, 0x50]))).toBeUndefined();
    expect(sniffMediaType(new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66]))).toBeUndefined();
  });

  it("an unrecognized ftyp brand returns undefined, not video/mp4", () => {
    const qt = new Uint8Array([
      0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20,
    ]);
    expect(sniffMediaType(qt)).toBeUndefined();
  });

  it("webp requires the WEBP fourcc, not RIFF alone", () => {
    const avi = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
    ]);
    expect(sniffMediaType(avi)).toBeUndefined();
  });

  it("generic XML with an <?xml prolog is NOT svg (review r1 false positive)", () => {
    expect(sniffMediaType(GENERIC_XML)).toBeUndefined();
    expect(sniffMediaType(XML_NO_PROLOG)).toBeUndefined();
  });

  it("a tag merely starting with 'svg' is NOT svg — the root boundary is checked", () => {
    expect(sniffMediaType(SVG_LOOKALIKE)).toBeUndefined();
  });
});
