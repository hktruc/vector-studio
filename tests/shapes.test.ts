import { describe, expect, it } from 'vitest';
import { LIBRARY, defaultParams, partsOf, registerBuiltinShapes, allShapes } from '../src/shapes';

registerBuiltinShapes();

describe('thư viện hình', () => {
  it('mọi mục trong catalog trỏ tới loại hình đã đăng ký và không sinh NaN', () => {
    for (const g of LIBRARY)
      for (const it of g.items) {
        const parts = partsOf(it.t, it.w, it.h, { ...defaultParams(it.t), ...(it.p || {}) });
        expect(parts.length, it.n).toBeGreaterThan(0);
        for (const p of parts) if (p.d) expect(p.d, it.n).not.toMatch(/NaN|undefined|Infinity/);
      }
  });
  it('không có loại hình nào trùng tên', () => {
    const names = allShapes().map((s) => s.type);
    expect(new Set(names).size).toBe(names.length);
  });
  it('giá trị mặc định nằm trong khoảng min..max', () => {
    for (const s of allShapes())
      for (const q of s.params)
        if (q.min !== undefined && q.max !== undefined) {
          expect(q.def as number).toBeGreaterThanOrEqual(q.min);
          expect(q.def as number).toBeLessThanOrEqual(q.max);
        }
  });
});
