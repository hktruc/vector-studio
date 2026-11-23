import type { Doc, Shape } from './types';
import { f, rad } from './geometry';
import { mix } from './color';
import { bboxOf, shapeTransform } from './transform';
import { partsOf } from '../shapes/registry';
import { LINE_HEIGHT, contrastText, fitText } from './text';

const esc = (t: unknown) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * Định nghĩa gradient cho một hình, tính trong hệ tọa độ riêng của hình (0..w × 0..h),
 * nên xoay/lật hình thì gradient xoay/lật theo. Trả về thẻ <linearGradient>/<radialGradient>.
 */
export function gradientDef(s: Shape, id: string, shade = 0): string {
  const g = s.grad!;
  const stops = `<stop offset="0" stop-color="${mix(s.fill, shade)}"/><stop offset="1" stop-color="${mix(g.c2, shade)}"/>`;
  if (g.type === 'radial')
    return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(s.w / 2)}" cy="${f(s.h / 2)}" r="${f(Math.hypot(s.w, s.h) / 2)}">${stops}</radialGradient>`;
  const c = Math.cos(rad(g.a)), n = Math.sin(rad(g.a)), L = (Math.abs(s.w * c) + Math.abs(s.h * n)) / 2;
  const cx = s.w / 2, cy = s.h / 2;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(cx - c * L)}" y1="${f(cy - n * L)}" x2="${f(cx + c * L)}" y2="${f(cy + n * L)}">${stops}</linearGradient>`;
}

/**
 * Một hình -> chuỗi SVG (thẻ <g>). Dùng chung cho màn hình vẽ, xem trước và xuất file.
 * idPrefix: tiền tố id cho gradient, để nhiều bản vẽ cùng một hình trên một trang không bị trùng id.
 */
export function shapeToSVG(s: Shape, idPrefix = 'vsg'): string {
  const parts = partsOf(s.t, s.w, s.h, s.p);
  const op = s.op < 1 ? ` opacity="${s.op}"` : '';
  const stroke = s.sw > 0 ? ` stroke="${s.stroke}" stroke-width="${s.sw}" stroke-linejoin="round"` : '';
  // mỗi độ sáng tối (shade) khác nhau cần một gradient riêng
  const defs = new Map<number, string>();
  const paint = (shade: number) => {
    if (!s.grad) return mix(s.fill, shade);
    if (!defs.has(shade)) defs.set(shade, `${idPrefix}${s.id}-${defs.size}`);
    return `url(#${defs.get(shade)})`;
  };
  const inner = parts
    .map((pt) =>
      pt.img
        ? `<image href="${esc(s.p.href)}" x="0" y="0" width="${f(s.w)}" height="${f(s.h)}" preserveAspectRatio="none"/>`
        : pt.text
        ? `<text x="${f(s.w / 2)}" y="${f(s.h / 2 + s.p.size * 0.35)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${s.p.size}" font-weight="${s.p.bold ? 700 : 400}" fill="${paint(0)}">${esc(s.p.text)}</text>`
        : `<path d="${pt.d}" fill="${paint(pt.shade || 0)}"${pt.rule ? ` fill-rule="${pt.rule}"` : ''}${stroke}/>`,
    )
    .join('');
  const defsSVG = defs.size ? `<defs>${[...defs].map(([sh, id]) => gradientDef(s, id, sh)).join('')}</defs>` : '';
  return `<g transform="${shapeTransform(s)}"${op}>${defsSVG}${inner}${labelSVG(s)}</g>`;
}

/**
 * Chữ gõ trên hình: căn giữa, tự co cỡ vừa khung, xuất dạng <text> (Canva đổi được font).
 * Bọc trong scale(fx fy) để chữ không bị lật ngược khi hình bị lật.
 */
export function labelSVG(s: Shape): string {
  const t = (s.label ?? '').trim();
  if (!t || s.t === 'text' || s.t === 'connector' || s.t === 'image') return '';
  // hình tròn, đa giác, sao…: vùng đặt chữ hẹp hơn khung bao nên chừa lề rộng hơn
  const pad = ['pie', 'ngon', 'star', 'diamond', 'tri', 'rtri', 'plus', 'circarrow'].includes(s.t) ? 0.2 : 0.1;
  const { size, lines } = fitText(t, s.w, s.h, { bold: true, pad });
  const color = s.lc || contrastText(s.fill);
  const lh = size * LINE_HEIGHT, y0 = -((lines.length - 1) * lh) / 2 + size * 0.35;
  const spans = lines.map((l, i) => `<tspan x="0" y="${f(y0 + i * lh)}">${esc(l)}</tspan>`).join('');
  return `<g transform="translate(${f(s.w / 2)} ${f(s.h / 2)}) scale(${s.fx} ${s.fy})"><text text-anchor="middle" font-family="Arial, sans-serif" font-size="${size}" font-weight="700" fill="${color}">${spans}</text></g>`;
}

/** Nhiều hình -> SVG; các hình cùng nhóm (liền nhau, cùng gid) được bọc chung một thẻ <g>. */
export function shapesToSVG(all: Shape[]): string {
  const list = all.filter((s) => !s.hidden); // hình ẩn không xuất
  let out = '';
  for (let i = 0; i < list.length; ) {
    const g = list[i].gid;
    let j = i + 1;
    if (g !== undefined) while (j < list.length && list[j].gid === g) j++;
    const body = list.slice(i, j).map((s) => shapeToSVG(s)).join('');
    out += g !== undefined ? `<g>${body}</g>` : body;
    i = j;
  }
  return out;
}

export function exportDocument(doc: Doc, transparent = true): string {
  const bg = transparent ? '' : `<rect width="${doc.cw}" height="${doc.ch}" fill="#FFFFFF"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.cw} ${doc.ch}" width="${doc.cw}" height="${doc.ch}">${bg}${shapesToSVG(doc.shapes)}</svg>`;
}

/** Xuất riêng các hình đang chọn (một hoặc nhiều), cắt sát khung. */
export function exportShapes(all: Shape[]): string {
  const list = all.filter((s) => !s.hidden);
  const b = bboxOf(list), pad = 2;
  const w = Math.ceil(b.x1 - b.x0 + pad * 2), h = Math.ceil(b.y1 - b.y0 + pad * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><g transform="translate(${f(-b.x0 + pad)} ${f(-b.y0 + pad)})">${shapesToSVG(list)}</g></svg>`;
}

/** Xuất riêng một hình, cắt sát khung. */
export const exportShape = (s: Shape) => exportShapes([s]);

/* ---------- Xuất ảnh PNG ---------- */

/** Giới hạn số điểm ảnh an toàn cho mọi trình duyệt (Safari/iPhone ~16,7 triệu điểm ảnh). */
export const MAX_PNG_PIXELS = 16_000_000;

/**
 * Kích thước ảnh PNG (điểm ảnh) cho một khung w×h ở độ nét `scale` (1x, 2x, 4x…).
 * Nếu quá lớn thì tự giảm độ nét cho vừa giới hạn; `scale` trả về là độ nét thật sự dùng.
 */
export function rasterSize(w: number, h: number, scale: number, maxPixels = MAX_PNG_PIXELS) {
  let k = Math.max(0.01, scale);
  if (w * h * k * k > maxPixels) k = Math.sqrt(maxPixels / (w * h));
  return { width: Math.max(1, Math.floor(w * k)), height: Math.max(1, Math.floor(h * k)), scale: k, reduced: k < scale };
}

/** Đặt lại width/height (điểm ảnh) cho thẻ <svg> ngoài cùng, giữ nguyên viewBox, để trình duyệt vẽ nét ở đúng cỡ đích. */
export function sizedSVG(svg: string, width: number, height: number): string {
  return svg.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${width}" height="${height}"`);
}

/** Đọc kích thước (theo viewBox) của một chuỗi SVG do Vector Studio xuất ra. */
export function svgViewSize(svg: string) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return m ? { w: +m[1], h: +m[2] } : { w: 0, h: 0 };
}
