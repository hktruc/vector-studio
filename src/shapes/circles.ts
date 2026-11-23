import type { ShapeDef } from '../core/types';
import { f, pieD, polar } from '../core/geometry';

export const circleShapes: ShapeDef[] = [
  { type: 'pie', params: [
      { k: 'start', l: 'Góc bắt đầu (°)', min: 0, max: 359, step: 1, def: 0 },
      { k: 'sweep', l: 'Độ rộng cung (°)', min: 5, max: 360, step: 1, def: 360 },
      { k: 'hole', l: 'Lỗ giữa (vành khuyên)', min: 0, max: 0.9, step: 0.01, def: 0 }],
    parts: (w, h, p) => [{ d: pieD(w, h, p.start, p.sweep, p.hole), rule: 'evenodd' }] },
  { type: 'circarrow', params: [
      { k: 'start', l: 'Góc bắt đầu (°)', min: 0, max: 359, step: 1, def: 300 },
      { k: 'sweep', l: 'Độ rộng cung (°)', min: 60, max: 340, step: 1, def: 260 },
      { k: 'thick', l: 'Độ dày vòng', min: 0.1, max: 0.6, step: 0.01, def: 0.3 },
      { k: 'head', l: 'Độ dài đầu (°)', min: 12, max: 60, step: 1, def: 30 }],
    parts: (w, h, p) => {
      const pt = polar(w, h), ext = 0.08, ro = 1 - ext, ri = ro * (1 - p.thick), rm = (ro + ri) / 2;
      const a0 = p.start, a1 = p.start + p.sweep, ab = a1 - Math.min(p.head, p.sweep - 10), lg = ab - a0 > 180 ? 1 : 0;
      const A = pt(a0, ro), B = pt(ab, ro), C = pt(ab, 1), T = pt(a1, rm), D = pt(ab, ri - ext), E = pt(ab, ri), F = pt(a0, ri);
      const X = (q: [number, number]) => `${f(q[0])} ${f(q[1])}`;
      return [{ d: `M${X(A)} A${f((w / 2) * ro)} ${f((h / 2) * ro)} 0 ${lg} 1 ${X(B)} L${X(C)} L${X(T)} L${X(D)} L${X(E)} A${f((w / 2) * ri)} ${f((h / 2) * ri)} 0 ${lg} 0 ${X(F)} Z` }];
    } },
];
