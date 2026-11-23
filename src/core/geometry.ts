import type { Part } from './types';

export const rad = (d: number) => (d * Math.PI) / 180;
export const f = (n: number) => Math.round(n * 100) / 100;
export type Pt = [number, number];

/** Đa giác từ các điểm chuẩn hóa 0..1 */
export const Pn = (w: number, h: number, pts: Pt[]) =>
  'M' + pts.map((p) => f(p[0] * w) + ' ' + f(p[1] * h)).join(' L') + ' Z';

export function rrect(w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r * Math.min(w, h), w / 2, h / 2));
  if (r < 0.01) return `M0 0 H${f(w)} V${f(h)} H0 Z`;
  return `M${f(r)} 0 H${f(w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)} V${f(h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)} H${f(r)} A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)} V${f(r)} A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0 Z`;
}

export function ellipseD(cx: number, cy: number, rx: number, ry: number) {
  return `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 1 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 1 ${f(cx - rx)} ${f(cy)} Z`;
}

/** Điểm trên elip: góc đo theo chiều kim đồng hồ từ 12 giờ, k = tỉ lệ bán kính. */
export function polar(w: number, h: number) {
  const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
  return (a: number, k: number): Pt => [cx + rx * k * Math.sin(rad(a)), cy - ry * k * Math.cos(rad(a))];
}

/** Hình quạt / vành khuyên / hình tròn. */
export function pieD(w: number, h: number, start: number, sweep: number, hole: number) {
  const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2, pt = polar(w, h);
  if (sweep >= 359.5) {
    let d = ellipseD(cx, cy, rx, ry);
    if (hole > 0.001) d += ' ' + ellipseD(cx, cy, rx * hole, ry * hole);
    return d;
  }
  const a0 = start, a1 = start + sweep, p0 = pt(a0, 1), p1 = pt(a1, 1), lg = sweep > 180 ? 1 : 0;
  if (hole <= 0.001)
    return `M${f(cx)} ${f(cy)} L${f(p0[0])} ${f(p0[1])} A${f(rx)} ${f(ry)} 0 ${lg} 1 ${f(p1[0])} ${f(p1[1])} Z`;
  const q0 = pt(a0, hole), q1 = pt(a1, hole);
  return `M${f(p0[0])} ${f(p0[1])} A${f(rx)} ${f(ry)} 0 ${lg} 1 ${f(p1[0])} ${f(p1[1])} L${f(q1[0])} ${f(q1[1])} A${f(rx * hole)} ${f(ry * hole)} 0 ${lg} 0 ${f(q0[0])} ${f(q0[1])} Z`;
}

export function ngonD(n: number, w: number, h: number, rot: number) {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = rad(rot + (i * 360) / n);
    pts.push([0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]);
  }
  return Pn(w, h, pts);
}

export function starD(n: number, inner: number, w: number, h: number) {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner * 0.5 : 0.5, a = rad(-90 + (i * 180) / n);
    pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
  }
  return Pn(w, h, pts);
}

/** Các tầng xếp chồng (kim tự tháp, phễu). Độ rộng tính theo tỉ lệ w tại y=0 và y=h. */
export function tiers(w: number, h: number, N: number, gap: number, wTop: number, wBot: number, shadeTop: number, shadeBot: number): Part[] {
  const out: Part[] = [], th = h / N, g = gap * h;
  for (let i = 0; i < N; i++) {
    const y0 = i * th + (i > 0 ? g / 2 : 0), y1 = (i + 1) * th - (i < N - 1 ? g / 2 : 0);
    const hw = (y: number) => (w * (wTop + (wBot - wTop) * (y / h))) / 2;
    const pts: Pt[] = [[w / 2 - hw(y0), y0], [w / 2 + hw(y0), y0], [w / 2 + hw(y1), y1], [w / 2 - hw(y1), y1]];
    out.push({
      d: 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L') + ' Z',
      shade: shadeTop + (shadeBot - shadeTop) * (N < 2 ? 0 : i / (N - 1)),
    });
  }
  return out;
}
