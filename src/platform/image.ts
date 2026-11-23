/**
 * Đọc ảnh người dùng dán/thả vào, thu nhỏ nếu quá lớn (để không làm đầy bộ nhớ trình duyệt).
 * Ảnh có vùng trong suốt giữ PNG; ảnh không trong suốt chuyển JPEG cho nhẹ.
 * Chỉ chạy trên trình duyệt.
 */
export const MAX_IMAGE_SIDE = 1400;

export async function loadImageFile(file: Blob): Promise<{ href: string; w: number; h: number }> {
  const raw = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
  if (file.type === 'image/svg+xml') { const { w, h } = await naturalSize(raw); return { href: raw, w: w || 300, h: h || 200 }; }
  const img = await loadImg(raw);
  const k = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (!g) return { href: raw, w, h };
  g.drawImage(img, 0, 0, w, h);
  let alpha = false;
  try { const d = g.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) { alpha = true; break; } } catch { alpha = true; }
  const href = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
  return { href: href.length < raw.length || k < 1 ? href : raw, w, h };
}

/** Chuỗi mã SVG (dán dạng chữ) → ảnh SVG. */
export async function svgTextToImage(svg: string): Promise<{ href: string; w: number; h: number }> {
  const href = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  const { w, h } = await naturalSize(href);
  return { href, w: w || 300, h: h || 200 };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Không đọc được ảnh.')); i.src = src; });
}
async function naturalSize(src: string) {
  try { const i = await loadImg(src); return { w: i.naturalWidth, h: i.naturalHeight }; } catch { return { w: 0, h: 0 }; }
}
