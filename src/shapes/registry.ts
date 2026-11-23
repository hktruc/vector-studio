import type { ParamDef, Part, ShapeDef } from '../core/types';

const registry = new Map<string, ShapeDef>();

/** Đăng ký một loại hình. Thêm hình mới chỉ cần gọi hàm này (xem docs/ADDING-A-SHAPE.md). */
export function defineShape(def: ShapeDef): void {
  if (registry.has(def.type)) throw new Error(`Loại hình bị trùng: ${def.type}`);
  registry.set(def.type, def);
}
export function getShape(type: string): ShapeDef {
  const d = registry.get(type);
  if (!d) throw new Error(`Chưa đăng ký loại hình: ${type}`);
  return d;
}
export const allShapes = () => [...registry.values()];

export function defaultParams(type: string): Record<string, any> {
  const o: Record<string, any> = {};
  getShape(type).params.forEach((q: ParamDef) => (o[q.k] = q.def));
  return o;
}

export function partsOf(type: string, w: number, h: number, p: Record<string, any>): Part[] {
  return getShape(type).parts(w, h, p);
}
