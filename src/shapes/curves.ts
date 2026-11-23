import type { ShapeDef } from '../core/types';
import { curvePath, refitCurve } from '../core/curve';

const CAPS: [string, string][] = [['round', 'Tròn'], ['butt', 'Bằng'], ['arrow', 'Mũi tên'], ['dot', 'Chấm'], ['point', 'Nhọn']];
const bez = (p: Record<string, any>) => p.mode !== 'parabol';
const par = (p: Record<string, any>) => p.mode === 'parabol';

/**
 * Đường cong tự do (core/curve.ts). Chọn hình để kéo tay nắm ngay trên khung;
 * thanh trượt bên phải để tinh chỉnh.
 */
export const curveShapes: ShapeDef[] = [
  { type: 'curve',
    params: [
      { k: 'mode', l: 'Kiểu cong', type: 'select', def: 'bezier', opts: [['bezier', 'Bézier — chỉnh riêng hai đầu'], ['parabol', 'Parabol — một đỉnh']] },
      { k: 'a1', l: 'Hướng đầu (°)', min: -180, max: 180, step: 1, def: 50, show: bez },
      { k: 'k1', l: 'Độ cong đầu', min: 0, max: 2, step: 0.01, def: 0.4, show: bez },
      { k: 'a2', l: 'Hướng cuối (°)', min: -180, max: 180, step: 1, def: 50, show: bez },
      { k: 'k2', l: 'Độ cong cuối', min: 0, max: 2, step: 0.01, def: 0.4, show: bez },
      { k: 'h', l: 'Độ cao đỉnh', min: -1.5, max: 1.5, step: 0.01, def: 0.4, show: par },
      { k: 'sk', l: 'Vị trí đỉnh', min: -0.5, max: 1.5, step: 0.01, def: 0.5, show: par },
      { k: 'th', l: 'Độ dày nét', min: 1, max: 40, step: 1, def: 5 },
      { k: 'sa', l: 'Đầu mút đầu', type: 'select', def: 'round', opts: CAPS },
      { k: 'ea', l: 'Đầu mút cuối', type: 'select', def: 'round', opts: CAPS },
      { k: 'hs', l: 'Cỡ đầu mút', min: 0.5, max: 3, step: 0.05, def: 1 },
    ],
    scaleParams: ['th'],
    refit: refitCurve,
    parts: (w, h, p) => [{ d: curvePath(w, h, p) || 'M0 0 Z' }] },
];
