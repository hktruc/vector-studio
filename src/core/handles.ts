import type { HandleDef, ParamDef, Shape } from './types';
import { getShape } from '../shapes/registry';
import { toLocal, toWorldPt } from './transform';

/**
 * Tay nắm thông số ("hình sống"): kéo ngay trên khung để đổi góc quạt, đầu mũi tên, bo góc, số tầng…
 * Mỗi loại hình khai báo tay nắm trong ShapeDef.handles; ở đây lo phần chung: đổi tọa độ, kẹp giá trị, làm tròn.
 */

export const handlesOf = (t: string): HandleDef[] => { try { return getShape(t).handles ?? []; } catch { return []; } };

/** Vị trí các tay nắm của hình trên trang. */
export function handlePositions(s: Shape): [number, number][] {
  return handlesOf(s.t).map((h) => { const [x, y] = h.pos(s.w, s.h, s.p); return toWorldPt(s, x, y); });
}

/** Kẹp giá trị theo min/max và làm tròn theo step của thông số. */
export function clampParam(q: ParamDef | undefined, v: number): number {
  if (!q || !isFinite(v)) return v;
  let x = v;
  if (q.step) x = Math.round(x / q.step) * q.step;
  if (q.min !== undefined) x = Math.max(q.min, x);
  if (q.max !== undefined) x = Math.min(q.max, x);
  return Math.round(x * 1e6) / 1e6;
}

/** Kéo tay nắm thứ i tới điểm (x, y) trên trang. Trả về true nếu thông số đổi. */
export function applyHandle(s: Shape, i: number, x: number, y: number, snap = false): boolean {
  const def = getShape(s.t), h = def.handles?.[i]; if (!h) return false;
  const [lx, ly] = toLocal(s, x, y);
  const next = h.drag(s.w, s.h, s.p, lx, ly, snap);
  let changed = false;
  const p = { ...s.p };
  for (const k in next) {
    const v = clampParam(def.params.find((q) => q.k === k), next[k]);
    if (p[k] !== v) { p[k] = v; changed = true; }
  }
  if (changed) s.p = p;
  return changed;
}

/* ---------- Tiện ích cho các khai báo tay nắm ---------- */

/** Góc (độ, theo chiều kim đồng hồ từ 12 giờ, 0..360) của điểm (x, y) quanh tâm khung — khớp với geometry.polar. */
export function angleOf(w: number, h: number, x: number, y: number): number {
  const a = (Math.atan2((x / w - 0.5), -(y / h - 0.5)) * 180) / Math.PI;
  return (a + 360) % 360;
}
/** Bán kính tương đối (0 = tâm, 1 = mép elip) của điểm (x, y). */
export const radiusOf = (w: number, h: number, x: number, y: number) => Math.hypot((x / w - 0.5) * 2, (y / h - 0.5) * 2);
/** Làm tròn góc về bội 15° khi đang bắt điểm. */
export const snapAngle = (a: number, snap: boolean) => (snap ? Math.round(a / 15) * 15 : Math.round(a));
