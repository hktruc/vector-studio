import type { ShapeDef } from '../core/types';
import { strokeOutline } from '../core/connect';

/**
 * Đường nối giữa hai hình (core/connect.ts tính đường đi) và ảnh dán vào.
 * Không có trong thư viện; được tạo bằng phím Tab, nút "Nối", hoặc dán ảnh.
 */
export const connectorShapes: ShapeDef[] = [
  { type: 'connector', params: [
      { k: 'style', l: 'Kiểu đường', type: 'select', def: 'straight', opts: [['straight', 'Thẳng'], ['elbow', 'Gấp khúc'], ['curve', 'Cong']] },
      { k: 'sa', l: 'Đầu', type: 'select', def: 'none', opts: [['none', 'Tròn'], ['arrow', 'Mũi tên'], ['dot', 'Chấm']] },
      { k: 'ea', l: 'Cuối', type: 'select', def: 'arrow', opts: [['none', 'Tròn'], ['arrow', 'Mũi tên'], ['dot', 'Chấm']] },
      { k: 'th', l: 'Độ dày nét', min: 1, max: 20, step: 1, def: 3 }],
    parts: (_w, _h, p) => [{ d: strokeOutline(p.pts || [], p.th, p.sa, p.ea) || 'M0 0 Z' }] },
  { type: 'image', params: [], parts: () => [{ img: true }] },
];
