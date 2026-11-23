import { describe, expect, it } from 'vitest';
import { DocStore, migrateDoc } from '../src/core/store';
import { exportDocument, exportShapes } from '../src/core/export';
import { registerBuiltinShapes, shapeLabel } from '../src/shapes';
import { DOC_VERSION } from '../src/core/types';

registerBuiltinShapes();

const rect = { n: 'Chữ nhật', t: 'rrect', w: 100, h: 50, p: { r: 0 } };
function setup(n: number) {
  const st = new DocStore(null);
  const ids = Array.from({ length: n }, () => st.addFromLibrary(rect).id);
  return { st, ids, get: (id: number) => st.doc.shapes.find((s) => s.id === id)! };
}
const paths = (svg: string) => (svg.match(/<path /g) || []).length;

describe('tên lớp', () => {
  it('hình mới mang tên mẫu; đổi tên được; xóa trắng thì về tên mặc định', () => {
    const { st, ids, get } = setup(1);
    expect(shapeLabel(get(ids[0]))).toBe('Chữ nhật');
    st.rename(ids[0], '  Logo  ');
    expect(shapeLabel(get(ids[0]))).toBe('Logo');
    st.rename(ids[0], '   ');
    expect(get(ids[0]).name).toBeUndefined();
    expect(shapeLabel({ t: 'rrect' })).toBeTruthy(); // hình cũ không có tên vẫn có nhãn
  });

  it('đặt tên nhóm; bỏ nhóm thì xóa tên; nhân đôi nhóm giữ tên', () => {
    const { st, ids } = setup(2);
    st.selectMany(ids);
    const g = st.group()!;
    st.renameGroup(g, 'Tiêu đề');
    expect(st.doc.gnames?.[g]).toBe('Tiêu đề');
    st.duplicate();
    const g2 = st.selection[0].gid!;
    expect(st.doc.gnames?.[g2]).toBe('Tiêu đề');
    st.ungroup();
    expect(st.doc.gnames?.[g2]).toBeUndefined();
  });
});

describe('ẩn hình', () => {
  it('hình ẩn không xuất ra file và bị bỏ khỏi vùng chọn', () => {
    const { st, ids } = setup(3);
    st.selectAll();
    st.setHidden([ids[1]], true);
    expect(st.sel).not.toContain(ids[1]);
    expect(paths(exportDocument(st.doc))).toBe(2);
    expect(paths(exportShapes(st.doc.shapes))).toBe(2);
    st.setHidden([ids[1]], false);
    expect(paths(exportDocument(st.doc))).toBe(3);
  });

  it('không chọn được hình ẩn, kể cả bằng Ctrl+A', () => {
    const { st, ids } = setup(2);
    st.setHidden([ids[0]], true);
    st.select(ids[0]);
    expect(st.sel).toEqual([]);
    st.selectAll();
    expect(st.sel).toEqual([ids[1]]);
  });

  it('hoàn tác thao tác ẩn', () => {
    const { st, ids, get } = setup(1);
    st.setHidden(ids, true);
    st.undo();
    expect(get(ids[0]).hidden).toBeUndefined();
  });
});

describe('khóa hình', () => {
  it('hình khóa vẫn xuất ra file nhưng không chọn được', () => {
    const { st, ids } = setup(2);
    st.setLocked([ids[0]], true);
    expect(paths(exportDocument(st.doc))).toBe(2);
    st.select(ids[0]);
    expect(st.sel).toEqual([]);
    st.setLocked([ids[0]], false);
    st.select(ids[0]);
    expect(st.sel).toEqual([ids[0]]);
  });

  it('chọn nhóm có thành viên bị khóa chỉ chọn phần còn lại và vẫn coi là nhóm', () => {
    const { st, ids } = setup(3);
    st.selectMany(ids);
    const g = st.group();
    st.setLocked([ids[0]], true);
    st.select(ids[1]);
    expect(st.sel.sort()).toEqual([ids[1], ids[2]].sort());
    expect(st.selectedGroup).toBe(g);
  });
});

describe('nâng cấp dữ liệu', () => {
  it('tài liệu mọi phiên bản cũ đều mở được ở bản mới nhất', () => {
    for (let v = 1; v <= DOC_VERSION; v++) expect(migrateDoc({ v, shapes: [] })?.v).toBe(DOC_VERSION);
  });
});
