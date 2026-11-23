import { describe, expect, it } from 'vitest';
import { BrandPalette, PALETTE_KEY, PALETTE_MAX, normalizeHex, parseColorList } from '../src/core/palette';
import { DocStore } from '../src/core/store';
import { exportDocument, shapeToSVG } from '../src/core/export';
import { registerBuiltinShapes } from '../src/shapes';
import type { Shape } from '../src/core/types';

registerBuiltinShapes();

function memStorage() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('mã màu', () => {
  it('chuẩn hóa nhiều cách viết về #RRGGBB', () => {
    expect(normalizeHex('#1e6fb5')).toBe('#1E6FB5');
    expect(normalizeHex('1E6FB5')).toBe('#1E6FB5');
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex(' #ABC ')).toBe('#AABBCC');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('xanh')).toBeNull();
  });
  it('đọc được danh sách màu dán từ tài liệu thương hiệu, bỏ trùng', () => {
    const t = 'Màu chính: #1E6FB5\nMàu phụ: e0a458, #5fa87a; nhấn #F00 — lặp lại #1e6fb5';
    expect(parseColorList(t)).toEqual(['#1E6FB5', '#E0A458', '#5FA87A', '#FF0000']);
    expect(parseColorList('không có màu nào')).toEqual([]);
  });
});

describe('bộ màu thương hiệu', () => {
  it('tự lưu và mở lại được', () => {
    const s = memStorage();
    const p = new BrandPalette(s);
    p.setFromText('#111111 #222222');
    expect(p.add('#333')).toBe(true);
    expect(p.add('#333333')).toBe(false); // trùng
    expect(p.add('sai')).toBe(false);
    expect(JSON.parse(s.m.get(PALETTE_KEY)!)).toEqual(['#111111', '#222222', '#333333']);
    expect(new BrandPalette(s).colors).toEqual(['#111111', '#222222', '#333333']);
  });
  it('xóa màu, về mặc định, giới hạn số màu, báo thay đổi', () => {
    const p = new BrandPalette(memStorage());
    let n = 0; p.onChange(() => n++);
    p.setFromText('#111111 #222222 #333333');
    p.remove(1);
    expect(p.colors).toEqual(['#111111', '#333333']);
    expect(p.setFromText('rác')).toBe(0);
    expect(p.colors.length).toBe(2); // dán sai thì giữ nguyên
    p.reset();
    expect(p.colors.length).toBeGreaterThan(0);
    for (let i = 0; i < 50; i++) p.add('#' + (0x100000 + i).toString(16));
    expect(p.colors.length).toBe(PALETTE_MAX);
    expect(n).toBeGreaterThan(3);
  });
  it('hình mới lấy màu lần lượt từ bộ màu thương hiệu', () => {
    const p = new BrandPalette(memStorage());
    p.setFromText('#AA0000 #00AA00');
    const st = new DocStore(null);
    st.colorSource = () => p.cycle();
    const it = { n: 'r', t: 'rrect', w: 10, h: 10 };
    expect([st.addFromLibrary(it), st.addFromLibrary(it), st.addFromLibrary(it)].map((s) => s.fill)).toEqual(['#AA0000', '#00AA00', '#AA0000']);
  });
});

describe('màu chuyển sắc (gradient)', () => {
  const mk = (extra: Partial<Shape> = {}): Shape =>
    ({ id: 7, t: 'rrect', x: 50, y: 50, w: 200, h: 100, r: 0, fx: 1, fy: 1, fill: '#112233', stroke: '#000000', sw: 0, op: 1, p: { r: 0 }, ...extra });

  it('màu đặc không sinh gradient', () => {
    const svg = shapeToSVG(mk());
    expect(svg).not.toContain('Gradient');
    expect(svg).toContain('fill="#112233"');
  });

  it('gradient thẳng: có <linearGradient> đúng màu và path tham chiếu tới nó', () => {
    const svg = shapeToSVG(mk({ grad: { type: 'linear', c2: '#ffffff', a: 0 } }));
    expect(svg).toMatch(/<linearGradient id="vsg7-0" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="200" y2="50">/);
    expect(svg).toContain('stop-color="#112233"');
    expect(svg).toContain('stop-color="#ffffff"');
    expect(svg).toContain('fill="url(#vsg7-0)"');
  });

  it('góc 90° chạy từ trên xuống dưới; gradient tròn phủ cả hình', () => {
    expect(shapeToSVG(mk({ grad: { type: 'linear', c2: '#fff', a: 90 } }))).toMatch(/x1="100" y1="0" x2="100" y2="100"/);
    expect(shapeToSVG(mk({ grad: { type: 'radial', c2: '#fff', a: 0 } }))).toMatch(/<radialGradient id="vsg7-0" gradientUnits="userSpaceOnUse" cx="100" cy="50" r="111.8/);
  });

  it('hình nhiều mảng sáng tối có gradient riêng cho mỗi độ sáng; tiền tố id tránh trùng', () => {
    const cube: Shape = mk({ t: 'cube', p: { depth: 0.25 }, grad: { type: 'linear', c2: '#ffffff', a: 0 } });
    const svg = shapeToSVG(cube, 'lt');
    const ids = [...svg.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((i) => i.startsWith('lt7-'))).toBe(true);
  });

  it('file xuất vẫn là hình đặc: không marker/mask/filter, mỗi id gradient là duy nhất', () => {
    const st = new DocStore(null);
    for (let i = 0; i < 3; i++) st.addFromLibrary({ n: 'r', t: 'rrect', w: 50, h: 50 }).grad = { type: 'linear', c2: '#ffffff', a: 45 };
    const svg = exportDocument(st.doc);
    expect(svg).not.toMatch(/<marker|<mask|<filter/);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(3);
    expect(new Set(ids).size).toBe(3);
  });
});
