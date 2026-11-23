/** Kiểu dữ liệu cốt lõi. Không phụ thuộc DOM hay giao diện. */

export type ParamValue = number | string;

export interface ParamDef {
  k: string;
  l: string; // nhãn hiển thị
  type?: 'range' | 'text' | 'check';
  min?: number;
  max?: number;
  step?: number;
  def: ParamValue;
}

/** Một mảnh vẽ của hình: đường path (hoặc chữ) kèm độ sáng tối. */
export interface Part {
  d?: string;
  shade?: number; // -1..1: tối..sáng so với màu tô
  rule?: 'evenodd' | 'nonzero';
  text?: boolean;
}

/** Định nghĩa một loại hình trong thư viện (xem docs/ADDING-A-SHAPE.md). */
export interface ShapeDef {
  type: string;
  params: ParamDef[];
  parts: (w: number, h: number, p: Record<string, any>) => Part[];
}

/** Một hình cụ thể nằm trên khung. */
export interface Shape {
  id: number;
  t: string; // khớp ShapeDef.type
  x: number; // tâm
  y: number;
  w: number;
  h: number;
  r: number; // góc xoay (độ)
  fx: 1 | -1; // lật ngang
  fy: 1 | -1; // lật dọc
  fill: string;
  stroke: string;
  sw: number;
  op: number;
  p: Record<string, any>;
}

export interface Doc {
  v: 1; // phiên bản định dạng dữ liệu
  cw: number;
  ch: number;
  sizeIdx: number;
  seq: number;
  shapes: Shape[];
}

export interface LibItem {
  n: string;
  t: string;
  w: number;
  h: number;
  p?: Record<string, any>;
}
export interface LibGroup {
  g: string;
  items: LibItem[];
}
