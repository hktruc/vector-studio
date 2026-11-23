import type { Shape } from './types';
import { partsOf } from '../shapes/registry';
import { toWorldPt } from './transform';
import { parsePath, segment, segmentCount, type SubPath, type XY } from './pathdata';
import { strokeOutline } from './connect';

/**
 * Phép toán hình (hợp, trừ, giao, loại trừ) và phình/co đường viền. Thuần dữ liệu, không thư viện ngoài.
 *
 * Cách làm ("phân loại cạnh"):
 *  1. Làm phẳng mọi đường cong thành đa giác (các đoạn rất ngắn) trên tọa độ trang.
 *  2. Cắt mọi cạnh tại các giao điểm với cạnh khác (kể cả đoạn trùng nhau một phần).
 *  3. Với mỗi đoạn nhỏ, xét hai điểm sát hai bên: bên nào thuộc kết quả, bên nào không.
 *     Đoạn nằm đúng ranh giới (một bên trong, một bên ngoài) thì giữ, và quay chiều sao cho phần trong ở bên trái.
 *  4. Nối các đoạn giữ lại thành vòng khép kín. Vì chiều luôn nhất quán nên lỗ thủng tự đúng với fill-rule nonzero.
 */

export type Ring = XY[];
/** Một "toán hạng": các mảnh, mỗi mảnh có quy tắc tô riêng (nonzero / evenodd). */
export interface Operand { parts: { rule: 'nonzero' | 'evenodd'; rings: Ring[] }[] }
export type BoolOp = 'union' | 'subtract' | 'intersect' | 'exclude';

/* ---------- 1. Làm phẳng ---------- */

/** Đường con → đa giác trên trang (đường mở được coi như khép kín, giống cách SVG tô). */
export function flattenSubs(subs: SubPath[], tf: (p: XY) => XY, step = 3): Ring[] {
  const out: Ring[] = [];
  for (const sp of subs) {
    const ring: Ring = [tf([sp.n[0].x, sp.n[0].y])];
    for (let k = 0; k < segmentCount(sp); k++) {
      const q = segment(sp, k).map(tf) as [XY, XY, XY, XY];
      const curved = q[1][0] !== q[0][0] || q[1][1] !== q[0][1] || q[2][0] !== q[3][0] || q[2][1] !== q[3][1];
      if (!curved) { ring.push(q[3]); continue; }
      const L = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]) + Math.hypot(q[3][0] - q[2][0], q[3][1] - q[2][1]);
      const n = Math.max(4, Math.min(96, Math.ceil(L / step)));
      for (let i = 1; i <= n; i++) {
        const t = i / n, v = 1 - t, a = v * v * v, b = 3 * v * v * t, c = 3 * v * t * t, e = t * t * t;
        ring.push([a * q[0][0] + b * q[1][0] + c * q[2][0] + e * q[3][0], a * q[0][1] + b * q[1][1] + c * q[2][1] + e * q[3][1]]);
      }
    }
    // bỏ điểm cuối trùng điểm đầu
    const f = ring[0], l = ring[ring.length - 1];
    if (ring.length > 1 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-9) ring.pop();
    if (ring.length >= 3) out.push(ring);
  }
  return out;
}

/** Hình → toán hạng trên tọa độ trang (theo đúng phần vẽ của shapeToSVG). */
export function shapeOperand(s: Shape): Operand {
  const tf = (p: XY) => toWorldPt(s, p[0], p[1]);
  return { parts: partsOf(s.t, s.w, s.h, s.p).filter((pt) => pt.d).map((pt) => ({ rule: pt.rule === 'evenodd' ? 'evenodd' : 'nonzero', rings: flattenSubs(parsePath(pt.d!), tf) })) };
}

/* ---------- Điểm nằm trong? ---------- */

/** Số vòng quấn (winding number) của các vòng quanh điểm p. */
export function winding(rings: Ring[], p: XY): number {
  let w = 0;
  for (const r of rings) for (let i = 0, n = r.length; i < n; i++) {
    const a = r[i], b = r[(i + 1) % n];
    if (a[1] <= p[1]) { if (b[1] > p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) > 0) w++; }
    else if (b[1] <= p[1] && (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]) < 0) w--;
  }
  return w;
}
export const insideOperand = (o: Operand, p: XY) => o.parts.some((pt) => { const w = winding(pt.rings, p); return pt.rule === 'evenodd' ? w % 2 !== 0 : w !== 0; });

export const PREDICATES: Record<BoolOp, (f: boolean[]) => boolean> = {
  union: (f) => f.some(Boolean),
  intersect: (f) => f.every(Boolean),
  subtract: (f) => f[0] && !f.slice(1).some(Boolean), // hình dưới cùng trừ đi các hình phía trên
  exclude: (f) => f.filter(Boolean).length % 2 === 1,
};

/* ---------- 2–4. Cắt cạnh, phân loại, nối vòng ---------- */

type Edge = { a: XY; b: XY; cuts: { t: number; p: XY }[] };
const EPS = 1e-9;

function addCut(e: Edge, t: number, p: XY) { if (t > 1e-9 && t < 1 - 1e-9) e.cuts.push({ t, p }); }

/** Tìm giao điểm của hai cạnh và ghi điểm cắt vào cả hai (dùng chung một tọa độ để nối khít). */
function intersect(e: Edge, g: Edge) {
  const [ax, ay] = e.a, [bx, by] = e.b, [cx, cy] = g.a, [dx, dy] = g.b;
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx, lr = Math.hypot(rx, ry), ls = Math.hypot(sx, sy);
  if (lr < EPS || ls < EPS) return;
  if (Math.abs(den) > 1e-10 * lr * ls) {
    const t = ((cx - ax) * sy - (cy - ay) * sx) / den, u = ((cx - ax) * ry - (cy - ay) * rx) / den;
    if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return;
    const p: XY = [ax + rx * t, ay + ry * t];
    addCut(e, t, p); addCut(g, u, p);
    return;
  }
  // song song: chỉ xử lý khi thẳng hàng (trùng nhau một phần) — cắt tại đầu mút của cạnh kia
  if (Math.abs((cx - ax) * ry - (cy - ay) * rx) > 1e-7 * lr) return;
  const proj = (px: number, py: number, ox: number, oy: number, vx: number, vy: number, L2: number) => ((px - ox) * vx + (py - oy) * vy) / L2;
  addCut(e, proj(cx, cy, ax, ay, rx, ry, lr * lr), [cx, cy]);
  addCut(e, proj(dx, dy, ax, ay, rx, ry, lr * lr), [dx, dy]);
  addCut(g, proj(ax, ay, cx, cy, sx, sy, ls * ls), [ax, ay]);
  addCut(g, proj(bx, by, cx, cy, sx, sy, ls * ls), [bx, by]);
}

const key = (p: XY) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;

/** Phép toán trên nhiều toán hạng (theo thứ tự dưới → trên). Trả về các vòng kết quả (phần trong luôn ở bên trái). */
export function booleanRings(ops: Operand[], op: BoolOp): Ring[] {
  const pred = PREDICATES[op];
  const edges: Edge[] = [];
  for (const o of ops) for (const pt of o.parts) for (const r of pt.rings)
    for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > EPS) edges.push({ a, b, cuts: [] }); }
  // khung bao để bỏ qua nhanh các cặp xa nhau
  const bb = edges.map((e) => [Math.min(e.a[0], e.b[0]), Math.min(e.a[1], e.b[1]), Math.max(e.a[0], e.b[0]), Math.max(e.a[1], e.b[1])]);
  const order = edges.map((_, i) => i).sort((i, j) => bb[i][0] - bb[j][0]);
  for (let ii = 0; ii < order.length; ii++) {
    const i = order[ii];
    for (let jj = ii + 1; jj < order.length; jj++) {
      const j = order[jj];
      if (bb[j][0] > bb[i][2] + 1e-9) break;
      if (bb[j][1] > bb[i][3] + 1e-9 || bb[j][3] < bb[i][1] - 1e-9) continue;
      intersect(edges[i], edges[j]);
    }
  }
  const flags = (p: XY) => pred(ops.map((o) => insideOperand(o, p)));
  const kept = new Map<string, [XY, XY]>();
  for (const e of edges) {
    const pts: XY[] = [e.a, ...e.cuts.sort((x, y) => x.t - y.t).map((c) => c.p), e.b];
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-6) continue;
      const m: XY = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.min(1e-3, L / 4);
      const nx = (-(b[1] - a[1]) / L) * d, ny = ((b[0] - a[0]) / L) * d;
      const left = flags([m[0] + nx, m[1] + ny]), right = flags([m[0] - nx, m[1] - ny]);
      if (left === right) continue;
      const [s, t] = left ? [a, b] : [b, a];
      kept.set(key(s) + '>' + key(t), [s, t]); // cạnh trùng nhau chỉ giữ một
    }
  }
  // nối thành vòng
  const from = new Map<string, [XY, XY][]>();
  for (const e of kept.values()) { const k = key(e[0]); if (!from.has(k)) from.set(k, []); from.get(k)!.push(e); }
  const used = new Set<[XY, XY]>(), rings: Ring[] = [];
  for (const start of kept.values()) {
    if (used.has(start)) continue;
    const ring: Ring = [start[0]];
    let cur = start, ok = false;
    for (let guard = 0; guard < kept.size + 1; guard++) {
      used.add(cur); ring.push(cur[1]);
      if (key(cur[1]) === key(start[0])) { ok = true; break; }
      const next = (from.get(key(cur[1])) || []).find((x) => !used.has(x));
      if (!next) break;
      cur = next;
    }
    ring.pop();
    if (ok && ring.length >= 3) rings.push(simplifyRing(ring));
  }
  return rings.filter((r) => r.length >= 3 && Math.abs(ringArea(r)) > 1e-3);
}

export const ringArea = (r: Ring) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/**
 * Bỏ điểm thừa: điểm gần như thẳng hàng với điểm giữ lại trước đó và điểm kế tiếp (sai lệch dưới tol).
 * Bắt đầu từ điểm xa tâm nhất (chắc chắn là đỉnh phải giữ) và luôn so với điểm đã giữ gần nhất,
 * để sai lệch không bao giờ dồn quá tol.
 */
export function simplifyRing(r: Ring, tol = 0.08): Ring {
  if (r.length <= 3) return r;
  const cx = r.reduce((s, p) => s + p[0], 0) / r.length, cy = r.reduce((s, p) => s + p[1], 0) / r.length;
  let start = 0, far = -1;
  r.forEach((p, i) => { const d = Math.hypot(p[0] - cx, p[1] - cy); if (d > far) { far = d; start = i; } });
  const pts = [...r.slice(start), ...r.slice(0, start)];
  const out: Ring = [pts[0]];
  let last = 0; // vị trí (trong pts) của điểm giữ lại gần nhất
  for (let i = 1; i < pts.length; i++) {
    const a = pts[last], c = pts[(i + 1) % pts.length];
    // kiểm tra mọi điểm đã bỏ từ a tới i đều còn nằm sát đoạn a → c
    let ok = true;
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    for (let j = last + 1; j <= i && ok; j++) {
      const b = pts[j];
      const dist = L < 1e-9 ? Math.hypot(b[0] - a[0], b[1] - a[1]) : Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / L;
      if (dist > tol) ok = false;
    }
    if (!ok) { out.push(pts[i]); last = i; }
  }
  return out.length >= 3 ? out : r;
}

/* ---------- Phình / co đường viền ---------- */

/**
 * Phình ra (d > 0) hoặc co vào (d < 0) một toán hạng: hợp/trừ với "dải" bao quanh đường viền dày 2|d|.
 * Góc phình ra được bo tròn tự nhiên.
 */
export function offsetRings(o: Operand, d: number): Ring[] {
  if (Math.abs(d) < 1e-6) return booleanRings([o], 'union');
  const band: Ring[] = [];
  for (const pt of o.parts) for (const r of pt.rings) {
    const outline = strokeOutline([...r, r[0], r[1]], Math.abs(d) * 2, 'round', 'round');
    band.push(...flattenSubs(parsePath(outline), (p) => p, 2));
  }
  const bandOp: Operand = { parts: [{ rule: 'nonzero', rings: band }] };
  return booleanRings([o, bandOp], d > 0 ? 'union' : 'subtract');
}

/** Các vòng → đường con (để tạo hình 'path'). */
export const ringsToSubs = (rings: Ring[]): SubPath[] => rings.map((r) => ({ c: true, n: r.map(([x, y]) => ({ x, y })) }));
