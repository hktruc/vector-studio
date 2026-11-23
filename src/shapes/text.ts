import type { ShapeDef } from '../core/types';

export const textShapes: ShapeDef[] = [
  { type: 'text', params: [
      { k: 'text', l: 'Nội dung', type: 'text', def: 'Văn bản' },
      { k: 'size', l: 'Cỡ chữ', min: 8, max: 200, step: 1, def: 36 },
      { k: 'bold', l: 'Đậm', type: 'check', def: 1 }],
    scaleParams: ['size'],
    parts: () => [{ text: true }] },
];
