/**
 * Ghi vào bộ nhớ tạm của máy (để dán sang Canva, PowerPoint…). Chỉ chạy trên trình duyệt.
 * Phải gọi ngay trong lúc người dùng bấm phím/nút (trình duyệt chỉ cho phép khi đó).
 */

/** Trình duyệt có ghi được ảnh vào bộ nhớ tạm không. */
export const canWriteImages = () => typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
const supports = (t: string) => { try { return (ClipboardItem as any).supports ? (ClipboardItem as any).supports(t) : t === 'image/png'; } catch { return false; } };

/**
 * Ghi ảnh PNG (+ SVG nếu trình duyệt hỗ trợ). png là Promise để gọi được ngay lúc bấm
 * (Safari đòi vậy) trong khi ảnh vẫn đang được vẽ.
 * Trả về các định dạng đã ghi, hoặc ném lỗi nếu trình duyệt từ chối.
 */
export async function writeImage(svg: string, png: Promise<Blob>): Promise<string[]> {
  const items: Record<string, Blob | Promise<Blob>> = { 'image/png': png };
  if (supports('image/svg+xml')) items['image/svg+xml'] = new Blob([svg], { type: 'image/svg+xml' });
  await navigator.clipboard.write([new ClipboardItem(items)]);
  return Object.keys(items);
}

/** Ghi chữ thường (dùng cho "Sao chép mã SVG"). */
export async function writeText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Đọc cỡ ảnh (để nhận ra ảnh mình vừa sao chép). */
export async function imageSize(file: Blob): Promise<{ w: number; h: number } | null> {
  try { const b = await createImageBitmap(file); const r = { w: b.width, h: b.height }; b.close(); return r; } catch { return null; }
}
