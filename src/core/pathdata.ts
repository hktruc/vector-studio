/**
 * Đọc/ghi dữ liệu đường (thuộc tính `d` của SVG) dưới dạng điểm neo có tay nắm. Thuần dữ liệu.
 *
 * Điểm neo (PNode): x, y; i = tay nắm vào, o = tay nắm ra (nếu có thì đoạn là Bézier, không có thì là đoạn thẳng);
 * s = 1 nếu là điểm trơn (hai tay nắm thẳng hàng). Một đường con (SubPath) là danh sách điểm neo + cờ khép kín.
 */

export type XY = [number, number];
export interface PNode { x: number; y: number; i?: XY; o?: XY; s?: 1 }
export interface SubPath { n: PNode[]; c: boolean }

const r2 = (v: number) => Math.round(v * 1000) / 1000;

/** Đổi một cung elip của SVG (A) thành các đoạn Bézier bậc ba (mỗi đoạn ≤ 90°). */
export function arcToCubics(x1: number, y1: number, rx: number, ry: number, phi: number, large: number, sweep: number, x2: number, y2: number): [XY, XY, XY][] {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[[x1, y1], [x2, y2], [x2, y2]]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const cp = Math.cos((phi * Math.PI) / 180), sp = Math.sin((phi * Math.PI) / 180);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9)), d = dt / segs, k = (4 / 3) * Math.tan(d / 4);
  const pt = (t: number): XY => [cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp];
  const der = (t: number): XY => [-rx * Math.sin(t) * cp - ry * Math.cos(t) * sp, -rx * Math.sin(t) * sp + ry * Math.cos(t) * cp];
  const out: [XY, XY, XY][] = [];
  for (let i = 0; i < segs; i++) {
    const a = t1 + i * d, b = a + d, pa = pt(a), pb = pt(b), da = der(a), db = der(b);
    out.push([[pa[0] + k * da[0], pa[1] + k * da[1]], [pb[0] - k * db[0], pb[1] - k * db[1]], pb]);
  }
  out[out.length - 1][2] = [x2, y2]; // khớp đúng điểm cuối
  return out;
}

/** Đọc chuỗi `d` (M L H V C S Q T A Z, hoa và thường) thành các đường con. */
export function parsePath(d: string): SubPath[] {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const subs: SubPath[] = [];
  let cur: SubPath | null = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0;
  let lastC: XY | null = null, lastQ: XY | null = null;
  const num = () => parseFloat(toks[i++]);
  const isNum = () => i < toks.length && !/^[a-zA-Z]$/.test(toks[i]);
  const last = () => cur!.n[cur!.n.length - 1];
  const lineTo = (nx: number, ny: number) => { cur!.n.push({ x: nx, y: ny }); x = nx; y = ny; };
  const cubicTo = (c1: XY, c2: XY, nx: number, ny: number) => { last().o = c1; cur!.n.push({ x: nx, y: ny, i: c2 }); x = nx; y = ny; lastC = c2; };
  while (i < toks.length) {
    if (!isNum()) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { if (cur) { cur.c = true; x = sx; y = sy; } lastC = lastQ = null; continue; }
    if (!isNum()) continue;
    if (C === 'M') {
      x = ox + num(); y = oy + num(); sx = x; sy = y;
      cur = { n: [{ x, y }], c: false }; subs.push(cur);
      cmd = rel ? 'l' : 'L'; lastC = lastQ = null; continue;
    }
    if (!cur) { cur = { n: [{ x, y }], c: false }; subs.push(cur); }
    if (C === 'L') { lineTo(ox + num(), oy + num()); lastC = lastQ = null; }
    else if (C === 'H') { lineTo(ox + num(), y); lastC = lastQ = null; }
    else if (C === 'V') { lineTo(x, oy + num()); lastC = lastQ = null; }
    else if (C === 'C') { const c1: XY = [ox + num(), oy + num()], c2: XY = [ox + num(), oy + num()]; cubicTo(c1, c2, ox + num(), oy + num()); lastQ = null; }
    else if (C === 'S') { const c1: XY = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y]; const c2: XY = [ox + num(), oy + num()]; cubicTo(c1, c2, ox + num(), oy + num()); lastQ = null; }
    else if (C === 'Q' || C === 'T') {
      const q: XY = C === 'Q' ? [ox + num(), oy + num()] : lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
      const nx = ox + num(), ny = oy + num();
      cubicTo([x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y)], [nx + (2 / 3) * (q[0] - nx), ny + (2 / 3) * (q[1] - ny)], nx, ny);
      lastQ = q; lastC = null;
    } else if (C === 'A') {
      const rx = num(), ry = num(), rot = num(), la = num(), sw = num(), nx = ox + num(), ny = oy + num();
      for (const [c1, c2, e] of arcToCubics(x, y, rx, ry, rot, la, sw, nx, ny)) cubicTo(c1, c2, e[0], e[1]);
      lastC = lastQ = null;
    } else i++; // lệnh lạ: bỏ qua số
  }
  // đường khép kín mà điểm cuối trùng điểm đầu: gộp lại thành một điểm neo
  for (const s of subs) {
    const a = s.n[0], b = s.n[s.n.length - 1];
    if (s.c && s.n.length > 1 && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) { if (b.i) a.i = b.i; s.n.pop(); }
  }
  return subs.filter((s) => s.n.length > 1 || s.n.some((n) => n.o));
}

/** Ghi các đường con thành chuỗi `d`. Tọa độ nhân với (sx, sy) — dùng khi lưu theo tỉ lệ khung. */
export function pathToD(subs: SubPath[], sx = 1, sy = 1): string {
  const P = (x: number, y: number) => `${r2(x * sx)} ${r2(y * sy)}`;
  const seg = (a: PNode, b: PNode) => (a.o || b.i ? `C${P(...(a.o ?? [a.x, a.y]))} ${P(...(b.i ?? [b.x, b.y]))} ${P(b.x, b.y)}` : `L${P(b.x, b.y)}`);
  return subs.map((s) => {
    let d = `M${P(s.n[0].x, s.n[0].y)}`;
    for (let k = 1; k < s.n.length; k++) d += ' ' + seg(s.n[k - 1], s.n[k]);
    if (s.c) { const a = s.n[s.n.length - 1], b = s.n[0]; if (a.o || b.i) d += ' ' + seg(a, b); d += ' Z'; }
    return d;
  }).join(' ');
}

/** Bốn điểm điều khiển của đoạn thứ k trong đường con (đoạn cuối của đường khép kín nối về điểm đầu). */
export function segment(s: SubPath, k: number): [XY, XY, XY, XY] {
  const a = s.n[k], b = s.n[(k + 1) % s.n.length];
  return [[a.x, a.y], a.o ?? [a.x, a.y], b.i ?? [b.x, b.y], [b.x, b.y]];
}
export const segmentCount = (s: SubPath) => (s.c ? s.n.length : s.n.length - 1);

/** Điểm trên Bézier bậc ba tại t. */
export function bezierAt(q: [XY, XY, XY, XY], t: number): XY {
  const v = 1 - t, a = v * v * v, b = 3 * v * v * t, c = 3 * v * t * t, e = t * t * t;
  return [a * q[0][0] + b * q[1][0] + c * q[2][0] + e * q[3][0], a * q[0][1] + b * q[1][1] + c * q[2][1] + e * q[3][1]];
}

/** Chia đôi Bézier tại t (de Casteljau): trả về hai nửa. */
export function splitBezier(q: [XY, XY, XY, XY], t: number): [[XY, XY, XY, XY], [XY, XY, XY, XY]] {
  const L = (a: XY, b: XY): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const p01 = L(q[0], q[1]), p12 = L(q[1], q[2]), p23 = L(q[2], q[3]), a = L(p01, p12), b = L(p12, p23), m = L(a, b);
  return [[q[0], p01, a, m], [m, b, p23, q[3]]];
}
