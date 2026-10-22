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
  <item>RFC-1368 review r2: %PDF- detection widened to the spec's first-1024-bytes window — guarded so markup-led payloads and printable-prose mentions never sniff as pdf (a binary prefix byte is required when the header is not at the canonical post-BOM/whitespace offset).</item>
  <item>RFC-1368: created — sniffMediaType single-sources the magic-byte signature table (png/jpeg/gif/webp/svg/pdf/avif/mp4/webm/woff/woff2) for INTAKE-34 plus the visual-review/asset-quality consumers; review r1 — prolog handling constrained so generic XML no longer sniffs as image/svg+xml.</item>
</CHANGE_SUMMARY>
*/

const hasPrefix = (head: Uint8Array, bytes: readonly number[], offset = 0): boolean =>
  head.length >= offset + bytes.length && bytes.every((b, i) => head[offset + i] === b);

const ascii = (head: Uint8Array, offset: number, length: number): string =>
  head.length < offset + length
    ? ""
    : String.fromCharCode(...head.subarray(offset, offset + length));

const ASCII_WS = new Set([0x20, 0x09, 0x0a, 0x0d]);

/** Offset of `seq` inside `head` at or after `from`, or -1. */
const indexOfSequence = (head: Uint8Array, seq: string, from: number): number => {
  const bytes = [...seq].map((c) => c.charCodeAt(0));
  outer: for (let i = from; i + bytes.length <= head.length; i++) {
    for (let j = 0; j < bytes.length; j++) if (head[i + j] !== bytes[j]) continue outer;
    return i;
  }
  return -1;
};

/**
 * Media type from a payload's leading bytes, or `undefined` when no known
 * signature matches. `head` need only carry the signature window — 64 bytes
 * covers every entry including comment/doctype-led markup; callers already
 * holding the full buffer pass it whole.
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
  // EBML header — Matroska shares it; the intake set only permits WebM.
  if (hasPrefix(head, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (ascii(head, 0, 4) === "wOFF") return "font/woff";
  if (ascii(head, 0, 4) === "wOF2") return "font/woff2";

  // Markup-class + PDF: a UTF-8 BOM then ASCII whitespace may precede the
  // signature. The PDF spec tolerates the %PDF- header anywhere in the first
  // 1024 bytes (linearized/spool outputs prepend binary junk). Two guards
  // keep that honest: markup-led payloads that merely mention %PDF- are not
  // PDFs, and a purely printable-text prefix means the token is prose, not a
  // header — the junk prefix must carry a non-text byte.
  let i = hasPrefix(head, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (i < head.length && ASCII_WS.has(head[i])) i++;
  if (head[i] !== 0x3c) {
    const pdfIdx = indexOfSequence(head, "%PDF-", 0);
    if (pdfIdx >= 0 && pdfIdx < 1024) {
      let binaryPrefix = pdfIdx === i;
      for (let j = i; !binaryPrefix && j < pdfIdx; j++) {
        const b = head[j];
        if (b === 0 || b >= 0x7f || (b < 0x20 && !ASCII_WS.has(b))) binaryPrefix = true;
      }
      if (binaryPrefix) return "application/pdf";
    }
  }

  // Legal SVG prologs may carry the <?xml PI, comments, DOCTYPE, or other
  // declarations before the root tag — skip a bounded run of prolog segments,
  // then demand the <svg root. Generic XML never classifies as SVG.
  for (let guard = 0; guard < 8 && i < head.length; guard++) {
    if (ascii(head, i, 2) === "<?") {
      const end = indexOfSequence(head, "?>", i + 2);
      if (end < 0) return undefined;
      i = end + 2;
    } else if (ascii(head, i, 4) === "<!--") {
      const end = indexOfSequence(head, "-->", i + 4);
      if (end < 0) return undefined;
      i = end + 3;
    } else if (ascii(head, i, 2) === "<!") {
      // Internal-subset DOCTYPEs carry [ … ] — honor the bracket before `>`.
      const bracket = head.indexOf(0x5b, i + 2);
      const gt = head.indexOf(0x3e, i + 2);
      if (bracket >= 0 && (gt < 0 || bracket < gt)) {
        const end = indexOfSequence(head, "]>", bracket + 1);
        if (end < 0) return undefined;
        i = end + 2;
      } else {
        if (gt < 0) return undefined;
        i = gt + 1;
      }
    } else {
      break;
    }
    while (i < head.length && ASCII_WS.has(head[i])) i++;
  }
  if (ascii(head, i, 4) === "<svg") {
    const next = head[i + 4];
    if (next === undefined || ASCII_WS.has(next) || next === 0x3e || next === 0x2f)
      return "image/svg+xml";
  }

  return undefined;
}
