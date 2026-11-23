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

/* ---------- Biến đổi nhiều hình cùng lúc (chọn nhiều / nhóm) ----------
 * Các hàm nhận ảnh chụp ban đầu (s0) và ghi kết quả vào hình đích (out),
 * để khi kéo chuột luôn tính từ trạng thái gốc, không bị cộng dồn sai số. */

type Pick5 = Pick<Shape, 'x' | 'y' | 'w' | 'h' | 'r' | 'sw' | 'p' | 't'>;

/** Dời tất cả hình một đoạn (dx, dy). */
export function moveShapes(s0: Pick5[], out: Pick5[], dx: number, dy: number) {
  s0.forEach((a, i) => { out[i].x = a.x + dx; out[i].y = a.y + dy; });
}

/**
 * Phóng to/thu nhỏ đều với hệ số k quanh điểm neo (ax, ay).
 * Chỉ phóng đều (giữ tỉ lệ) vì hình đã xoay không thể kéo giãn lệch mà vẫn giữ đúng dạng.
 * scaleParams(t) trả về tên các thông số cũng cần nhân k (ví dụ cỡ chữ).
 */
export function scaleShapes(
  s0: Pick5[], out: Pick5[], ax: number, ay: number, k: number,
  scaleParams: (t: string) => string[] = () => [],
) {
  s0.forEach((a, i) => {
    const o = out[i];
    o.x = ax + (a.x - ax) * k; o.y = ay + (a.y - ay) * k;
    o.w = Math.max(1, a.w * k); o.h = Math.max(1, a.h * k);
    o.sw = Math.round(a.sw * k * 10) / 10;
    for (const key of scaleParams(a.t))
      if (typeof a.p[key] === 'number') o.p = { ...o.p, [key]: Math.round(a.p[key] * k * 10) / 10 };
  });
}

/** Xoay tất cả hình một góc deg (độ) quanh tâm (cx, cy). */
export function rotateShapes(s0: Pick5[], out: Pick5[], cx: number, cy: number, deg: number) {
  const c = Math.cos(rad(deg)), n = Math.sin(rad(deg));
  s0.forEach((a, i) => {
    const dx = a.x - cx, dy = a.y - cy, o = out[i];
    o.x = cx + dx * c - dy * n; o.y = cy + dx * n + dy * c;
    o.r = (((a.r + deg) % 360) + 360) % 360;
  });
}
