import { defineShape } from './registry';
import { basicShapes } from './basic';
import { circleShapes } from './circles';
import { arrowShapes } from './arrows';
import { blockShapes } from './blocks';
import { textShapes } from './text';
import { connectorShapes } from './connector';
import { curveShapes } from './curves';

let done = false;
/** Đăng ký toàn bộ loại hình có sẵn. Gọi một lần khi khởi động (an toàn khi gọi lại). */
export function registerBuiltinShapes(): void {
  if (done) return;
  done = true;
  [...basicShapes, ...circleShapes, ...arrowShapes, ...blockShapes, ...textShapes, ...connectorShapes, ...curveShapes].forEach(defineShape);
}
export * from './registry';
export { LIBRARY } from './catalog';

import { LIBRARY as LIB } from './catalog';
import type { Shape } from '../core/types';
/** Tên hiển thị của hình: tên người dùng đặt, nếu không có thì tên mẫu hình trong thư viện. */
export function shapeLabel(s: Pick<Shape, 't' | 'name'>): string {
  if (s.name) return s.name;
  for (const g of LIB) for (const it of g.items) if (it.t === s.t) return it.n;
  return s.t;
}
export { searchLibrary, libItem, fold } from './search';
