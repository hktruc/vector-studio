import type { Shape } from './types';
import { bboxOf } from './transform';

/** Căn chỉnh, phân bố đều và đường gióng. Thuần dữ liệu, không đụng giao diện. */

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** Chia vùng chọn thành các "khối": mỗi nhóm là một khối, mỗi hình lẻ là một khối. */
export function unitsOf(list: Shape[]): Shape[][] {
  const map = new Map<string, Shape[]>();
  for (const s of list) {
    const key = s.gid !== undefined ? 'g' + s.gid : 's' + s.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.values()];
}

const shift = (u: Shape[], dx: number, dy: number) => u.forEach((s) => { s.x += dx; s.y += dy; });

/**
 * Căn các khối theo cạnh/tâm. Nếu chỉ có một khối (một hình hoặc một nhóm) thì căn theo khung `frame`
 * (thường là cả trang). Nhóm di chuyển nguyên khối, không bị xô lệch bên trong.
 */
export function alignShapes(list: Shape[], mode: AlignMode, frame: Box) {
  const us = unitsOf(list);
  if (!us.length) return;
  const T = us.length === 1 ? frame : bboxOf(list);
  for (const u of us) {
    const b = bboxOf(u);
    let dx = 0, dy = 0;
    if (mode === 'left') dx = T.x0 - b.x0;
    else if (mode === 'right') dx = T.x1 - b.x1;
    else if (mode === 'hcenter') dx = (T.x0 + T.x1) / 2 - (b.x0 + b.x1) / 2;
    else if (mode === 'top') dy = T.y0 - b.y0;
    else if (mode === 'bottom') dy = T.y1 - b.y1;
    else dy = (T.y0 + T.y1) / 2 - (b.y0 + b.y1) / 2;
    shift(u, dx, dy);
  }
}

/**
 * Phân bố đều: giữ nguyên hai khối ngoài cùng, chia đều khoảng trống giữa các khối.
 * Cần ít nhất 3 khối; trả về false nếu không đủ.
 */
export function distributeShapes(list: Shape[], axis: 'h' | 'v'): boolean {
  const us = unitsOf(list);
  if (us.length < 3) return false;
  const lo = axis === 'h' ? 'x0' : 'y0', hi = axis === 'h' ? 'x1' : 'y1';
  const items = us.map((u) => ({ u, b: bboxOf(u) })).sort((a, b) => (a.b[lo] + a.b[hi]) - (b.b[lo] + b.b[hi]));
  const start = items[0].b[lo], end = items[items.length - 1].b[hi];
  const total = items.reduce((n, it) => n + (it.b[hi] - it.b[lo]), 0);
  const gap = (end - start - total) / (items.length - 1);
  let pos = start;
  for (const it of items) {
    const d = pos - it.b[lo];
    axis === 'h' ? shift(it.u, d, 0) : shift(it.u, 0, d);
    pos += it.b[hi] - it.b[lo] + gap;
  }
  return true;
}

/* ---------- Đường gióng thông minh ---------- */

/** Một đường gióng để vẽ: dọc (x cố định, từ a tới b theo y) hoặc ngang (y cố định, từ a tới b theo x). */
export type Guide = { dir: 'v' | 'h'; at: number; a: number; b: number };

/**
 * Tìm độ dời nhỏ nhất (trong ngưỡng `tol`) để khung đang kéo `m` thẳng hàng cạnh/tâm với một khung khác
 * hoặc với trang. Trả về độ dời cần cộng thêm cho từng trục (null = không bắt) và các đường gióng để vẽ.
 */
export function snapToGuides(m: Box, others: Box[], page: Box, tol: number) {
  const targets = [page, ...others];
  const pick = (lo: 'x0' | 'y0', hi: 'x1' | 'y1') => {
    const mine = [m[lo], (m[lo] + m[hi]) / 2, m[hi]];
    let best: number | null = null;
    for (const t of targets)
      for (const v of [t[lo], (t[lo] + t[hi]) / 2, t[hi]])
        for (const p of mine) {
          const d = v - p;
          if (Math.abs(d) <= tol && (best === null || Math.abs(d) < Math.abs(best))) best = d;
        }
    return best;
  };
  const dx = pick('x0', 'x1'), dy = pick('y0', 'y1');
  const moved: Box = { x0: m.x0 + (dx ?? 0), x1: m.x1 + (dx ?? 0), y0: m.y0 + (dy ?? 0), y1: m.y1 + (dy ?? 0) };
  const guides: Guide[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  // vẽ mọi đường thẳng hàng sau khi đã bắt (có thể vài đường cùng lúc)
  const lines = (dir: 'v' | 'h') => {
    const lo = dir === 'v' ? 'x0' : 'y0', hi = dir === 'v' ? 'x1' : 'y1';
    const plo = dir === 'v' ? 'y0' : 'x0', phi = dir === 'v' ? 'y1' : 'x1';
    const mine = [moved[lo], (moved[lo] + moved[hi]) / 2, moved[hi]];
    const seen = new Set<number>();
    for (const t of targets)
      for (const v of [t[lo], (t[lo] + t[hi]) / 2, t[hi]])
        if (mine.some((p) => near(p, v))) {
          const key = Math.round(v * 2);
          const a = Math.min(moved[plo], t[plo]), b = Math.max(moved[phi], t[phi]);
          const g = guides.find((x) => x.dir === dir && Math.round(x.at * 2) === key);
          if (g) { g.a = Math.min(g.a, a); g.b = Math.max(g.b, b); }
          else if (!seen.has(key)) { seen.add(key); guides.push({ dir, at: v, a, b }); }
        }
  };
  if (dx !== null) lines('v');
  if (dy !== null) lines('h');
  return { dx, dy, guides };
}
