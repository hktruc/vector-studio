/**
 * Mảng lặp và đối xứng. Thuần toán: tính vị trí/góc cho từng bản sao; DocStore lo việc tạo hình.
 */
export type ArrayKind = 'row' | 'col' | 'grid' | 'ring';
export interface CopyPlace { dx: number; dy: number; rot: number }

/**
 * Vị trí các bản sao (bản gốc là số 0, không nằm trong kết quả) so với tâm khối gốc.
 * w, h: cỡ khối gốc. gap: khoảng cách giữa các bản (hàng, lưới) hoặc bán kính (vòng).
 * Vòng: bản gốc ở đỉnh (12 giờ), các bản sao xếp đều theo chiều kim đồng hồ quanh tâm nằm bên dưới; rotate: xoay theo vòng.
 */
export function arrayPlaces(kind: ArrayKind, count: number, w: number, h: number, gap: number, opts: { cols?: number; rotate?: boolean } = {}): CopyPlace[] {
  const n = Math.max(1, Math.min(200, Math.floor(count)));
  const out: CopyPlace[] = [];
  const cols = Math.max(1, opts.cols ?? Math.ceil(Math.sqrt(n)));
  for (let i = 1; i < n; i++) {
    if (kind === 'row') out.push({ dx: i * (w + gap), dy: 0, rot: 0 });
    else if (kind === 'col') out.push({ dx: 0, dy: i * (h + gap), rot: 0 });
    else if (kind === 'grid') out.push({ dx: (i % cols) * (w + gap), dy: Math.floor(i / cols) * (h + gap), rot: 0 });
    else {
      const R = Math.max(1, gap), a = (2 * Math.PI * i) / n;
      out.push({ dx: R * Math.sin(a), dy: R - R * Math.cos(a), rot: opts.rotate ? Math.round(((360 * i) / n) * 100) / 100 : 0 });
    }
  }
  return out;
}

/** Bán kính vòng vừa đủ để n bản (cỡ s) không chồng nhau. */
export const ringRadiusFor = (n: number, size: number, gap = 10) => Math.max(size, ((size + gap) * n) / (2 * Math.PI));
