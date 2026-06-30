/**
 * MLS PIN IDX files are encoded in Windows-1252 (CP1252), NOT UTF-8.
 *
 * Reading them as UTF-8 turns smart punctuation into the replacement character:
 * an em-dash (byte 0x97) and a curly apostrophe (0x92) both become "�" in
 * listing descriptions. Node's TextDecoder("windows-1252") actually behaves as
 * ISO-8859-1 (it leaves 0x80–0x9F as C1 control chars), so it does NOT recover
 * the smart-punctuation range — we need the explicit CP1252 high-range map.
 *
 * CP1252 == ISO-8859-1 except for 0x80–0x9F, which map to the code points below.
 */
const CP1252_HIGH: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
}

/** Decode a Windows-1252 (CP1252) buffer to a JS string. */
export function decodeCp1252(buf: Buffer | Uint8Array): string {
  let out = ""
  for (const b of buf) {
    out += String.fromCodePoint(b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b] ?? b : b)
  }
  return out
}

/**
 * Heuristic: a string that already contains the UTF-8 replacement char "�" was
 * mis-decoded upstream. Re-encoding it as latin1 and re-decoding as CP1252 can't
 * recover lost bytes, so for already-stored bad data the only true fix is a
 * re-import. This helper at least strips the visual garbage for display.
 */
export function stripReplacementChars(s: string): string {
  return s.replace(/�/g, "")
}
