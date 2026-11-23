import { describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { exportDocument, shapeToSVG } from '../src/core/export';
import { curveControls, curveHandles, curvePath, placeCurve, refitCurve, sampleCurve, setCurveHandle, toLocal, toWorldPt } from '../src/core/curve';
import { strokeOutline } from '../src/core/connect';
import { scaleShapes } from '../src/core/transform';
import { getShape, libItem, registerBuiltinShapes, searchLibrary } from '../src/shapes';
import type { Shape } from '../src/core/types';

registerBuiltinShapes();
const close = (a: number[], b: number[], d = 1e-6) => { expect(a[0]).toBeCloseTo(b[0], d > 1e-3 ? 1 : 4); expect(a[1]).toBeCloseTo(b[1], d > 1e-3 ? 1 : 4); };
const mkCurve = (p: Record<string, any> = {}, extra: Partial<Shape> = {}): Shape =>
  ({ id: 1, t: 'curve', x: 200, y: 100, w: 200, h: 100, r: 0, fx: 1, fy: 1, fill: '#123456', stroke: '#000', sw: 0, op: 1, p: { th: 4, ...p }, ...extra });

describe('đường cong Bézier', () => {
  it('a1 = a2 cho vòm cân đối; a1 = −a2 cho chữ S', () => {
    const arch = curveControls(200, 100, { x0: 0, y0: 1, x1: 1, y1: 1, a1: 60, k1: 0.5, a2: 60, k2: 0.5 });
    expect(arch.C1[1]).toBeLessThan(100); // tay nắm đầu hướng lên trên dây cung
    expect(arch.C1[1]).toBeCloseTo(arch.C2[1]);
    expect(arch.C1[0] + arch.C2[0]).toBeCloseTo(200); // đối xứng qua giữa
    const s = curveControls(200, 100, { x0: 0, y0: 0.5, x1: 1, y1: 0.5, a1: 60, k1: 0.5, a2: -60, k2: 0.5 });
    expect(Math.sign(50 - s.C1[1])).toBe(-Math.sign(50 - s.C2[1]));
  });
  it('hai đầu chỉnh độc lập: đổi đầu này không ảnh hưởng tay nắm đầu kia', () => {
    const p = { x0: 0, y0: 1, x1: 1, y1: 1, a1: 60, k1: 0.5, a2: 30, k2: 0.3 };
    const a = curveControls(200, 100, p), b = curveControls(200, 100, { ...p, a1: -20, k1: 1.2 });
    close(a.C2, b.C2);
    expect(b.C1).not.toEqual(a.C1);
  });
  it('kéo tay nắm đặt đúng hướng/độ cong; kéo đầu mút đặt đúng chỗ, tay nắm đi theo giữ dáng', () => {
    const s = mkCurve({ x0: 0.1, y0: 0.5, x1: 0.9, y1: 0.5, a1: 0, k1: 0.3, a2: 0, k2: 0.3 });
    const h0 = curveHandles(s);
    setCurveHandle(s, 'c1', h0.p0![0] + 50, h0.p0![1] - 50); // lên trên 45°
    expect(s.p.a1).toBe(45);
    setCurveHandle(s, 'p3', 500, 400);
    close(curveHandles(s).p3!, [500, 400], 1);
    close(curveHandles(s).p0!, h0.p0!, 1); // đầu kia đứng yên
    expect(s.p.a1).toBe(45); // dáng giữ nguyên
  });
  it('khung tự ôm sát đường cong mà không làm dời đường cong', () => {
    const s = mkCurve({ x0: 0.3, y0: 0.4, x1: 0.6, y1: 0.6, a1: 30, k1: 0.3, a2: 30, k2: 0.3 }, { r: 30, fx: -1 });
    const before = sampleCurve(curveControls(s.w, s.h, s.p), 8).map(([x, y]) => toWorldPt(s, x, y));
    refitCurve(s);
    const after = sampleCurve(curveControls(s.w, s.h, s.p), 8).map(([x, y]) => toWorldPt(s, x, y));
    before.forEach((p, i) => close(after[i], p, 1));
    expect(s.w).toBeLessThan(200);
    w2(s);
  });
  it('đổi tọa độ trang ↔ riêng khớp nhau kể cả khi xoay và lật', () => {
    const s = mkCurve({}, { r: 37, fx: -1, fy: -1 });
    const [lx, ly] = toLocal(s, 321, 45);
    close(toWorldPt(s, lx, ly), [321, 45]);
  });
});
function w2(s: Shape) { const pts = sampleCurve(curveControls(s.w, s.h, s.p), 16); for (const [x, y] of pts) { expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(s.w); expect(y).toBeLessThanOrEqual(s.h); } }

describe('parabol', () => {
  it('đỉnh cao đúng h × dây cung, nằm ở vị trí sk', () => {
    const c = curveControls(200, 200, { mode: 'parabol', x0: 0, y0: 1, x1: 1, y1: 1, h: 0.25, sk: 0.5 });
    const mid = sampleCurve(c, 2)[1];
    expect(mid[0]).toBeCloseTo(100);
    expect(200 - mid[1]).toBeCloseTo(0.25 * 200);
  });
  it('kéo đỉnh đổi độ cao và vị trí đỉnh', () => {
    const s = mkCurve({ mode: 'parabol', x0: 0.1, y0: 0.9, x1: 0.9, y1: 0.9, h: 0.3, sk: 0.5 });
    const h = curveHandles(s);
    expect(h.c1).toBeUndefined();
    setCurveHandle(s, 'q', (h.p0![0] + h.p3![0]) / 2 + 20, h.q![1] - 40);
    expect(s.p.sk).toBeGreaterThan(0.5);
    expect(s.p.h).toBeGreaterThan(0.3);
  });
});

describe('đầu mút và xuất file', () => {
  const line: [number, number][] = [[0, 0], [100, 0]];
  const box = (d: string) => { const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number); const ys = n.filter((_, i) => i % 2 === 1); return Math.max(...ys) - Math.min(...ys); };
  it('mỗi kiểu đầu mút cho ra hình khác nhau, không NaN', () => {
    const caps = ['round', 'butt', 'arrow', 'dot', 'point'] as const;
    const outs = caps.map((c) => strokeOutline(line, 6, c, c));
    for (const o of outs) expect(o).not.toMatch(/NaN|undefined|Infinity/);
    expect(new Set(outs).size).toBe(caps.length);
  });
  it('đầu nhọn thon về 0; mũi tên và chấm to hơn nét; cỡ đầu mút phóng được', () => {
    const pt = strokeOutline(line, 6, 'point', 'point');
    expect(pt).toMatch(/M0 0 L/); // đỉnh nhọn đúng tại đầu mút
    expect(box(strokeOutline(line, 6, 'butt', 'arrow'))).toBeGreaterThan(6);
    expect(box(strokeOutline(line, 6, 'butt', 'arrow', 1, ))).toBeLessThan(box(strokeOutline(line, 6, 'butt', 'arrow', 2)));
  });
  it('đường cong xuất ra là hình đặc, không stroke/marker; có trong thư viện và tìm được', () => {
    const st = new DocStore(null);
    for (const n of ['Đường cong', 'Cung parabol', 'Mũi tên cong', 'Cong hai mũi tên', 'Nét bút nhọn', 'Chấm nối mũi tên']) st.addFromLibrary(libItem(n)!);
    const svg = exportDocument(st.doc);
    expect(svg).not.toMatch(/stroke=|<marker|<mask|<filter|NaN/);
    expect((svg.match(/<path /g) || []).length).toBe(6);
    expect(searchLibrary('parabol')[0].n).toBe('Cung parabol');
    expect(searchLibrary('cong')[0].n).toMatch(/cong/i);
  });
  it('phóng to cả nhóm thì nét dày lên theo', () => {
    const s = mkCurve({ th: 4 });
    const out = [JSON.parse(JSON.stringify(s))];
    scaleShapes([s], out, 0, 0, 2, (t) => getShape(t).scaleParams ?? []);
    expect(out[0].p.th).toBe(8);
  });
  it('khung tự co khi đổi thanh trượt, hoàn tác được', () => {
    const st = new DocStore(null);
    const s = st.addFromLibrary(libItem('Đường cong')!, { x: 300, y: 300 });
    const ends = curveHandles(s);
    s.p.k1 = 1.5; st.emitChange(); st.commit();
    close(curveHandles(s).p0!, ends.p0!, 1); // đầu mút không bị dời
    st.undo();
    expect(st.doc.shapes[0].p.k1).toBe(0.45);
    expect(curvePath(100, 50, {})).not.toBe('');
    expect(shapeToSVG(s)).toContain('<path');
  });
});
