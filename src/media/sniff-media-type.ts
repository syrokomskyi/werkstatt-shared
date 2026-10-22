/*
<MODULE_CONTRACT>
<purpose>RFC-1368: single magic-byte media-type table for every binary asset the
intake bundle permits. The declared `mediaType` is verified against payload
bytes at bundle birth (INTAKE-34); onboarding consumers (visual review, asset
quality) import this same table instead of carrying local copies that silently
default unknown signatures.</purpose>
<non-goals>
  <item>Do not decode or parse media — magic bytes are the cheap boundary check; full decode belongs to fulfilment.</item>
  <item>Do not classify text-class payloads — text/*, application/json, message/rfc822 carry no binary signature; the caller owns that exemption.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-1368: created — sniffMediaType covering the intake asset signature set (png/jpeg/gif/webp/svg/pdf/avif/mp4/webm/woff/woff2).</item>
  <item>RFC-1368: INTAKE-34 — declared asset mediaType verified against magic bytes at intake birth; shared sniffMediaType single-sources the signature table (werkstatt-shared/media), visual-review + asset-quality local copies removed</item>
</CHANGE_SUMMARY>
*/

const hasPrefix = (head: Uint8Array, bytes: readonly number[], offset = 0): boolean =>
  head.length >= offset + bytes.length && bytes.every((b, i) => head[offset + i] === b);

const ascii = (head: Uint8Array, offset: number, length: number): string =>
  head.length < offset + length
    ? ""
    : String.fromCharCode(...head.subarray(offset, offset + length));

const ASCII_WS = new Set([0x20, 0x09, 0x0a, 0x0d]);

/**
 * Media type from a payload's leading bytes, or `undefined` when no known
 * signature matches. `head` need only carry the signature window — 16 bytes
 * covers every entry; callers already holding the full buffer pass it whole.
 */
export function sniffMediaType(head: Uint8Array): string | undefined {
  // ISO-BMFF family: size(4) "ftyp" major-brand(4) — avif/heic cousins share
  // the box layout, so the major brand decides.
  if (ascii(head, 4, 4) === "ftyp") {
    const brand = ascii(head, 8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (/^(?:mp4|iso|avc|M4|dash|3gp)/.test(brand)) return "video/mp4";
    return undefined;
  }
  if (hasPrefix(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (hasPrefix(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(head, 0, 4) === "GIF8") return "image/gif";
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WEBP") return "image/webp";
  if (ascii(head, 0, 5) === "%PDF-") return "application/pdf";
  // EBML header — Matroska shares it; the intake set only permits WebM.
  if (hasPrefix(head, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (ascii(head, 0, 4) === "wOFF") return "font/woff";
  if (ascii(head, 0, 4) === "wOF2") return "font/woff2";

  // Markup-class: a UTF-8 BOM then ASCII whitespace may precede the tag.
  let i = hasPrefix(head, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (i < head.length && ASCII_WS.has(head[i])) i++;
  const tag = ascii(head, i, 5);
  if (tag.startsWith("<svg") || tag.startsWith("<?xml")) return "image/svg+xml";

  return undefined;
}
