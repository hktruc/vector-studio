import { COLORS } from './constants';

/** Bộ màu thương hiệu: tự lưu, dùng chung cho mọi tài liệu. Không phụ thuộc giao diện. */

export const PALETTE_KEY = 'vector-studio-palette-v1';
export const PALETTE_MAX = 30;

/** Chuẩn hóa mã màu về dạng #RRGGBB (chữ hoa). Nhận '#abc', 'abc', '#AABBCC', 'aabbcc'. Sai thì trả null. */
export function normalizeHex(s: string): string | null {
  let h = s.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toUpperCase() : null;
}

/** Tách một đoạn chữ bất kỳ (dán từ tài liệu thương hiệu) thành danh sách mã màu, bỏ trùng. */
export function parseColorList(text: string): string[] {
  const out: string[] = [];
  for (const m of text.match(/#?\b[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || []) {
    const c = normalizeHex(m);
    if (c && !out.includes(c)) out.push(c);
  }
  return out.slice(0, PALETTE_MAX);
}

export class BrandPalette {
  colors: string[] = COLORS.map((c) => normalizeHex(c)!);
  private listeners = new Set<() => void>();

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = null) {
    try {
      const j = storage?.getItem(PALETTE_KEY);
      if (j) { const a = JSON.parse(j); if (Array.isArray(a)) this.colors = a.map(String).map(normalizeHex).filter((c): c is string => !!c).slice(0, PALETTE_MAX); }
    } catch { /* bỏ qua */ }
  }
  onChange(fn: () => void) { this.listeners.add(fn); }
  private changed() {
    try { this.storage?.setItem(PALETTE_KEY, JSON.stringify(this.colors)); } catch { /* bỏ qua */ }
    this.listeners.forEach((f) => f());
  }
  /** Thêm màu (bỏ qua nếu sai mã, đã có, hoặc đầy). Trả về true nếu đã thêm. */
  add(c: string): boolean {
    const h = normalizeHex(c);
    if (!h || this.colors.includes(h) || this.colors.length >= PALETTE_MAX) return false;
    this.colors = [...this.colors, h]; this.changed(); return true;
  }
  remove(i: number) { if (i < 0 || i >= this.colors.length) return; this.colors = this.colors.filter((_, j) => j !== i); this.changed(); }
  /** Thay cả bộ bằng các màu tìm được trong đoạn chữ. Trả về số màu đọc được (0 = giữ nguyên). */
  setFromText(text: string): number {
    const l = parseColorList(text); if (!l.length) return 0;
    this.colors = l; this.changed(); return l.length;
  }
  reset() { this.colors = COLORS.map((c) => normalizeHex(c)!); this.changed(); }
  /** Danh sách màu để chia cho hình mới (rỗng thì dùng màu mặc định). */
  cycle(): string[] { return this.colors.length ? this.colors : COLORS; }
}
