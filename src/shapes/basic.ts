import type { ShapeDef } from '../core/types';
import { radiusOf } from '../core/handles';
import { Pn, ngonD, rrect, starD } from '../core/geometry';

export const basicShapes: ShapeDef[] = [
  { type: 'rrect', params: [{ k: 'r', l: 'Bo góc', min: 0, max: 0.5, step: 0.01, def: 0 }],
    handles: [{ tip: 'Kéo ngang để bo tròn góc', pos: (w, h, p) => { const m = Math.min(w, h); return [(p.r + 0.08) * m, 0.08 * m]; }, drag: (w, h, _p, x) => ({ r: x / Math.min(w, h) - 0.08 }) }],
    parts: (w, h, p) => [{ d: rrect(w, h, p.r) }] },
  { type: 'tri', params: [{ k: 'apex', l: 'Vị trí đỉnh', min: 0, max: 1, step: 0.01, def: 0.5 }],
    handles: [{ tip: 'Kéo ngang để dời đỉnh', pos: (w, h, p) => [p.apex * w, h * 0.14], drag: (w, _h, _p, x) => ({ apex: x / w }) }],
    parts: (w, h, p) => [{ d: Pn(w, h, [[p.apex, 0], [1, 1], [0, 1]]) }] },
  { type: 'rtri', params: [], parts: (w, h) => [{ d: Pn(w, h, [[0, 0], [1, 1], [0, 1]]) }] },
  { type: 'diamond', params: [], parts: (w, h) => [{ d: Pn(w, h, [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) }] },
  { type: 'trap', params: [{ k: 'inset', l: 'Độ thu hẹp', min: 0, max: 0.45, step: 0.01, def: 0.2 }],
    handles: [{ tip: 'Kéo ngang để thu hẹp cạnh trên', pos: (w, h, p) => [p.inset * w + 0.06 * w, h * 0.14], drag: (w, _h, _p, x) => ({ inset: x / w - 0.06 }) }],
    parts: (w, h, p) => [{ d: Pn(w, h, [[p.inset, 0], [1 - p.inset, 0], [1, 1], [0, 1]]) }] },
  { type: 'para', params: [{ k: 'skew', l: 'Độ nghiêng', min: 0, max: 0.45, step: 0.01, def: 0.2 }],
    handles: [{ tip: 'Kéo ngang để đổi độ nghiêng', pos: (w, h, p) => [p.skew * w + 0.06 * w, h * 0.14], drag: (w, _h, _p, x) => ({ skew: x / w - 0.06 }) }],
    parts: (w, h, p) => [{ d: Pn(w, h, [[p.skew, 0], [1, 0], [1 - p.skew, 1], [0, 1]]) }] },
  { type: 'ngon', params: [{ k: 'n', l: 'Số cạnh', min: 3, max: 12, step: 1, def: 6 }],
    parts: (w, h, p) => [{ d: ngonD(p.n, w, h, p.n % 2 ? -90 : -90 + 180 / p.n) }] },
  { type: 'star', params: [
      { k: 'n', l: 'Số cánh', min: 3, max: 12, step: 1, def: 5 },
      { k: 'inner', l: 'Độ nhọn', min: 0.15, max: 0.9, step: 0.01, def: 0.45 }],
    handles: [{ tip: 'Kéo vào/ra để đổi độ nhọn cánh sao',
      pos: (w, h, p) => { const a = ((-90 + 180 / p.n) * Math.PI) / 180, r = p.inner * 0.5; return [(0.5 + r * Math.cos(a)) * w, (0.5 + r * Math.sin(a)) * h]; },
      drag: (w, h, _p, x, y) => ({ inner: radiusOf(w, h, x, y) }) }],
    parts: (w, h, p) => [{ d: starD(p.n, p.inner, w, h) }] },
  { type: 'plus', params: [{ k: 't', l: 'Độ dày', min: 0.1, max: 0.8, step: 0.01, def: 0.34 }],
    handles: [{ tip: 'Kéo để đổi độ dày nét cộng', pos: (w, h, p) => [((1 - p.t) / 2) * w, ((1 - p.t) / 2) * h], drag: (w, h, _p, x, y) => ({ t: 1 - (x / w + y / h) }) }],
    parts: (w, h, p) => {
      const a = (1 - p.t) / 2;
      return [{ d: Pn(w, h, [[a, 0], [1 - a, 0], [1 - a, a], [1, a], [1, 1 - a], [1 - a, 1 - a], [1 - a, 1], [a, 1], [a, 1 - a], [0, 1 - a], [0, a], [a, a]]) }];
    } },
];
