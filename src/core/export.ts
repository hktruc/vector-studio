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

/** Nhiều hình -> SVG; các hình cùng nhóm (liền nhau, cùng gid) được bọc chung một thẻ <g>. */
export function shapesToSVG(list: Shape[]): string {
  let out = '';
  for (let i = 0; i < list.length; ) {
    const g = list[i].gid;
    let j = i + 1;
    if (g !== undefined) while (j < list.length && list[j].gid === g) j++;
    const body = list.slice(i, j).map(shapeToSVG).join('');
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
export function exportShapes(list: Shape[]): string {
  const b = bboxOf(list), pad = 2;
  const w = Math.ceil(b.x1 - b.x0 + pad * 2), h = Math.ceil(b.y1 - b.y0 + pad * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><g transform="translate(${f(-b.x0 + pad)} ${f(-b.y0 + pad)})">${shapesToSVG(list)}</g></svg>`;
}

/** Xuất riêng một hình, cắt sát khung. */
export const exportShape = (s: Shape) => exportShapes([s]);
