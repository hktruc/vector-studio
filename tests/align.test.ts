import { describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { snapToGuides } from '../src/core/align';
import { bboxOf } from '../src/core/transform';
import { registerBuiltinShapes } from '../src/shapes';

registerBuiltinShapes();

/** Tạo store với các hình chữ nhật đặt tại các vị trí cho trước (tâm x, y, rộng w, cao h). */
function setup(specs: [number, number, number, number][]) {
  const st = new DocStore(null);
  const shapes = specs.map(([x, y, w, h]) => {
    const s = st.addFromLibrary({ n: 'r', t: 'rrect', w, h, p: { r: 0 } });
    s.x = x; s.y = y;
    return s;
  });
  return { st, shapes };
}

describe('căn chỉnh', () => {
  it('căn trái / phải / giữa theo khung bao của vùng chọn', () => {
    const { st, shapes: [a, b] } = setup([[100, 100, 40, 40], [300, 200, 100, 20]]);
    st.selectMany([a.id, b.id]);
    st.align('left');
    expect(bboxOf([a]).x0).toBe(80);
    expect(bboxOf([b]).x0).toBe(80);
    st.align('right');
    expect(bboxOf([a]).x1).toBe(180); // cạnh phải của hình rộng nhất (80 + 100)
    expect(bboxOf([b]).x1).toBe(180);
    st.align('vcenter');
    expect(a.y).toBe(b.y);
  });

  it('chỉ chọn một hình thì căn theo trang', () => {
    const { st, shapes: [a] } = setup([[100, 100, 40, 40]]);
    st.select(a.id);
    st.align('hcenter'); st.align('vcenter');
    expect(a.x).toBe(st.doc.cw / 2);
    expect(a.y).toBe(st.doc.ch / 2);
    st.align('bottom');
    expect(bboxOf([a]).y1).toBe(st.doc.ch);
  });

  it('nhóm được căn nguyên khối, không bị xô lệch bên trong', () => {
    const { st, shapes: [a, b, c] } = setup([[100, 100, 40, 40], [200, 100, 40, 40], [400, 300, 40, 40]]);
    st.selectMany([a.id, b.id]); st.group();
    st.selectAll();
    st.align('top');
    expect(a.x).toBe(100); expect(b.x).toBe(200); // khoảng cách trong nhóm giữ nguyên
    expect(a.y).toBe(b.y);
    expect(bboxOf([c]).y0).toBe(80);
    expect(bboxOf([a]).y0).toBe(80);
  });

  it('hoàn tác được thao tác căn', () => {
    const { st, shapes: [a, b] } = setup([[100, 100, 40, 40], [300, 200, 40, 40]]);
    st.commit();
    st.selectMany([a.id, b.id]);
    st.align('left');
    st.undo();
    expect(st.doc.shapes.map((s) => s.x)).toEqual([100, 300]);
  });
});

describe('phân bố đều', () => {
  it('khoảng trống giữa các hình bằng nhau, hai hình ngoài cùng đứng yên', () => {
    const { st, shapes } = setup([[50, 100, 20, 20], [90, 100, 60, 20], [400, 100, 40, 20], [300, 100, 20, 20]]);
    st.selectAll();
    expect(st.distribute('h')).toBe(true);
    const bs = shapes.map((s) => bboxOf([s])).sort((p, q) => p.x0 - q.x0);
    expect(bs[0].x0).toBe(40);
    expect(bs[3].x1).toBe(420);
    const gaps = bs.slice(1).map((b, i) => b.x0 - bs[i].x1);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]);
  });

  it('cần ít nhất 3 khối (nhóm tính là một khối)', () => {
    const { st, shapes: [a, b, c] } = setup([[50, 50, 20, 20], [100, 50, 20, 20], [300, 50, 20, 20]]);
    st.selectMany([a.id, b.id]); st.group();
    st.selectAll();
    expect(st.selectionUnits).toBe(2);
    expect(st.distribute('h')).toBe(false);
    expect(c.x).toBe(300);
  });
});

describe('đường gióng', () => {
  const page = { x0: 0, y0: 0, x1: 1000, y1: 600 };

  it('hít vào cạnh trái của hình khác khi lệch trong ngưỡng', () => {
    const other = { x0: 200, y0: 50, x1: 300, y1: 100 };
    const r = snapToGuides({ x0: 204, y0: 300, x1: 254, y1: 340 }, [other], page, 6);
    expect(r.dx).toBe(-4);
    expect(r.guides.some((g) => g.dir === 'v' && g.at === 200 && g.a === 50 && g.b === 340)).toBe(true);
  });

  it('hít vào giữa trang', () => {
    const r = snapToGuides({ x0: 448, y0: 10, x1: 548, y1: 60 }, [], page, 6);
    expect(r.dx).toBe(2); // tâm 498 → 500
  });

  it('ngoài ngưỡng thì không bắt và không vẽ gì', () => {
    const r = snapToGuides({ x0: 120, y0: 120, x1: 170, y1: 170 }, [{ x0: 400, y0: 400, x1: 450, y1: 450 }], page, 6);
    expect(r.dx).toBeNull();
    expect(r.dy).toBeNull();
    expect(r.guides).toEqual([]);
  });

  it('chọn độ dời gần nhất khi có nhiều ứng viên', () => {
    const r = snapToGuides({ x0: 103, y0: 300, x1: 153, y1: 350 }, [{ x0: 100, y0: 0, x1: 150, y1: 50 }, { x0: 105, y0: 0, x1: 120, y1: 20 }], page, 6);
    expect(r.dx).toBe(2);
  });
});
