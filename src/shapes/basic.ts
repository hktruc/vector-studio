import type { ShapeDef } from '../core/types';
import { Pn, ngonD, rrect, starD } from '../core/geometry';

export const basicShapes: ShapeDef[] = [
  { type: 'rrect', params: [{ k: 'r', l: 'Bo góc', min: 0, max: 0.5, step: 0.01, def: 0 }],
    parts: (w, h, p) => [{ d: rrect(w, h, p.r) }] },
  { type: 'tri', params: [{ k: 'apex', l: 'Vị trí đỉnh', min: 0, max: 1, step: 0.01, def: 0.5 }],
    parts: (w, h, p) => [{ d: Pn(w, h, [[p.apex, 0], [1, 1], [0, 1]]) }] },
  { type: 'rtri', params: [], parts: (w, h) => [{ d: Pn(w, h, [[0, 0], [1, 1], [0, 1]]) }] },
  { type: 'diamond', params: [], parts: (w, h) => [{ d: Pn(w, h, [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]) }] },
  { type: 'trap', params: [{ k: 'inset', l: 'Độ thu hẹp', min: 0, max: 0.45, step: 0.01, def: 0.2 }],
    parts: (w, h, p) => [{ d: Pn(w, h, [[p.inset, 0], [1 - p.inset, 0], [1, 1], [0, 1]]) }] },
  { type: 'para', params: [{ k: 'skew', l: 'Độ nghiêng', min: 0, max: 0.45, step: 0.01, def: 0.2 }],
    parts: (w, h, p) => [{ d: Pn(w, h, [[p.skew, 0], [1, 0], [1 - p.skew, 1], [0, 1]]) }] },
  { type: 'ngon', params: [{ k: 'n', l: 'Số cạnh', min: 3, max: 12, step: 1, def: 6 }],
    parts: (w, h, p) => [{ d: ngonD(p.n, w, h, p.n % 2 ? -90 : -90 + 180 / p.n) }] },
  { type: 'star', params: [
      { k: 'n', l: 'Số cánh', min: 3, max: 12, step: 1, def: 5 },
      { k: 'inner', l: 'Độ nhọn', min: 0.15, max: 0.9, step: 0.01, def: 0.45 }],
    parts: (w, h, p) => [{ d: starD(p.n, p.inner, w, h) }] },
  { type: 'plus', params: [{ k: 't', l: 'Độ dày', min: 0.1, max: 0.8, step: 0.01, def: 0.34 }],
    parts: (w, h, p) => {
      const a = (1 - p.t) / 2;
      return [{ d: Pn(w, h, [[a, 0], [1 - a, 0], [1 - a, a], [1, a], [1, 1 - a], [1 - a, 1 - a], [1 - a, 1], [a, 1], [a, 1 - a], [0, 1 - a], [0, a], [a, a]]) }];
    } },
];
