import type { ShapeDef } from '../core/types';
import { Pn, f } from '../core/geometry';

export const arrowShapes: ShapeDef[] = [
  { type: 'arrow', params: [
      { k: 'head', l: 'Độ dài đầu mũi tên', min: 0.1, max: 0.7, step: 0.01, def: 0.3 },
      { k: 'shaft', l: 'Độ dày thân', min: 0.08, max: 1, step: 0.01, def: 0.5 }],
    parts: (w, h, p) => {
      const s = p.shaft, hl = p.head * w, a = h * (1 - s) / 2, b = h * (1 + s) / 2;
      return [{ d: `M0 ${f(a)} L${f(w - hl)} ${f(a)} L${f(w - hl)} 0 L${f(w)} ${f(h / 2)} L${f(w - hl)} ${f(h)} L${f(w - hl)} ${f(b)} L0 ${f(b)} Z` }];
    } },
  { type: 'dblarrow', params: [
      { k: 'head', l: 'Độ dài đầu mũi tên', min: 0.1, max: 0.4, step: 0.01, def: 0.22 },
      { k: 'shaft', l: 'Độ dày thân', min: 0.08, max: 1, step: 0.01, def: 0.5 }],
    parts: (w, h, p) => {
      const s = p.shaft, hl = p.head * w, a = h * (1 - s) / 2, b = h * (1 + s) / 2;
      return [{ d: `M0 ${f(h / 2)} L${f(hl)} 0 L${f(hl)} ${f(a)} L${f(w - hl)} ${f(a)} L${f(w - hl)} 0 L${f(w)} ${f(h / 2)} L${f(w - hl)} ${f(h)} L${f(w - hl)} ${f(b)} L${f(hl)} ${f(b)} L${f(hl)} ${f(h)} Z` }];
    } },
  { type: 'chevron', params: [{ k: 't', l: 'Độ sâu mũi', min: 0.1, max: 0.8, step: 0.01, def: 0.35 }],
    parts: (w, h, p) => [{ d: Pn(w, h, [[0, 0], [1 - p.t, 0], [1, 0.5], [1 - p.t, 1], [0, 1], [p.t, 0.5]]) }] },
  { type: 'homeplate', params: [{ k: 't', l: 'Độ sâu mũi', min: 0.1, max: 0.8, step: 0.01, def: 0.3 }],
    parts: (w, h, p) => [{ d: Pn(w, h, [[0, 0], [1 - p.t, 0], [1, 0.5], [1 - p.t, 1], [0, 1]]) }] },
  { type: 'bent', params: [{ k: 'shaft', l: 'Độ dày thân', min: 0.08, max: 0.45, step: 0.01, def: 0.2 }],
    parts: (w, h, p) => {
      const m = Math.min(w, h), t = p.shaft * m, hw = Math.min(t * 2.4, h * 0.9), hl = Math.min(t * 1.8, w * 0.5), c = hw / 2;
      return [{ d: `M0 ${f(h)} L0 ${f(c - t / 2)} L${f(w - hl)} ${f(c - t / 2)} L${f(w - hl)} 0 L${f(w)} ${f(c)} L${f(w - hl)} ${f(hw)} L${f(w - hl)} ${f(c + t / 2)} L${f(t)} ${f(c + t / 2)} L${f(t)} ${f(h)} Z` }];
    } },
];
