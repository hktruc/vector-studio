/**
 * Đo và xếp chữ mà không cần trình duyệt (chạy được trong Node).
 * Bề rộng chữ là ước lượng theo font Arial: đủ chính xác để chữ "vừa khung", không cần đo pixel.
 */

const NARROW = new Set("il.,:;|!'`ıìíỉĩịj()[]{}/\\ ".split(''));
const WIDE = new Set('mwMWĐ@%&'.split(''));

/** Bề rộng ước lượng của một dòng chữ ở cỡ chữ `size`. */
export function textWidth(s: string, size: number, bold = false): number {
  let u = 0;
  for (const ch of s) {
    if (NARROW.has(ch)) u += 0.28;
    else if (WIDE.has(ch)) u += 0.85;
    else if (ch !== ch.toLowerCase()) u += 0.68; // chữ hoa
    else if (/[0-9]/.test(ch)) u += 0.56;
    else u += 0.53;
  }
  return u * size * (bold ? 1.07 : 1);
}

/** Ngắt chữ thành các dòng không rộng quá maxW (giữ xuống dòng có sẵn; từ quá dài thì cắt). */
export function wrapText(text: string, size: number, maxW: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const tryLine = line ? line + ' ' + word : word;
      if (textWidth(tryLine, size, bold) <= maxW) { line = tryLine; continue; }
      if (line) out.push(line);
      // từ dài hơn cả dòng: cắt từng đoạn
      let w = word;
      while (textWidth(w, size, bold) > maxW && w.length > 1) {
        let k = w.length - 1;
        while (k > 1 && textWidth(w.slice(0, k), size, bold) > maxW) k--;
        out.push(w.slice(0, k)); w = w.slice(k);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export const LINE_HEIGHT = 1.2;

/**
 * Tìm cỡ chữ lớn nhất (không quá maxSize) để cả đoạn chữ nằm gọn trong khung w×h (chừa lề),
 * kèm các dòng đã ngắt sẵn.
 */
export function fitText(text: string, w: number, h: number, opts: { maxSize?: number; minSize?: number; bold?: boolean; pad?: number } = {}) {
  const pad = opts.pad ?? 0.12, bold = opts.bold ?? false;
  const iw = Math.max(1, w * (1 - pad * 2)), ih = Math.max(1, h * (1 - pad * 2));
  const maxSize = Math.max(4, Math.min(opts.maxSize ?? 40, ih));
  const minSize = opts.minSize ?? 6;
  // ưu tiên thu nhỏ chữ để từng từ nằm trọn một dòng; chỉ cắt giữa từ khi đã nhỏ hết mức
  const words = text.split(/\s+/).filter(Boolean);
  let size = Math.floor(maxSize);
  for (; size > minSize; size--) {
    if (words.some((w) => textWidth(w, size, bold) > iw)) continue;
    const lines = wrapText(text, size, iw, bold);
    if (lines.length * size * LINE_HEIGHT <= ih) return { size, lines };
  }
  return { size: minSize, lines: wrapText(text, minSize, iw, bold) };
}

/** Màu chữ dễ đọc trên nền `hex`: trắng trên nền tối, xanh đen trên nền sáng. */
export function contrastText(hex: string): string {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? '#1B2A3A' : '#FFFFFF';
}
