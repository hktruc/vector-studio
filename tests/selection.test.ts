import { describe, expect, it } from 'vitest';
import { DocStore, migrateDoc } from '../src/core/store';
import { exportDocument, exportShapes } from '../src/core/export';
import { bboxOf, moveShapes, rotateShapes, scaleShapes } from '../src/core/transform';
import { getShape, registerBuiltinShapes } from '../src/shapes';
import { DOC_VERSION, type Shape } from '../src/core/types';

registerBuiltinShapes();

const rect = { n: 'r', t: 'rrect', w: 100, h: 50, p: { r: 0 } };
/** Tạo store có n hình chữ nhật, trả về store và danh sách id. */
function setup(n: number) {
  const st = new DocStore(null);
  const ids = Array.from({ length: n }, () => st.addFromLibrary(rect).id);
  return { st, ids };
}
const order = (st: DocStore) => st.doc.shapes.map((s) => s.id);

describe('chọn nhiều hình', () => {
  it('Shift+bấm thêm/bớt, chọn tất cả, bỏ chọn', () => {
    const { st, ids } = setup(3);
    st.select(ids[0]);
    st.toggle(ids[2]);
    expect(st.sel.sort()).toEqual([ids[0], ids[2]].sort());
    expect(st.selected).toBeUndefined(); // nhiều hình → không còn "một hình đang chọn"
    st.toggle(ids[0]);
    expect(st.selected?.id).toBe(ids[2]);
    st.selectAll(); expect(st.sel.length).toBe(3);
    st.select(null); expect(st.sel).toEqual([]);
  });

  it('xóa và nhân đôi áp dụng cho cả vùng chọn', () => {
    const { st, ids } = setup(3);
    st.selectMany([ids[0], ids[1]]);
    st.duplicate();
    expect(st.doc.shapes.length).toBe(5);
    expect(st.sel.length).toBe(2);
    expect(st.sel).not.toContain(ids[0]);
    st.remove();
    expect(st.doc.shapes.length).toBe(3);
  });
});

describe('nhóm / bỏ nhóm', () => {
  it('nhóm gom các hình liền nhau, chọn một thành viên là chọn cả nhóm', () => {
    const { st, ids } = setup(4);
    st.selectMany([ids[0], ids[2]]);
    const gid = st.group();
    expect(gid).toBeDefined();
    // ids[0] được đưa lên sát ids[2] (vị trí thành viên trên cùng)
    expect(order(st)).toEqual([ids[1], ids[0], ids[2], ids[3]]);
    st.select(null);
    st.select(ids[2]);
    expect(st.sel.sort()).toEqual([ids[0], ids[2]].sort());
    expect(st.selectedGroup).toBe(gid);
  });

  it('cần ít nhất 2 hình để nhóm; bỏ nhóm trả về hình lẻ; hoàn tác được', () => {
    const { st, ids } = setup(3);
    st.select(ids[0]);
    expect(st.group()).toBeUndefined();
    st.selectMany(ids);
    st.group();
    expect(st.doc.shapes.every((s) => s.gid !== undefined)).toBe(true);
    st.ungroup();
    expect(st.doc.shapes.every((s) => s.gid === undefined)).toBe(true);
    st.undo();
    expect(st.doc.shapes.every((s) => s.gid !== undefined)).toBe(true);
  });

  it('nhân đôi nhóm tạo ra nhóm mới riêng biệt', () => {
    const { st, ids } = setup(2);
    st.selectMany(ids);
    const g1 = st.group();
    st.duplicate();
    const g2 = st.selection[0].gid;
    expect(g2).toBeDefined();
    expect(g2).not.toBe(g1);
    expect(st.selectedGroup).toBe(g2);
  });

  it('đổi lớp di chuyển nguyên cả nhóm, không chen vào giữa nhóm khác', () => {
    const { st, ids } = setup(4); // [a b c d]
    st.selectMany([ids[1], ids[2]]); st.group(); // [a (b c) d]
    st.select(ids[0]);
    st.moveLayer(1); // a nhảy qua cả nhóm (b c)
    expect(order(st)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
    st.select(ids[1]);
    st.moveLayer('top');
    expect(order(st)).toEqual([ids[0], ids[3], ids[1], ids[2]]);
    st.moveLayer('bottom');
    expect(order(st)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
  });

  it('xuất SVG bọc nhóm trong một thẻ <g> và xuất được vùng chọn', () => {
    const { st, ids } = setup(3);
    st.selectMany([ids[0], ids[1]]); st.group();
    const svg = exportDocument(st.doc);
    expect(svg).toMatch(/<g><g transform=[^]*?<\/g><g transform=[^]*?<\/g><\/g>/);
    expect((svg.match(/<path /g) || []).length).toBe(3);
    const part = exportShapes(st.selection);
    expect((part.match(/<path /g) || []).length).toBe(2);
    expect(part).not.toMatch(/marker|mask|filter/);
  });
});

describe('biến đổi nhiều hình', () => {
  const mk = (x: number, y: number, extra: Partial<Shape> = {}): Shape =>
    ({ id: 1, t: 'rrect', x, y, w: 100, h: 50, r: 0, fx: 1, fy: 1, fill: '#000', stroke: '#000', sw: 2, op: 1, p: { r: 0 }, ...extra });

  it('dời giữ nguyên khoảng cách giữa các hình', () => {
    const s0 = [mk(100, 100), mk(300, 200)], out = JSON.parse(JSON.stringify(s0));
    moveShapes(s0, out, 15, -5);
    expect(out[0]).toMatchObject({ x: 115, y: 95 });
    expect(out[1]).toMatchObject({ x: 315, y: 195 });
  });

  it('phóng đều quanh điểm neo: kích thước, viền và cỡ chữ cùng nhân hệ số', () => {
    const s0 = [mk(100, 100), mk(200, 100, { t: 'text', p: { text: 'A', size: 20, bold: 1 } })];
    const out = JSON.parse(JSON.stringify(s0));
    scaleShapes(s0, out, 0, 0, 2, (t) => getShape(t).scaleParams ?? []);
    expect(out[0]).toMatchObject({ x: 200, y: 200, w: 200, h: 100, sw: 4 });
    expect(out[1].x).toBe(400);
    expect(out[1].p.size).toBe(40);
    expect(s0[1].p.size).toBe(20); // ảnh chụp gốc không bị sửa
  });

  it('xoay 90° quanh tâm: vị trí quay quanh tâm và góc cộng thêm', () => {
    const s0 = [mk(150, 100, { r: 30 })], out = JSON.parse(JSON.stringify(s0));
    rotateShapes(s0, out, 100, 100, 90);
    expect(out[0].x).toBeCloseTo(100);
    expect(out[0].y).toBeCloseTo(150);
    expect(out[0].r).toBe(120);
    const before = bboxOf(s0), after = bboxOf(out);
    expect(after.x1 - after.x0).toBeCloseTo(before.y1 - before.y0);
  });
});

describe('nâng cấp dữ liệu', () => {
  it('tài liệu v1 cũ được nâng lên bản mới nhất và vẫn mở được', () => {
    const v1 = { v: 1, cw: 1280, ch: 720, sizeIdx: 0, seq: 3, shapes: [{ id: 1, t: 'rrect', x: 1, y: 1, w: 10, h: 10, r: 0, fx: 1, fy: 1, fill: '#000', stroke: '#000', sw: 0, op: 1, p: { r: 0 } }] };
    expect(migrateDoc(v1)?.v).toBe(DOC_VERSION);
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    mem.set('vector-studio-doc-v1', JSON.stringify(v1));
    const st = new DocStore(storage);
    expect(st.doc.v).toBe(DOC_VERSION);
    expect(st.doc.shapes.length).toBe(1);
  });
  it('dữ liệu hỏng hoặc phiên bản lạ thì bỏ qua', () => {
    expect(migrateDoc(null)).toBeNull();
    expect(migrateDoc({ v: 99, shapes: [] })).toBeNull();
    expect(migrateDoc({ v: 1 })).toBeNull();
  });
});
