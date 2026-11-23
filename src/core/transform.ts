import type { Shape } from './types';
import { f, rad } from './geometry';

export function shapeTransform(s: Shape): string {
  return `translate(${f(s.x)} ${f(s.y)}) rotate(${f(s.r)}) scale(${s.fx} ${s.fy}) translate(${f(-s.w / 2)} ${f(-s.h / 2)})`;
}

/** 4 góc của khung hình sau khi xoay. */
export function corners(s: Shape): [number, number][] {
  const c = Math.cos(rad(s.r)), n = Math.sin(rad(s.r));
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) => [
    s.x + ((a * s.w) / 2) * c - ((b * s.h) / 2) * n,
    s.y + ((a * s.w) / 2) * n + ((b * s.h) / 2) * c,
  ]);
}

export function bboxOf(list: Shape[]) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of list) {
    const pad = (s.sw || 0) / 2;
    for (const [x, y] of corners(s)) {
      x0 = Math.min(x0, x - pad); y0 = Math.min(y0, y - pad);
      x1 = Math.max(x1, x + pad); y1 = Math.max(y1, y + pad);
    }
  }
  return { x0, y0, x1, y1 };
}
