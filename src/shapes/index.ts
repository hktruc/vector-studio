import { defineShape } from './registry';
import { basicShapes } from './basic';
import { circleShapes } from './circles';
import { arrowShapes } from './arrows';
import { blockShapes } from './blocks';
import { textShapes } from './text';

let done = false;
/** Đăng ký toàn bộ loại hình có sẵn. Gọi một lần khi khởi động (an toàn khi gọi lại). */
export function registerBuiltinShapes(): void {
  if (done) return;
  done = true;
  [...basicShapes, ...circleShapes, ...arrowShapes, ...blockShapes, ...textShapes].forEach(defineShape);
}
export * from './registry';
export { LIBRARY } from './catalog';
