import type { Shape } from './types';
import { rad } from './geometry';
import { strokeOutline, type Cap, type XY } from './connect';
import { toLocal, toWorldPt } from './transform';
export { toLocal, toWorldPt };

/**
 * Đường cong tự do (Bézier bậc ba hoặc parabol) với đầu mút tùy chỉnh. Thuần dữ liệu.
 *
 * Thông số (Shape.p):
 *  - x0, y0, x1, y1: hai đầu mút, theo tỉ lệ 0..1 của khung hình (nên đổi cỡ khung là đường cong co giãn theo).
 *  - mode 'bezier': a1/k1 = hướng (độ) và độ dài tay nắm đầu, a2/k2 = của cuối — chỉnh hai đầu độc lập.
 *    Góc tính so với dây cung (đoạn thẳng nối hai đầu): 0 = dọc theo dây cung, dương = lệch về phía "trên" dây cung.
 *    Độ dài tính theo tỉ lệ độ dài dây cung. Vì vậy kéo một đầu đi thì đường cong vẫn giữ dáng.
 *    a1 = a2 cho đường vòm cân đối; a1 = −a2 cho đường chữ S.
 *  - mode 'parabol': h = độ cao đỉnh (tỉ lệ dây cung, âm = cong xuống), sk = vị trí đỉnh dọc dây cung (0..1).
 *  - th độ dày nét, sa/ea đầu mút đầu/cuối, hs cỡ đầu mút.
 */

export type CurveKey = 'p0' | 'p3' | 'c1' | 'c2' | 'q';

/** Hướng dây cung (u) và pháp tuyến phía "trên" (n) trong hệ y hướng xuống. */
function frame(P0: XY, P3: XY) {
  const dx = P3[0] - P0[0], dy = P3[1] - P0[1], L = Math.hypot(dx, dy) || 1;
  const u: XY = [dx / L, dy / L], n: XY = [u[1], -u[0]];
  return { L, u, n };
}

/** Bốn điểm điều khiển Bézier bậc ba (tọa độ riêng của khung, đơn vị điểm ảnh) + đỉnh Q nếu là parabol. */
export function curveControls(w: number, h: number, p: Record<string, any>): { P0: XY; C1: XY; C2: XY; P3: XY; Q?: XY } {
  const P0: XY = [(p.x0 ?? 0.05) * w, (p.y0 ?? 0.8) * h], P3: XY = [(p.x1 ?? 0.95) * w, (p.y1 ?? 0.2) * h];
  const { L, u, n } = frame(P0, P3);
  if (p.mode === 'parabol') {
    // parabol = Bézier bậc hai với điểm điều khiển Q; đỉnh cao bằng nửa khoảng cách từ Q tới dây cung
    const sk = p.sk ?? 0.5, hh = (p.h ?? 0.4) * L * 2;
    const Q: XY = [P0[0] + u[0] * sk * L + n[0] * hh, P0[1] + u[1] * sk * L + n[1] * hh];
    const C1: XY = [P0[0] + (2 / 3) * (Q[0] - P0[0]), P0[1] + (2 / 3) * (Q[1] - P0[1])];
    const C2: XY = [P3[0] + (2 / 3) * (Q[0] - P3[0]), P3[1] + (2 / 3) * (Q[1] - P3[1])];
    return { P0, C1, C2, P3, Q };
  }
  const a1 = rad(p.a1 ?? 50), a2 = rad(p.a2 ?? 50), l1 = (p.k1 ?? 0.4) * L, l2 = (p.k2 ?? 0.4) * L;
  const C1: XY = [P0[0] + l1 * (Math.cos(a1) * u[0] + Math.sin(a1) * n[0]), P0[1] + l1 * (Math.cos(a1) * u[1] + Math.sin(a1) * n[1])];
  const C2: XY = [P3[0] + l2 * (-Math.cos(a2) * u[0] + Math.sin(a2) * n[0]), P3[1] + l2 * (-Math.cos(a2) * u[1] + Math.sin(a2) * n[1])];
  return { P0, C1, C2, P3 };
}

/** Lấy mẫu đường cong thành các điểm (đủ mịn để vẽ thành hình đặc). */
export function sampleCurve(c: { P0: XY; C1: XY; C2: XY; P3: XY }, n = 48): XY[] {
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, v = 1 - t, a = v * v * v, b = 3 * v * v * t, d = 3 * v * t * t, e = t * t * t;
    out.push([a * c.P0[0] + b * c.C1[0] + d * c.C2[0] + e * c.P3[0], a * c.P0[1] + b * c.C1[1] + d * c.C2[1] + e * c.P3[1]]);
  }
  return out;
}

/** Hình đặc của đường cong (dùng trong ShapeDef.parts). */
export function curvePath(w: number, h: number, p: Record<string, any>): string {
  return strokeOutline(sampleCurve(curveControls(w, h, p)), p.th ?? 4, (p.sa ?? 'round') as Cap, (p.ea ?? 'round') as Cap, p.hs ?? 1);
}

/** Lề cần chừa quanh đường cong để nét dày và đầu mút không tràn ra ngoài khung. */
export const curvePad = (p: Record<string, any>) => Math.max(10, (p.th ?? 4) * 3.5) * (p.hs ?? 1) * 0.7 + (p.th ?? 4) + 2;

/** Vị trí các tay nắm trên khung (tọa độ trang) để vẽ và kéo. */
export function curveHandles(s: Shape): Partial<Record<CurveKey, XY>> {
  const c = curveControls(s.w, s.h, s.p), W = (q: XY) => toWorldPt(s, q[0], q[1]);
  return s.p.mode === 'parabol' ? { p0: W(c.P0), p3: W(c.P3), q: W(c.Q!) } : { p0: W(c.P0), p3: W(c.P3), c1: W(c.C1), c2: W(c.C2) };
}

/**
 * Co khung hình ôm sát đường cong (cộng lề), giữ nguyên vị trí đường cong trên trang.
 * Gọi sau mỗi lần đổi thông số hoặc kéo tay nắm.
 */
export function refitCurve(s: Shape) {
  if (s.w < 1e-6 || s.h < 1e-6) return;
  const c = curveControls(s.w, s.h, s.p), pad = curvePad(s.p);
  // khung ôm sát theo đường thật (lấy mẫu), không theo tay nắm, để không quá rộng khi tay nắm dài
  const samp = sampleCurve(c, 32);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of samp) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const nw = x1 - x0, nh = y1 - y0;
  if (Math.abs(x0) < 0.01 && Math.abs(y0) < 0.01 && Math.abs(nw - s.w) < 0.01 && Math.abs(nh - s.h) < 0.01) return;
  const P0 = c.P0, P3 = c.P3;
  const [cx, cy] = toWorldPt(s, (x0 + x1) / 2, (y0 + y1) / 2);
  s.p = { ...s.p, x0: (P0[0] - x0) / nw, y0: (P0[1] - y0) / nh, x1: (P3[0] - x0) / nw, y1: (P3[1] - y0) / nh };
  s.x = cx; s.y = cy; s.w = nw; s.h = nh;
}

/**
 * Kéo một tay nắm tới điểm (x, y) trên trang:
 * p0/p3 dời đầu mút (tay nắm đi theo, giữ dáng); c1/c2 đổi hướng + độ cong từng đầu; q đổi đỉnh parabol.
 */
export function setCurveHandle(s: Shape, key: CurveKey, x: number, y: number) {
  const [lx, ly] = toLocal(s, x, y), c = curveControls(s.w, s.h, s.p);
  const p = { ...s.p };
  if (key === 'p0') { p.x0 = lx / s.w; p.y0 = ly / s.h; }
  else if (key === 'p3') { p.x1 = lx / s.w; p.y1 = ly / s.h; }
  else {
    const { L, u, n } = frame(c.P0, c.P3);
    if (key === 'q') {
      const vx = lx - c.P0[0], vy = ly - c.P0[1];
      p.sk = Math.round(Math.max(-0.5, Math.min(1.5, (vx * u[0] + vy * u[1]) / L)) * 100) / 100;
      p.h = Math.round(Math.max(-1.5, Math.min(1.5, (vx * n[0] + vy * n[1]) / L / 2)) * 100) / 100;
    } else {
      const base = key === 'c1' ? c.P0 : c.P3, vx = lx - base[0], vy = ly - base[1];
      const along = vx * u[0] + vy * u[1], side = vx * n[0] + vy * n[1];
      const k = Math.round(Math.min(2, Math.hypot(vx, vy) / L) * 100) / 100;
      const a = Math.round((Math.atan2(side, key === 'c1' ? along : -along) * 180) / Math.PI);
      if (key === 'c1') { p.a1 = a; p.k1 = k; } else { p.a2 = a; p.k2 = k; }
    }
  }
  s.p = p;
  refitCurve(s);
}

/** Đặt đường cong đi đúng từ điểm A tới điểm B trên trang (dùng khi vẽ bằng kéo). */
export function placeCurve(s: Shape, a: { x: number; y: number }, b: { x: number; y: number }) {
  setCurveHandle(s, 'p0', a.x, a.y);
  setCurveHandle(s, 'p3', b.x, b.y);
}
