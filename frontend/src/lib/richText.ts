import type { RichToken } from "@/types";

/**
 * Tokeniza una bio en texto / @menciones / #hashtags / URLs.
 * Preserva saltos de línea (renderizar con `white-space: pre-wrap`).
 */
export function parseRichText(text: string): RichToken[] {
  if (!text) return [];
  const tokens: RichToken[] = [];
  // url | @mención | #hashtag  (unicode para hashtags con acentos)
  const re = /(https?:\/\/[^\s]+)|@([a-zA-Z0-9_]{2,30})|#([\p{L}\p{N}_]{1,50})/gu;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: text.slice(last, m.index) });
    }
    if (m[1]) {
      tokens.push({ kind: "url", value: m[1], href: m[1] });
    } else if (m[2]) {
      tokens.push({ kind: "mention", value: m[2] });
    } else if (m[3]) {
      tokens.push({ kind: "hashtag", value: m[3] });
    }
    last = re.lastIndex;
  }
  if (last < text.length) {
    tokens.push({ kind: "text", value: text.slice(last) });
  }
  return tokens;
}
