import type { ShapeDef } from '../core/types';
import { ellipseD, f, rrect, tiers } from '../core/geometry';
import type { HandleDef } from '../core/types';

/** Kéo ranh giới tầng đầu tiên lên/xuống để thêm/bớt tầng. */
const tierHandle: HandleDef = { tip: 'Kéo lên/xuống để thêm/bớt tầng', pos: (w, h, p) => [w / 2, h / p.n], drag: (_w, h, _p, _x, y) => ({ n: h / Math.max(1, y) }) };

export const blockShapes: ShapeDef[] = [
  { type: 'cube', params: [{ k: 'depth', l: 'Độ sâu khối', min: 0.08, max: 0.5, step: 0.01, def: 0.25 }],
    handles: [{ tip: 'Kéo để đổi độ sâu khối', pos: (w, h, p) => { const d = p.depth * Math.min(w, h); return [w - d, d]; }, drag: (w, h, _p, x, y) => ({ depth: (w - x + y) / 2 / Math.min(w, h) }) }],
    parts: (w, h, p) => {
      const d = p.depth * Math.min(w, h);
      return [
        { d: `M0 ${f(d)} L${f(w - d)} ${f(d)} L${f(w - d)} ${f(h)} L0 ${f(h)} Z`, shade: 0 },
        { d: `M0 ${f(d)} L${f(d)} 0 L${f(w)} 0 L${f(w - d)} ${f(d)} Z`, shade: 0.28 },
        { d: `M${f(w - d)} ${f(d)} L${f(w)} 0 L${f(w)} ${f(h - d)} L${f(w - d)} ${f(h)} Z`, shade: -0.22 },
      ];
    } },
  { type: 'cyl', params: [{ k: 'cap', l: 'Độ phẳng nắp', min: 0.08, max: 0.4, step: 0.01, def: 0.18 }],
    handles: [{ tip: 'Kéo dọc để đổi độ phẳng nắp', pos: (w, h, p) => [w / 2, 2 * Math.min(p.cap * h, h / 2.2)], drag: (_w, h, _p, _x, y) => ({ cap: y / 2 / h }) }],
    parts: (w, h, p) => {
      const r = Math.min(p.cap * h, h / 2.2);
      return [
        { d: `M0 ${f(r)} L0 ${f(h - r)} A${f(w / 2)} ${f(r)} 0 0 0 ${f(w)} ${f(h - r)} L${f(w)} ${f(r)} A${f(w / 2)} ${f(r)} 0 0 0 0 ${f(r)} Z`, shade: 0 },
        { d: ellipseD(w / 2, r, w / 2, r), shade: 0.28 },
      ];
    } },
  { type: 'callout', params: [
      { k: 'r', l: 'Bo góc', min: 0, max: 0.4, step: 0.01, def: 0.15 },
      { k: 'tail', l: 'Vị trí đuôi', min: 0.05, max: 0.8, step: 0.01, def: 0.18 }],
    handles: [
      { tip: 'Kéo ngang để dời đuôi bong bóng', pos: (w, h, p) => [p.tail * w - w * 0.03, h], drag: (w, _h, _p, x) => ({ tail: (x + w * 0.03) / w }) },
      { tip: 'Kéo ngang để bo tròn góc', pos: (w, h, p) => { const m = Math.min(w, h * 0.78); return [(p.r + 0.08) * m, 0.08 * m]; }, drag: (w, h, _p, x) => ({ r: x / Math.min(w, h * 0.78) - 0.08 }) },
    ],
    parts: (w, h, p) => {
      const bh = h * 0.78, t = p.tail * w;
      return [{ d: rrect(w, bh, p.r) + ` M${f(t)} ${f(bh - 2)} L${f(t + w * 0.24)} ${f(bh - 2)} L${f(t - w * 0.03)} ${f(h)} Z` }];
    } },
  { type: 'pyramid', params: [
      { k: 'n', l: 'Số tầng', min: 1, max: 8, step: 1, def: 4 },
      { k: 'gap', l: 'Khe giữa các tầng', min: 0, max: 0.06, step: 0.005, def: 0.02 }],
    handles: [tierHandle],
    parts: (w, h, p) => tiers(w, h, p.n, p.n > 1 ? p.gap : 0, 0, 1, 0.3, -0.15) },
  { type: 'funnel', params: [
      { k: 'n', l: 'Số tầng', min: 1, max: 8, step: 1, def: 4 },
      { k: 'gap', l: 'Khe giữa các tầng', min: 0, max: 0.06, step: 0.005, def: 0.02 },
      { k: 'neck', l: 'Độ hẹp cuối', min: 0.1, max: 0.8, step: 0.01, def: 0.35 }],
    handles: [tierHandle, { tip: 'Kéo ngang để đổi độ hẹp đáy phễu', pos: (w, h, p) => [w / 2 + (p.neck * w) / 2, h * 0.94], drag: (w, _h, _p, x) => ({ neck: (2 * x) / w - 1 }) }],
    parts: (w, h, p) => tiers(w, h, p.n, p.n > 1 ? p.gap : 0, 1, p.neck, 0.3, -0.15) },
  { type: 'steps', params: [{ k: 'n', l: 'Số bậc', min: 2, max: 10, step: 1, def: 4 }],
    handles: [{ tip: 'Kéo ngang để thêm/bớt bậc', pos: (w, h, p) => [w / p.n, h * (1 - 1 / p.n)], drag: (w, _h, _p, x) => ({ n: w / Math.max(1, x) }) }],
    parts: (w, h, p) => {
      let d = `M0 ${f(h)}`;
      for (let i = 0; i < p.n; i++) {
        const x = (i * w) / p.n, y = h * (1 - (i + 1) / p.n);
        d += ` L${f(x)} ${f(y)} L${f(((i + 1) * w) / p.n)} ${f(y)}`;
      }
      return [{ d: d + ` L${f(w)} ${f(h)} Z` }];
    } },
];
