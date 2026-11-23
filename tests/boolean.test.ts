import { describe, expect, it } from 'vitest';
import { booleanRings, insideOperand, offsetRings, ringArea, shapeOperand, simplifyRing, type Operand, type Ring } from '../src/core/boolean';
import { defaultParams, registerBuiltinShapes } from '../src/shapes';
import type { Shape } from '../src/core/types';

registerBuiltinShapes();
const sq = (x: number, y: number, s: number): Operand => ({ parts: [{ rule: 'nonzero', rings: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s]]] }] });
/** Diện tích phần tô theo nonzero (các vòng đều có phần trong ở bên trái nên cộng đại số là đúng). */
const area = (rs: Ring[]) => Math.abs(rs.reduce((s, r) => s + ringArea(r), 0));
const mk = (t: string, x: number, y: number, w: number, h: number, p: Record<string, any> = {}, r = 0): Shape =>
  ({ id: 1, t, x, y, w, h, r, fx: 1, fy: 1, fill: '#000', stroke: '#000', sw: 0, op: 1, p: { ...defaultParams(t), ...p } });

describe('phép toán hình trên hai hình vuông chồng một nửa', () => {
  const A = sq(0, 0, 100), B = sq(50, 0, 100);
  it('hợp = 15 000, giao = 5 000, trừ = 5 000, loại trừ = 10 000', () => {
    expect(area(booleanRings([A, B], 'union'))).toBeCloseTo(15000, 3);
    expect(area(booleanRings([A, B], 'intersect'))).toBeCloseTo(5000, 3);
    expect(area(booleanRings([A, B], 'subtract'))).toBeCloseTo(5000, 3);
    expect(area(booleanRings([A, B], 'exclude'))).toBeCloseTo(10000, 3);
  });
  it('kết quả gọn: hợp hai hình chữ nhật chỉ còn 4 đỉnh', () => {
    const u = booleanRings([A, B], 'union');
    expect(u.length).toBe(1);
    expect(u[0].length).toBe(4);
  });
  it('hình rời nhau: giao rỗng, hợp giữ cả hai', () => {
    const C = sq(300, 300, 50);
    expect(booleanRings([A, C], 'intersect')).toEqual([]);
    expect(area(booleanRings([A, C], 'union'))).toBeCloseTo(12500, 3);
  });
  it('khoét lỗ: hình nhỏ nằm trong hình lớn, trừ ra hình có lỗ (tô đúng nhờ chiều ngược nhau)', () => {
    const big = sq(0, 0, 100), small = sq(25, 25, 50);
    const r = booleanRings([big, small], 'subtract');
    expect(r.length).toBe(2);
    expect(area(r)).toBeCloseTo(7500, 3);
    expect(Math.sign(ringArea(r[0]))).toBe(-Math.sign(ringArea(r[1])));
    expect(insideOperand({ parts: [{ rule: 'nonzero', rings: r }] }, [50, 50])).toBe(false);
    expect(insideOperand({ parts: [{ rule: 'nonzero', rings: r }] }, [10, 10])).toBe(true);
  });
  it('cạnh trùng khít và hình trùng hoàn toàn không làm hỏng kết quả', () => {
    expect(area(booleanRings([A, sq(100, 0, 100)], 'union'))).toBeCloseTo(20000, 3);
    expect(area(booleanRings([A, sq(0, 0, 100)], 'union'))).toBeCloseTo(10000, 3);
    expect(area(booleanRings([A, sq(0, 0, 100)], 'exclude'))).toBeCloseTo(0, 3);
  });
  it('nhiều hình: hợp ba hình, trừ hai hình khỏi hình dưới cùng', () => {
    const C = sq(25, 50, 100);
    expect(area(booleanRings([A, B, C], 'union'))).toBeCloseTo(15000 + 100 * 50, 3); // C thêm dải 100×50 bên dưới
    expect(area(booleanRings([sq(0, 0, 300), sq(0, 0, 100), sq(200, 200, 100)], 'subtract'))).toBeCloseTo(90000 - 20000, 3);
  });
});

describe('phép toán trên hình thật (đường cong, xoay, lỗ evenodd)', () => {
  it('hai hình tròn: hợp + giao = tổng diện tích (đúng tới 1%)', () => {
    const c1 = shapeOperand(mk('pie', 100, 100, 100, 100)), c2 = shapeOperand(mk('pie', 160, 100, 100, 100));
    const one = Math.PI * 50 * 50;
    const u = area(booleanRings([c1, c2], 'union')), i = area(booleanRings([c1, c2], 'intersect'));
    expect(u + i).toBeGreaterThan(2 * one * 0.99);
    expect(u + i).toBeLessThan(2 * one * 1.01);
  });
  it('vành khuyên (lỗ evenodd) được hiểu đúng; hình xoay vẫn đúng diện tích', () => {
    const ring = shapeOperand(mk('pie', 0, 0, 200, 200, { hole: 0.5 }));
    expect(area(booleanRings([ring], 'union'))).toBeCloseTo(Math.PI * (100 * 100 - 50 * 50), -2);
    const rot = shapeOperand(mk('rrect', 0, 0, 100, 40, { r: 0 }, 33));
    expect(area(booleanRings([rot], 'union'))).toBeCloseTo(4000, 3);
  });
  it('bỏ điểm thẳng hàng thừa mà không làm mất diện tích (kể cả đa giác tròn mịn)', () => {
    expect(simplifyRing([[0, 0], [50, 0], [100, 0], [100, 100], [0, 100]]).length).toBe(4);
    const circle: Ring = Array.from({ length: 400 }, (_, i) => [50 * Math.cos((i / 400) * 2 * Math.PI), 50 * Math.sin((i / 400) * 2 * Math.PI)]);
    const s = simplifyRing(circle);
    expect(s.length).toBeLessThan(200);
    expect(Math.abs(ringArea(s))).toBeGreaterThan(Math.abs(ringArea(circle)) * 0.995);
  });
});

describe('phình ra / co vào', () => {
  it('hình vuông 100 phình 10 → khoảng 120² trừ phần góc bo tròn; co 10 → 80²', () => {
    const A = sq(0, 0, 100);
    const grow = area(offsetRings(A, 10)), shrink = area(offsetRings(A, -10));
    expect(grow).toBeGreaterThan(14250); // 100² + 4·(100·10) + π·10² ≈ 14 314
    expect(grow).toBeLessThan(14400);
    expect(shrink).toBeCloseTo(6400, -1);
  });
});

import { DocStore } from '../src/core/store';
import { exportDocument } from '../src/core/export';
import { libItem } from '../src/shapes';
import { arrayPlaces, ringRadiusFor } from '../src/core/repeat';
import { cornerNodes, convertToPath, localParts, nodeCount } from '../src/core/pathedit';
import { bboxOf } from '../src/core/transform';

const opArea = (s: Shape) => area(booleanRings([shapeOperand(s)], 'union'));
const rect = (st: DocStore, x: number, y: number, w = 100, h = 100) => st.addFromLibrary({ n: 'Chữ nhật', t: 'rrect', w, h, p: { r: 0 } }, { x, y });

describe('phép toán hình trong DocStore', () => {
  it('hợp: thay các hình bằng một hình mới, giữ màu hình dưới cùng, nằm ở lớp hình trên cùng; hoàn tác được', () => {
    const st = new DocStore(null);
    const a = rect(st, 100, 100), mid = rect(st, 600, 600), b = rect(st, 150, 100);
    a.fill = '#AA0000';
    st.selectMany([a.id, b.id]);
    expect(st.booleanOp('union')).toBe(1);
    expect(st.doc.shapes.length).toBe(2);
    const res = st.selected!;
    expect(res.t).toBe('path');
    expect(res.fill).toBe('#AA0000');
    expect(st.doc.shapes.indexOf(res)).toBe(1); // trên hình "mid"
    expect(opArea(res)).toBeCloseTo(15000, 0);
    expect(exportDocument(st.doc)).not.toMatch(/NaN|stroke=|<mask|<filter/);
    st.undo();
    expect(st.doc.shapes.map((s) => s.id)).toEqual([a.id, mid.id, b.id]);
  });
  it('trừ: hình dưới trừ hình trên; kết quả rỗng thì báo −1 và không đổi gì; cần ≥ 2 hình', () => {
    const st = new DocStore(null);
    const a = rect(st, 100, 100), b = rect(st, 100, 100, 200, 200);
    st.selectMany([a.id, b.id]);
    expect(st.booleanOp('subtract')).toBe(-1);
    expect(st.doc.shapes.length).toBe(2);
    st.select(a.id);
    expect(st.booleanOp('union')).toBe(0);
  });
  it('đường nối dính vào hình bị gộp thì bị xóa theo', () => {
    const st = new DocStore(null);
    const a = rect(st, 100, 100), b = rect(st, 150, 100), c = rect(st, 500, 100);
    st.connect(b.id, c.id);
    st.selectMany([a.id, b.id]); st.booleanOp('union');
    expect(st.doc.shapes.some((s) => s.t === 'connector')).toBe(false);
  });
});

describe('phình/co, bo góc, vát góc', () => {
  it('phình ra làm hình to hơn, co vào làm nhỏ hơn', () => {
    const st = new DocStore(null);
    const a = rect(st, 100, 100); st.select(a.id);
    st.offsetSelection(10);
    expect(opArea(st.selected!)).toBeCloseTo(14314, -2);
    st.offsetSelection(-20); // 120 (góc bo r=10) co 20 → 80×80 góc vuông
    expect(opArea(st.selected!)).toBeCloseTo(6400, -1);
  });
  it('vát góc hình vuông: 4 góc thành 8 điểm, mất đúng 4 tam giác nhỏ', () => {
    const s: Shape = mk('rrect', 0, 0, 100, 100, { r: 0 });
    convertToPath(s);
    expect(cornerNodes(s, 'chamfer', 10)).toBe(4);
    expect(nodeCount(s)).toBe(8);
    expect(opArea(s)).toBeCloseTo(10000 - 4 * 50, 0);
  });
  it('bo góc tròn: diện tích ≈ hình vuông trừ phần góc (10² − π·10²/4 mỗi góc), giữ dạng cong', () => {
    const s: Shape = mk('rrect', 0, 0, 100, 100, { r: 0 });
    convertToPath(s);
    cornerNodes(s, 'round', 10);
    expect(opArea(s)).toBeCloseTo(10000 - 4 * (100 - Math.PI * 25), -1);
    expect(localParts(s)[0].subs[0].n.some((n) => n.o)).toBe(true);
  });
  it('chỉ bo những điểm được chọn; khoảng bo tự giới hạn theo cạnh ngắn', () => {
    const s: Shape = mk('tri', 0, 0, 100, 100);
    convertToPath(s);
    expect(cornerNodes(s, 'round', 9999, [{ pi: 0, si: 0, ni: 0 }])).toBe(1);
    expect(nodeCount(s)).toBe(4);
    const st = new DocStore(null);
    const t = st.addFromLibrary(libItem('Ngôi sao')!); st.select(t.id);
    expect(st.cornerSelection('round', 6)).toBe(10); // tự chuyển thành đường rồi bo 10 góc
    expect(st.selected!.t).toBe('path');
  });
});

describe('mảng lặp và đối xứng', () => {
  it('vị trí bản sao: hàng, lưới, vòng (bản gốc ở 12 giờ)', () => {
    expect(arrayPlaces('row', 3, 50, 20, 10)).toEqual([{ dx: 60, dy: 0, rot: 0 }, { dx: 120, dy: 0, rot: 0 }]);
    expect(arrayPlaces('grid', 4, 10, 10, 0)).toEqual([{ dx: 10, dy: 0, rot: 0 }, { dx: 0, dy: 10, rot: 0 }, { dx: 10, dy: 10, rot: 0 }]);
    const ring = arrayPlaces('ring', 4, 10, 10, 100, { rotate: true });
    expect(ring[1].dx).toBeCloseTo(0); expect(ring[1].dy).toBeCloseTo(200); expect(ring[1].rot).toBe(180);
    expect(ringRadiusFor(12, 40)).toBeGreaterThan(40);
  });
  it('tạo mảng vòng 6 bản quanh tâm, xoay theo vòng, gộp thành một nhóm; hoàn tác một lần là xong', () => {
    const st = new DocStore(null);
    const a = rect(st, 400, 100, 40, 60); st.select(a.id);
    expect(st.makeArray('ring', 6, 150, { rotate: true })).toBe(5);
    const list = st.selection;
    expect(list.length).toBe(6);
    expect(st.selectedGroup).toBeDefined();
    const rots = list.map((s) => s.r).sort((x, y) => x - y);
    expect(rots).toEqual([0, 60, 120, 180, 240, 300]);
    for (const s of list) expect(Math.hypot(s.x - 400, s.y - 250)).toBeCloseTo(150, 3);
    st.undo();
    expect(st.doc.shapes.length).toBe(1);
  });
  it('gương ngang: bản sao lật, nằm sát bên phải, đối xứng qua cạnh phải; hợp lại thành hình đối xứng', () => {
    const st = new DocStore(null);
    const t = st.addFromLibrary(libItem('Tam giác vuông')!, { x: 100, y: 100 }); st.select(t.id);
    const b0 = bboxOf([t]);
    expect(st.mirrorCopy('h')).toBe(1);
    const m = st.selected!;
    expect(m.fx).toBe(-1);
    expect(bboxOf([m]).x0).toBeCloseTo(b0.x1);
    st.selectMany([t.id, m.id]);
    expect(st.booleanOp('union')).toBe(1);
    const u = st.selected!;
    expect(u.w).toBeCloseTo(2 * (b0.x1 - b0.x0), 0);
  });
});
