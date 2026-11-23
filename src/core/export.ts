import type { Doc, Shape } from './types';
import { f } from './geometry';
import { mix } from './color';
import { bboxOf, shapeTransform } from './transform';
import { partsOf } from '../shapes/registry';

const esc = (t: unknown) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Một hình -> chuỗi SVG (thẻ <g>). Dùng chung cho màn hình vẽ, xem trước và xuất file. */
export function shapeToSVG(s: Shape): string {
  const parts = partsOf(s.t, s.w, s.h, s.p);
  const op = s.op < 1 ? ` opacity="${s.op}"` : '';
  const stroke = s.sw > 0 ? ` stroke="${s.stroke}" stroke-width="${s.sw}" stroke-linejoin="round"` : '';
  const inner = parts
    .map((pt) =>
      pt.text
        ? `<text x="${f(s.w / 2)}" y="${f(s.h / 2 + s.p.size * 0.35)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${s.p.size}" font-weight="${s.p.bold ? 700 : 400}" fill="${s.fill}">${esc(s.p.text)}</text>`
        : `<path d="${pt.d}" fill="${mix(s.fill, pt.shade || 0)}"${pt.rule ? ` fill-rule="${pt.rule}"` : ''}${stroke}/>`,
    )
    .join('');
  return `<g transform="${shapeTransform(s)}"${op}>${inner}</g>`;
}

export function exportDocument(doc: Doc, transparent = true): string {
  const bg = transparent ? '' : `<rect width="${doc.cw}" height="${doc.ch}" fill="#FFFFFF"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.cw} ${doc.ch}" width="${doc.cw}" height="${doc.ch}">${bg}${doc.shapes.map(shapeToSVG).join('')}</svg>`;
}

/** Xuất riêng một hình, cắt sát khung. */
export function exportShape(s: Shape): string {
  const b = bboxOf([s]), pad = 2;
  const w = Math.ceil(b.x1 - b.x0 + pad * 2), h = Math.ceil(b.y1 - b.y0 + pad * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><g transform="translate(${f(-b.x0 + pad)} ${f(-b.y0 + pad)})">${shapeToSVG(s)}</g></svg>`;
}
