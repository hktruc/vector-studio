import type { Doc, Shape } from './types';
import { bboxOf } from './transform';
import { f } from './geometry';

/**
 * Đường nối thông minh giữa hai hình. Thuần dữ liệu, không đụng giao diện.
 *
 * Một đường nối là một Shape kiểu 'connector' với p.a, p.b = id hai hình được nối.
 * Mỗi khi hình di chuyển, `syncConnectors` tính lại đường đi và ghi vào chính shape đó
 * (x, y, w, h và p.pts = các điểm theo tọa độ riêng của khung) — nhờ vậy shapeToSVG vẽ nó như mọi hình khác.
 * Nét được chuyển thành hình đặc (outline) để file SVG không cần stroke/marker và Canva đổi màu được.
 */

export type XY = [number, number];
export type Box = { x0: number; y0: number; x1: number; y1: number };
export type ConnStyle = 'straight' | 'elbow' | 'curve';
export type Cap = 'none' | 'round' | 'butt' | 'arrow' | 'dot' | 'point';

const GAP = 4; // khoảng hở giữa đầu đường nối và cạnh hình

const center = (b: Box): XY => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];

/** Điểm trên cạnh khung b theo hướng từ tâm b tới điểm `toward` (lùi ra ngoài thêm `gap`). */
export function clipToBox(b: Box, toward: XY, gap = GAP): XY {
  const [cx, cy] = center(b), dx = toward[0] - cx, dy = toward[1] - cy;
  if (!dx && !dy) return [cx, cy];
  const hw = (b.x1 - b.x0) / 2 + gap, hh = (b.y1 - b.y0) / 2 + gap;
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
}

/** Điểm giữa cạnh của khung b hướng về phía hình kia (ngang hoặc dọc), kèm hướng pháp tuyến. */
function sidePoint(b: Box, horizontal: boolean, positive: boolean): { p: XY; n: XY } {
  const [cx, cy] = center(b);
  if (horizontal) return positive ? { p: [b.x1 + GAP, cy], n: [1, 0] } : { p: [b.x0 - GAP, cy], n: [-1, 0] };
  return positive ? { p: [cx, b.y1 + GAP], n: [0, 1] } : { p: [cx, b.y0 - GAP], n: [0, -1] };
}

/** Tính đường đi (tọa độ trang) từ khung a tới khung b. */
export function routeConnector(a: Box, b: Box, style: ConnStyle): XY[] {
  const ca = center(a), cb = center(b), dx = cb[0] - ca[0], dy = cb[1] - ca[1];
  if (style === 'straight') return [clipToBox(a, cb), clipToBox(b, ca)];
  const hor = Math.abs(dx) >= Math.abs(dy);
  const sa = sidePoint(a, hor, hor ? dx > 0 : dy > 0), sb = sidePoint(b, hor, hor ? dx < 0 : dy < 0);
  const [pa, pb] = [sa.p, sb.p];
  if (style === 'elbow') {
    if (hor) {
      if (Math.abs(pa[1] - pb[1]) < 0.5) return [pa, pb];
      const mx = (pa[0] + pb[0]) / 2;
      return [pa, [mx, pa[1]], [mx, pb[1]], pb];
    }
    if (Math.abs(pa[0] - pb[0]) < 0.5) return [pa, pb];
    const my = (pa[1] + pb[1]) / 2;
    return [pa, [pa[0], my], [pb[0], my], pb];
  }
  // đường cong Bézier bậc ba, tay nắm vuông góc với cạnh
  const k = Math.max(30, Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * 0.45);
  const c1: XY = [pa[0] + sa.n[0] * k, pa[1] + sa.n[1] * k], c2: XY = [pb[0] + sb.n[0] * k, pb[1] + sb.n[1] * k];
  const out: XY[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t;
    out.push([
      u * u * u * pa[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * pb[0],
      u * u * u * pa[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * pb[1],
    ]);
  }
  return out;
}

/* ---------- Chuyển nét thành hình đặc ---------- */

const area = (pts: XY[]) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Mọi mảnh cùng chiều (diện tích dương) để khi chồng lên nhau vẫn tô đặc với fill-rule nonzero. */
const poly = (pts: XY[]) => { const p = area(pts) < 0 ? [...pts].reverse() : pts; return 'M' + p.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z'; };
const circle = ([x, y]: XY, r: number) => `M${f(x - r)} ${f(y)} A${f(r)} ${f(r)} 0 1 1 ${f(x + r)} ${f(y)} A${f(r)} ${f(r)} 0 1 1 ${f(x - r)} ${f(y)} Z`;
const len = (a: XY, b: XY) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Cắt bớt đoạn dài `d` ở cuối đường (để chừa chỗ cho đầu mũi tên). Trả về đường mới + hướng cuối. */
function trimEnd(pts: XY[], d: number): { pts: XY[]; dir: XY } {
  const p = [...pts];
  let rest = d;
  while (p.length > 1) {
    const a = p[p.length - 2], b = p[p.length - 1], l = len(a, b);
    if (l > rest) {
      const t = (l - rest) / l, nb: XY = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      p[p.length - 1] = nb;
      break;
    }
    rest -= l; p.pop();
  }
  const tip = pts[pts.length - 1], base = p[p.length - 1], l = len(base, tip) || 1;
  return { pts: p, dir: [(tip[0] - base[0]) / l, (tip[1] - base[1]) / l] };
}

/** Tổng độ dài đường. */
export const pathLength = (pts: XY[]) => pts.slice(1).reduce((s, p, i) => s + len(pts[i], p), 0);

/** Chèn thêm điểm tại quãng đường d (tính từ đầu) để độ dày đổi đúng chỗ. */
function splitAt(pts: XY[], d: number): XY[] {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = len(pts[i - 1], pts[i]);
    if (d > acc + 0.01 && d < acc + l - 0.01) {
      const t = (d - acc) / l, a = pts[i - 1], b = pts[i];
      return [...pts.slice(0, i), [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ...pts.slice(i)];
    }
    acc += l;
  }
  return pts;
}

/**
 * Đường nét dày `th` theo các điểm `pts` → chuỗi path tô đặc (không dùng stroke/marker).
 * Đầu mút: 'arrow' mũi tên đặc · 'dot' chấm tròn · 'point' nhọn (thon dần) · 'butt' bằng · 'round'/'none' tròn.
 * hs: hệ số cỡ đầu mút (mũi tên, chấm, độ dài phần thon).
 */
export function strokeOutline(pts0: XY[], th: number, start: Cap = 'none', end: Cap = 'arrow', hs = 1): string {
  let pts = pts0.filter((p, i) => i === 0 || len(pts0[i - 1], p) > 0.01);
  if (pts.length < 2) return '';
  const head = Math.max(10, th * 3.5) * hs, hw = head * 0.55;
  const total = pathLength(pts);
  const out: string[] = [];
  const arrow = (tip: XY, dir: XY) => {
    const b: XY = [tip[0] - dir[0] * head, tip[1] - dir[1] * head], n: XY = [-dir[1], dir[0]];
    out.push(poly([tip, [b[0] + n[0] * hw, b[1] + n[1] * hw], [b[0] - n[0] * hw, b[1] - n[1] * hw]]));
  };
  // chỉ chừa chỗ cho mũi tên khi đường đủ dài
  if (end === 'arrow' && total > head * 1.2) { const tip = pts[pts.length - 1], t = trimEnd(pts, head * 0.85); pts = t.pts; arrow(tip, t.dir); }
  if (start === 'arrow' && pathLength(pts) > head * 1.2) {
    const rev = [...pts].reverse(), tip = rev[rev.length - 1], t = trimEnd(rev, head * 0.85);
    pts = t.pts.reverse(); arrow(tip, t.dir);
  }
  // đầu nhọn: độ dày giảm dần về 0 trên một đoạn
  const L = pathLength(pts);
  const tS = start === 'point' ? Math.min(th * 6 * hs, L * 0.45) : 0, tE = end === 'point' ? Math.min(th * 6 * hs, L * 0.45) : 0;
  if (tS) pts = splitAt(pts, tS);
  if (tE) pts = splitAt(pts, L - tE);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(pts[i - 1], pts[i]));
  const width = (d: number) => th * Math.max(0, Math.min(1, tS ? d / tS : 1, tE ? (L - d) / tE : 1));
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = len(a, b); if (l < 0.01) continue;
    const wa = width(cum[i - 1]) / 2, wb = width(cum[i]) / 2;
    if (wa < 0.01 && wb < 0.01) continue;
    const ux = -(b[1] - a[1]) / l, uy = (b[0] - a[0]) / l;
    out.push(poly([[a[0] + ux * wa, a[1] + uy * wa], [b[0] + ux * wb, b[1] + uy * wb], [b[0] - ux * wb, b[1] - uy * wb], [a[0] - ux * wa, a[1] - uy * wa]]));
  }
  // khớp nối bo tròn ở các điểm gấp
  for (let i = 1; i < pts.length - 1; i++) { const w = width(cum[i]) / 2; if (w > 0.05) out.push(circle(pts[i], w)); }
  const capAt = (p: XY, c: Cap) => {
    if (c === 'dot') out.push(circle(p, Math.max(th * 1.1, 4) * hs));
    else if (c === 'none' || c === 'round') out.push(circle(p, th / 2));
  };
  capAt(pts0[0], start);
  capAt(pts0[pts0.length - 1], end);
  return out.join(' ');
}

/* ---------- Đồng bộ đường nối với các hình ---------- */

export const isConnector = (s: Shape) => s.t === 'connector';

/**
 * Tính lại vị trí mọi đường nối theo hình hai đầu. Gọi sau mỗi thay đổi.
 * Đường nối thiếu một đầu (hình đã bị xóa) được giữ nguyên; DocStore.remove lo việc xóa chúng.
 */
export function syncConnectors(doc: Doc) {
  const byId = new Map(doc.shapes.map((s) => [s.id, s]));
  for (const s of doc.shapes) {
    if (!isConnector(s)) continue;
    const a = byId.get(s.p.a), b = byId.get(s.p.b);
    if (!a || !b || a === b) continue;
    const pts = routeConnector(bboxOf([a]), bboxOf([b]), s.p.style || 'straight');
    const head = Math.max(10, (s.p.th || 3) * 3.5), pad = head + (s.p.th || 3) * 2 + 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    s.w = x1 - x0; s.h = y1 - y0; s.x = (x0 + x1) / 2; s.y = (y0 + y1) / 2;
    s.r = 0; s.fx = 1; s.fy = 1;
    s.p.pts = pts.map(([x, y]) => [Math.round((x - x0) * 100) / 100, Math.round((y - y0) * 100) / 100]);
  }
}
