import { rasterSize } from './export';

/**
 * Sao chép sang ứng dụng khác (Canva, PowerPoint, Word, Google Slides…). Thuần dữ liệu.
 *
 * Ctrl+C đưa vào bộ nhớ tạm của máy cùng lúc:
 *  - ảnh PNG nền trong suốt, độ nét CLIP_SCALE (mọi ứng dụng đều dán được),
 *  - ảnh SVG vector (nếu trình duyệt hỗ trợ; ứng dụng nào đọc được SVG sẽ tự chọn).
 * Không kèm dạng chữ, để PowerPoint/Canva không dán nhầm thành một khối mã.
 *
 * Bản gốc (dữ liệu hình sửa được) giữ trong bộ nhớ của trang. Khi dán lại vào Vector Studio,
 * `isOwnPaste` quyết định có dán hình sửa được hay dán như một ảnh.
 */
export const CLIP_SCALE = 2;
/** Giới hạn điểm ảnh cho ảnh sao chép (nhẹ hơn ảnh xuất file để sao chép nhanh). */
export const CLIP_MAX_PIXELS = 8_000_000;

export interface OwnCopy {
  json: string; // dữ liệu hình (DocStore.copySelection)
  svg: string; // mã SVG của vùng chọn
  w: number; // cỡ ảnh PNG đã đưa vào bộ nhớ tạm
  h: number;
  at: number; // thời điểm sao chép (ms)
  left: boolean; // người dùng đã rời trang (có thể đã sao chép thứ khác ở ứng dụng khác)
}

/** Cỡ ảnh PNG sẽ đưa vào bộ nhớ tạm cho một vùng w×h. */
export const clipImageSize = (w: number, h: number) => rasterSize(w, h, CLIP_SCALE, CLIP_MAX_PIXELS);

/**
 * Dán trong Vector Studio có phải là thứ mình vừa sao chép không?
 *  - Chưa rời trang kể từ lúc sao chép: chắc chắn là của mình.
 *  - Đã rời trang: chỉ coi là của mình nếu bộ nhớ tạm đang chứa ảnh đúng bằng cỡ ảnh mình đã đưa vào
 *    (trong vòng 30 phút) — ảnh từ nơi khác gần như không bao giờ trùng cỡ đến từng điểm ảnh.
 */
export function isOwnPaste(c: OwnCopy | null, img: { w: number; h: number } | null, now: number): boolean {
  if (!c) return false;
  if (!c.left) return true;
  return !!img && img.w === c.w && img.h === c.h && now - c.at < 30 * 60_000;
}
