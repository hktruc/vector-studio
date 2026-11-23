/** Kiểu dữ liệu cốt lõi. Không phụ thuộc DOM hay giao diện. */

export type ParamValue = number | string;

export interface ParamDef {
  k: string;
  l: string; // nhãn hiển thị
  type?: 'range' | 'text' | 'check' | 'select';
  /** Lựa chọn cho type 'select': [giá trị, nhãn]. */
  opts?: [string, string][];
  min?: number;
  max?: number;
  step?: number;
  def: ParamValue;
  /** Chỉ hiện thanh chỉnh này khi điều kiện đúng (ví dụ theo kiểu đường cong đang chọn). */
  show?: (p: Record<string, any>) => boolean;
}

/** Một mảnh vẽ của hình: đường path (hoặc chữ) kèm độ sáng tối. */
export interface Part {
  d?: string;
  shade?: number; // -1..1: tối..sáng so với màu tô
  rule?: 'evenodd' | 'nonzero';
  text?: boolean;
  /** Ảnh (dùng cho hình kiểu 'image'): vẽ thẻ <image> phủ cả khung hình. */
  img?: boolean;
}

/** Định nghĩa một loại hình trong thư viện (xem docs/ADDING-A-SHAPE.md). */
export interface ShapeDef {
  type: string;
  params: ParamDef[];
  parts: (w: number, h: number, p: Record<string, any>) => Part[];
  /** Thông số cần nhân theo tỉ lệ khi phóng to/thu nhỏ đều (ví dụ cỡ chữ). */
  scaleParams?: string[];
  /** Gọi sau mỗi thay đổi để hình tự chỉnh khung (ví dụ đường cong co khung ôm sát). */
  refit?: (s: Shape) => void;
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
  /** Mã nhóm (không có = hình lẻ). Các hình cùng gid luôn nằm liền nhau trong doc.shapes. */
  gid?: number;
  /** Tên hiển thị trong panel lớp (không có = dùng tên mẫu hình). */
  name?: string;
  /** Ẩn: không vẽ trên khung, không xuất ra file, không chọn được. */
  hidden?: boolean;
  /** Khóa: vẫn vẽ và xuất, nhưng không chọn/kéo được trên khung. */
  locked?: boolean;
  /** Màu chuyển sắc (gradient) từ `fill` sang `grad.c2`. Không có = màu đặc. */
  grad?: Gradient;
  /** Chữ gõ trên hình (bấm đúp vào hình); tự co cỡ vừa khung. */
  label?: string;
  /** Màu chữ trên hình (không có = tự chọn trắng/đen theo màu tô). */
  lc?: string;
}

export interface Gradient {
  type: 'linear' | 'radial';
  c2: string;
  /** Góc (độ) cho chuyển sắc thẳng: 0 = trái → phải, 90 = trên → dưới. */
  a: number;
}

/**
 * Phiên bản định dạng dữ liệu hiện tại.
 * v2: thêm Shape.gid (nhóm hình). v3: thêm Shape.name/hidden/locked và Doc.gnames (tên nhóm).
 * v4: thêm Shape.grad (màu chuyển sắc).
 * v5: thêm Shape.label/lc (chữ trên hình), loại hình 'connector' (đường nối) và 'image' (ảnh dán vào).
 */
export const DOC_VERSION = 5;

export interface Doc {
  v: typeof DOC_VERSION; // phiên bản định dạng dữ liệu
  cw: number;
  ch: number;
  sizeIdx: number;
  seq: number;
  shapes: Shape[];
  /** Tên nhóm theo gid (không có = "Nhóm"). */
  gnames?: Record<number, string>;
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
