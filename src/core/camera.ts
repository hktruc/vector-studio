/**
 * Khung nhìn (camera) của khung vẽ vô hạn. Thuần toán, không đụng giao diện.
 * Điểm trang (wx, wy) hiện ở màn hình tại ((wx - x) * z, (wy - y) * z) so với góc trên trái vùng vẽ.
 */
export interface Camera { x: number; y: number; z: number }

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;
const clampZ = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/** Đổi điểm màn hình (tính từ góc vùng vẽ) sang tọa độ trang. */
export const toWorld = (c: Camera, sx: number, sy: number) => ({ x: c.x + sx / c.z, y: c.y + sy / c.z });

/** Thu phóng hệ số k mà giữ nguyên điểm dưới con trỏ (sx, sy). */
export function zoomAt(c: Camera, k: number, sx: number, sy: number): Camera {
  const z = clampZ(c.z * k), w = toWorld(c, sx, sy);
  return { x: w.x - sx / z, y: w.y - sy / z, z };
}

/** Dời khung nhìn theo số điểm ảnh màn hình. */
export const panBy = (c: Camera, dx: number, dy: number): Camera => ({ x: c.x - dx / c.z, y: c.y - dy / c.z, z: c.z });

/** Camera vừa khít một vùng (có lề `pad` điểm ảnh) trong vùng vẽ rộng vw × cao vh. */
export function fitBox(b: { x0: number; y0: number; x1: number; y1: number }, vw: number, vh: number, pad = 40, maxZ = 2): Camera {
  const w = Math.max(1, b.x1 - b.x0), h = Math.max(1, b.y1 - b.y0);
  const z = clampZ(Math.min((vw - pad * 2) / w, (vh - pad * 2) / h, maxZ));
  return { x: (b.x0 + b.x1) / 2 - vw / 2 / z, y: (b.y0 + b.y1) / 2 - vh / 2 / z, z };
}

/** Tâm vùng đang nhìn (tọa độ trang) — nơi đặt hình mới. */
export const viewCenter = (c: Camera, vw: number, vh: number) => toWorld(c, vw / 2, vh / 2);

/** Mức thu phóng kế tiếp khi bấm +/− (các nấc quen thuộc). */
export function stepZoom(z: number, dir: 1 | -1): number {
  const steps = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
  return dir > 0 ? steps.find((s) => s > z + 1e-6) ?? ZOOM_MAX : [...steps].reverse().find((s) => s < z - 1e-6) ?? ZOOM_MIN;
}
