import type { Shape } from './types';
import { partsOf } from '../shapes/registry';
import { toLocal, toWorldPt } from './transform';
import { bezierAt, parsePath, segment, segmentCount, splitBezier, type PNode, type SubPath, type XY } from './pathdata';

/**
 * Hình dạng đường tự do (loại hình 'path') và thao tác sửa điểm neo. Thuần dữ liệu.
 *
 * Shape.p = { parts: [{ sh (độ sáng tối), rule, subs: SubPath[] }], orig?: { t, p }, edited?: boolean }.
 * Tọa độ điểm neo lưu theo tỉ lệ 0..1 của khung (giống đường cong), nên đổi cỡ khung là co giãn theo.
 * `orig` giữ hình gốc có thông số: chưa sửa điểm nào thì quay lại được.
 */

export interface PathPart { sh: number; rule?: 'evenodd' | 'nonzero'; subs: SubPath[] }
export interface NodeRef { pi: number; si: number; ni: number }

const NOT_CONVERTIBLE = new Set(['text', 'image', 'connector', 'path']);
export const canConvertToPath = (s: Shape) => !NOT_CONVERTIBLE.has(s.t);

const mapNode = (n: PNode, f: (p: XY) => XY): PNode => {
  const [x, y] = f([n.x, n.y]);
  const out: PNode = { x, y };
  if (n.i) out.i = f(n.i);
  if (n.o) out.o = f(n.o);
  if (n.s) out.s = 1;
  return out;
};
const mapParts = (parts: PathPart[], f: (p: XY) => XY): PathPart[] => parts.map((pt) => ({ ...pt, subs: pt.subs.map((s) => ({ c: s.c, n: s.n.map((n) => mapNode(n, f)) })) }));

/** Các mảnh của đường theo tọa độ riêng (điểm ảnh) của khung. */
export const localParts = (s: Shape): PathPart[] => mapParts(s.p.parts || [], ([x, y]) => [x * s.w, y * s.h]);
const store = (s: Shape, parts: PathPart[], edited = true) => {
  s.p = { ...s.p, parts: mapParts(parts, ([x, y]) => [x / s.w, y / s.h]), edited: edited || !!s.p.edited };
  refitPath(s);
};

/** Chuyển hình có thông số thành đường tự do (giữ màu, vị trí; giữ hình gốc để quay lại). */
export function convertToPath(s: Shape): boolean {
  if (!canConvertToPath(s)) return false;
  const parts: PathPart[] = partsOf(s.t, s.w, s.h, s.p).filter((pt) => pt.d).map((pt) => ({ sh: pt.shade || 0, rule: pt.rule, subs: parsePath(pt.d!) }));
  if (!parts.some((p) => p.subs.length)) return false;
  const orig = { t: s.t, p: JSON.parse(JSON.stringify(s.p)) };
  s.t = 'path';
  s.p = { parts: mapParts(parts, ([x, y]) => [x / s.w, y / s.h]), orig, edited: false };
  return true;
}

/** Quay lại hình có thông số (chỉ khi chưa sửa điểm neo nào). */
export function revertPath(s: Shape): boolean {
  if (s.t !== 'path' || !s.p.orig || s.p.edited) return false;
  s.t = s.p.orig.t; s.p = s.p.orig.p;
  return true;
}

/** Co khung ôm sát đường (lấy mẫu cả đoạn cong), giữ nguyên vị trí trên trang. */
export function refitPath(s: Shape) {
  if (s.t !== 'path' || s.w < 1e-6 || s.h < 1e-6) return;
  const parts = localParts(s);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = ([x, y]: XY) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const pt of parts) for (const sp of pt.subs) {
    sp.n.forEach((n) => add([n.x, n.y]));
    for (let k = 0; k < segmentCount(sp); k++) { const q = segment(sp, k); for (let t = 0.125; t < 1; t += 0.125) add(bezierAt(q, t)); }
  }
  if (!isFinite(x0)) return;
  // đường quá mỏng (một đoạn thẳng ngang/dọc): giữ tối thiểu 1px để không chia cho 0
  if (x1 - x0 < 1) { const m = (x0 + x1) / 2; x0 = m - 0.5; x1 = m + 0.5; }
  if (y1 - y0 < 1) { const m = (y0 + y1) / 2; y0 = m - 0.5; y1 = m + 0.5; }
  const nw = x1 - x0, nh = y1 - y0;
  if (Math.abs(x0) < 0.01 && Math.abs(y0) < 0.01 && Math.abs(nw - s.w) < 0.01 && Math.abs(nh - s.h) < 0.01) return;
  const [cx, cy] = toWorldPt(s, (x0 + x1) / 2, (y0 + y1) / 2);
  s.p = { ...s.p, parts: mapParts(parts, ([x, y]) => [(x - x0) / nw, (y - y0) / nh]) };
  s.x = cx; s.y = cy; s.w = nw; s.h = nh;
}

/* ---------- Truy vấn ---------- */

/** Mọi điểm neo và tay nắm theo tọa độ trang (để vẽ và bấm). */
export function pathNodesWorld(s: Shape) {
  const out: { ref: NodeRef; p: XY; i?: XY; o?: XY; smooth: boolean }[] = [];
  localParts(s).forEach((pt, pi) => pt.subs.forEach((sp, si) => sp.n.forEach((n, ni) => out.push({
    ref: { pi, si, ni }, p: toWorldPt(s, n.x, n.y), i: n.i && toWorldPt(s, ...n.i), o: n.o && toWorldPt(s, ...n.o), smooth: !!n.s,
  }))));
  return out;
}

/** Đoạn gần điểm (x, y) trên trang nhất: chỉ số đoạn, tham số t, khoảng cách (theo đơn vị trang). */
export function nearestSegment(s: Shape, x: number, y: number) {
  let best = { pi: -1, si: -1, k: -1, t: 0, dist: Infinity };
  localParts(s).forEach((pt, pi) => pt.subs.forEach((sp, si) => {
    for (let k = 0; k < segmentCount(sp); k++) {
      const q = segment(sp, k);
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, [lx, ly] = bezierAt(q, t), [wx, wy] = toWorldPt(s, lx, ly), d = Math.hypot(wx - x, wy - y);
        if (d < best.dist) best = { pi, si, k, t, dist: d };
      }
    }
  }));
  return best;
}

/* ---------- Sửa điểm neo ---------- */

const nodeOf = (parts: PathPart[], r: NodeRef) => parts[r.pi]?.subs[r.si]?.n[r.ni];

/** Dời điểm neo tới (x, y) trên trang; hai tay nắm đi theo. */
export function moveNode(s: Shape, r: NodeRef, x: number, y: number) {
  const parts = localParts(s), n = nodeOf(parts, r); if (!n) return;
  const [lx, ly] = toLocal(s, x, y), dx = lx - n.x, dy = ly - n.y;
  n.x = lx; n.y = ly;
  if (n.i) n.i = [n.i[0] + dx, n.i[1] + dy];
  if (n.o) n.o = [n.o[0] + dx, n.o[1] + dy];
  store(s, parts);
}

/** Dời tay nắm 'i' (vào) hoặc 'o' (ra). Điểm trơn: tay nắm bên kia xoay theo cho thẳng hàng (giữ độ dài). */
export function moveHandle(s: Shape, r: NodeRef, which: 'i' | 'o', x: number, y: number) {
  const parts = localParts(s), n = nodeOf(parts, r); if (!n) return;
  const [lx, ly] = toLocal(s, x, y);
  n[which] = [lx, ly];
  const other = which === 'i' ? 'o' : 'i', op = n[other];
  if (n.s && op) {
    const vx = n.x - lx, vy = n.y - ly, L = Math.hypot(vx, vy) || 1, ol = Math.hypot(op[0] - n.x, op[1] - n.y);
    n[other] = [n.x + (vx / L) * ol, n.y + (vy / L) * ol];
  }
  store(s, parts);
}

/** Đổi điểm neo giữa góc nhọn và điểm trơn (tạo tay nắm theo hướng hai điểm bên cạnh). */
export function toggleSmooth(s: Shape, r: NodeRef) {
  const parts = localParts(s), sp = parts[r.pi]?.subs[r.si], n = sp?.n[r.ni]; if (!sp || !n) return;
  if (n.s) { delete n.s; delete n.i; delete n.o; }
  else {
    const N = sp.n.length, prev = sp.n[(r.ni - 1 + N) % N], next = sp.n[(r.ni + 1) % N];
    const hasPrev = sp.c || r.ni > 0, hasNext = sp.c || r.ni < N - 1;
    const a: XY = hasPrev ? [prev.x, prev.y] : [n.x, n.y], b: XY = hasNext ? [next.x, next.y] : [n.x, n.y];
    const tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
    const li = hasPrev ? Math.hypot(n.x - prev.x, n.y - prev.y) / 3 : 0, lo = hasNext ? Math.hypot(next.x - n.x, next.y - n.y) / 3 : 0;
    if (li) n.i = [n.x - (tx / L) * li, n.y - (ty / L) * li];
    if (lo) n.o = [n.x + (tx / L) * lo, n.y + (ty / L) * lo];
    n.s = 1;
  }
  store(s, parts);
}

/** Xóa điểm neo (giữ tối thiểu 2 điểm cho đường mở, 3 điểm cho đường khép kín). Trả về false nếu không xóa được. */
export function deleteNode(s: Shape, r: NodeRef): boolean {
  const parts = localParts(s), sp = parts[r.pi]?.subs[r.si]; if (!sp) return false;
  if (sp.n.length <= (sp.c ? 3 : 2)) return false;
  sp.n.splice(r.ni, 1);
  store(s, parts);
  return true;
}

/** Chèn điểm neo vào đoạn k tại t (giữ nguyên dáng đường). Trả về điểm mới. */
export function insertNode(s: Shape, pi: number, si: number, k: number, t: number): NodeRef | null {
  const parts = localParts(s), sp = parts[pi]?.subs[si]; if (!sp || k < 0 || k >= segmentCount(sp)) return null;
  const a = sp.n[k], b = sp.n[(k + 1) % sp.n.length], curved = !!(a.o || b.i);
  const q = segment(sp, k), [h1, h2] = splitBezier(q, t);
  const m: PNode = { x: h1[3][0], y: h1[3][1] };
  if (curved) { a.o = h1[1]; m.i = h1[2]; m.o = h2[1]; b.i = h2[2]; m.s = 1; }
  sp.n.splice(k + 1, 0, m);
  store(s, parts);
  return { pi, si, ni: k + 1 };
}

/**
 * Uốn cong một cạnh: kéo điểm tại t trên đoạn k đi một vector (dx, dy) trên trang.
 * q0: bốn điểm điều khiển của đoạn lúc bắt đầu kéo (tọa độ riêng) — luôn tính từ trạng thái gốc để không cộng dồn sai số.
 */
export function bendSegment(s: Shape, pi: number, si: number, k: number, t: number, q0: [XY, XY, XY, XY], dx: number, dy: number) {
  const parts = localParts(s), sp = parts[pi]?.subs[si]; if (!sp) return;
  const a = sp.n[k], b = sp.n[(k + 1) % sp.n.length];
  // đổi vector dời từ hệ trang sang hệ riêng (chỉ xoay/lật, không dời gốc)
  const [ox, oy] = toLocal(s, s.x, s.y), [vx, vy] = toLocal(s, s.x + dx, s.y + dy), lx = vx - ox, ly = vy - oy;
  const tt = Math.min(0.85, Math.max(0.15, t)), kk = 1 / (3 * tt * (1 - tt)); // điểm tại t dời đúng (dx, dy)
  // đoạn thẳng: tay nắm khởi đầu ở 1/3 và 2/3 để đoạn uốn mượt
  const c1: XY = q0[1][0] === q0[0][0] && q0[1][1] === q0[0][1] && q0[2][0] === q0[3][0] && q0[2][1] === q0[3][1]
    ? [q0[0][0] + (q0[3][0] - q0[0][0]) / 3, q0[0][1] + (q0[3][1] - q0[0][1]) / 3] : q0[1];
  const c2: XY = c1 === q0[1] ? q0[2] : [q0[0][0] + ((q0[3][0] - q0[0][0]) * 2) / 3, q0[0][1] + ((q0[3][1] - q0[0][1]) * 2) / 3];
  a.o = [c1[0] + lx * kk, c1[1] + ly * kk];
  b.i = [c2[0] + lx * kk, c2[1] + ly * kk];
  delete a.s; delete b.s; // điểm hai đầu thành góc để không kéo lệch cạnh bên cạnh
  store(s, parts);
}

/** Bốn điểm điều khiển (tọa độ riêng) của một đoạn — để bắt đầu uốn. */
export function segmentLocal(s: Shape, pi: number, si: number, k: number): [XY, XY, XY, XY] | null {
  const sp = localParts(s)[pi]?.subs[si];
  return sp ? segment(sp, k) : null;
}

export const nodeCount = (s: Shape) => (s.p.parts || []).reduce((n: number, pt: PathPart) => n + pt.subs.reduce((m, sp) => m + sp.n.length, 0), 0);

/* ---------- Bo góc / vát góc ---------- */

/**
 * Bo tròn ('round') hoặc vát ('chamfer') các góc nhọn nằm giữa hai cạnh thẳng.
 * dist: khoảng cắt dọc mỗi cạnh (tự giới hạn ≤ 45% cạnh ngắn hơn). refs: chỉ xử lý các điểm này (mặc định: mọi góc).
 * Bo tròn dùng cung tròn chuẩn (tay nắm Bézier theo công thức 4/3·tan(φ/4)). Trả về số góc đã xử lý.
 */
export function cornerNodes(s: Shape, mode: 'round' | 'chamfer', dist: number, refs?: NodeRef[]): number {
  if (s.t !== 'path' || dist <= 0) return 0;
  const parts = localParts(s);
  let count = 0;
  parts.forEach((pt, pi) => pt.subs.forEach((sp, si) => {
    const N = sp.n.length, out: PNode[] = [];
    sp.n.forEach((n, ni) => {
      const want = !refs || refs.some((r) => r.pi === pi && r.si === si && r.ni === ni);
      const hasPrev = sp.c || ni > 0, hasNext = sp.c || ni < N - 1;
      const prev = sp.n[(ni - 1 + N) % N], next = sp.n[(ni + 1) % N];
      const straight = hasPrev && hasNext && !n.i && !n.o && !prev.o && !next.i;
      if (!want || !straight) { out.push(n); return; }
      const l1 = Math.hypot(prev.x - n.x, prev.y - n.y), l2 = Math.hypot(next.x - n.x, next.y - n.y);
      if (l1 < 1e-6 || l2 < 1e-6) { out.push(n); return; }
      const u1: XY = [(prev.x - n.x) / l1, (prev.y - n.y) / l1], u2: XY = [(next.x - n.x) / l2, (next.y - n.y) / l2];
      const theta = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))); // góc trong
      if (theta > Math.PI - 0.01) { out.push(n); return; } // gần như thẳng hàng: không có góc
      const c = Math.min(dist, l1 * 0.45, l2 * 0.45);
      const A: PNode = { x: n.x + u1[0] * c, y: n.y + u1[1] * c }, B: PNode = { x: n.x + u2[0] * c, y: n.y + u2[1] * c };
      if (mode === 'round') {
        const R = c * Math.tan(theta / 2), phi = Math.PI - theta, h = (4 / 3) * Math.tan(phi / 4) * R;
        A.o = [A.x - u1[0] * h, A.y - u1[1] * h];
        B.i = [B.x - u2[0] * h, B.y - u2[1] * h];
      }
      out.push(A, B); count++;
    });
    sp.n = out;
  }));
  if (count) store(s, parts);
  return count;
}
