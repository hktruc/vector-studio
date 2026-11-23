import { describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { exportDocument } from '../src/core/export';
import { applyHandle, clampParam, handlePositions, handlesOf } from '../src/core/handles';
import { arcToCubics, bezierAt, parsePath, pathToD } from '../src/core/pathdata';
import { bendSegment, deleteNode, insertNode, localParts, moveHandle, moveNode, nearestSegment, nodeCount, pathNodesWorld, segmentLocal, toggleSmooth } from '../src/core/pathedit';
import { LIBRARY, allShapes, defaultParams, getShape, libItem, partsOf, registerBuiltinShapes } from '../src/shapes';
import type { Shape } from '../src/core/types';

registerBuiltinShapes();
const mk = (t: string, p: Record<string, any> = {}, extra: Partial<Shape> = {}): Shape =>
  ({ id: 1, t, x: 300, y: 200, w: 200, h: 120, r: 0, fx: 1, fy: 1, fill: '#123456', stroke: '#000', sw: 0, op: 1, p: { ...defaultParams(t), ...p }, ...extra });
const noBad = (s: string) => expect(s).not.toMatch(/NaN|undefined|Infinity/);

describe('tay nắm thông số', () => {
  it('mọi tay nắm của mọi mẫu: vị trí hợp lệ, kéo về đúng chỗ thì thông số gần như không đổi', () => {
    let count = 0;
    for (const g of LIBRARY) for (const it of g.items) {
      const s = mk(it.t, it.p, { w: it.w, h: it.h, r: 25 });
      handlePositions(s).forEach(([x, y], i) => {
        count++;
        expect(isFinite(x) && isFinite(y), `${it.n} #${i}`).toBe(true);
        const before = { ...s.p };
        applyHandle(s, i, x, y);
        for (const k of Object.keys(before)) if (typeof before[k] === 'number') expect(s.p[k], `${it.n} ${k}`).toBeCloseTo(before[k], 1);
      });
    }
    expect(count).toBeGreaterThan(30);
  });
  it('quạt: kéo cạnh cuối đổi độ rộng cung, kéo cạnh đầu giữ nguyên cạnh cuối; Shift bắt bước 15°', () => {
    const s = mk('pie', { start: 0, sweep: 90 }, { w: 200, h: 200 });
    applyHandle(s, 1, 300 - 100, 200, false); // 9 giờ = 270°
    expect(s.p.sweep).toBe(270);
    applyHandle(s, 0, 300 + 100, 200, false); // kéo cạnh đầu tới 3 giờ = 90°
    expect(s.p.start).toBe(90);
    expect(s.p.start + s.p.sweep).toBe(270);
    applyHandle(s, 1, 300 + 70, 200 + 75, true);
    expect(s.p.sweep % 15).toBe(0);
  });
  it('mũi tên: một tay nắm đổi cả độ dài đầu và độ dày thân; giá trị được kẹp trong khoảng', () => {
    const s = mk('arrow');
    const [x0, y0] = handlePositions(s)[0];
    applyHandle(s, 0, x0 - 40, y0 - 10);
    expect(s.p.head).toBeCloseTo(0.5);
    expect(s.p.shaft).toBeGreaterThan(0.5);
    applyHandle(s, 0, -9999, -9999);
    expect(s.p.head).toBe(0.7); // max
    expect(clampParam({ k: 'n', l: '', min: 1, max: 8, step: 1, def: 4 }, 3.6)).toBe(4);
  });
  it('kim tự tháp: kéo ranh tầng lên để thêm tầng (số nguyên)', () => {
    const s = mk('pyramid', { n: 4 }, { h: 240 });
    const [x] = handlePositions(s)[0];
    applyHandle(s, 0, x, 200 - 120 + 240 / 6);
    expect(s.p.n).toBe(6);
  });
  it('tay nắm đúng cả khi hình bị xoay và lật', () => {
    const s = mk('rrect', { r: 0.2 }, { r: 90, fx: -1 });
    const [x, y] = handlePositions(s)[0];
    applyHandle(s, 0, x, y);
    expect(s.p.r).toBeCloseTo(0.2);
  });
  it('hình không có tay nắm thì không làm gì', () => {
    expect(handlesOf('text')).toEqual([]);
    expect(applyHandle(mk('rtri'), 0, 0, 0)).toBe(false);
  });
});

describe('đọc/ghi dữ liệu đường', () => {
  it('đọc M L H V Z (hoa và thường), gộp điểm cuối trùng điểm đầu', () => {
    const s = parsePath('M0 0 H10 v10 l-10 0 Z m20 20 L30 20');
    expect(s.length).toBe(2);
    expect(s[0].c).toBe(true);
    expect(s[0].n.map((n) => [n.x, n.y])).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(s[1].n.map((n) => [n.x, n.y])).toEqual([[20, 20], [30, 20]]);
  });
  it('cung tròn (A) đổi sang Bézier khớp đường tròn', () => {
    const cs = arcToCubics(0, 50, 50, 50, 0, 1, 1, 100, 50); // nửa trên đường tròn tâm (50,50)
    expect(cs.length).toBe(2);
    for (const c of cs) {
      const prev = cs.indexOf(c) === 0 ? [0, 50] as [number, number] : cs[cs.indexOf(c) - 1][2];
      const mid = bezierAt([prev, c[0], c[1], c[2]], 0.5);
      expect(Math.hypot(mid[0] - 50, mid[1] - 50)).toBeCloseTo(50, 0);
    }
  });
  it('ghi rồi đọc lại cho cùng kết quả; Q, S, T được hỗ trợ', () => {
    const d = 'M0 0 C10 0 20 10 20 20 S30 40 40 40 Q50 50 60 40 T80 40 Z';
    const a = parsePath(d), once = pathToD(a), twice = pathToD(parsePath(once));
    expect(twice).toBe(once);
    expect(a[0].n.length).toBe(5);
  });
});

describe('chuyển hình thành đường, sửa điểm neo', () => {
  const conv = (name: string) => { const st = new DocStore(null); const s = st.addFromLibrary(libItem(name)!, { x: 300, y: 300 }); st.convertToPath(); return { st, s: st.doc.shapes.find((x) => x.id === s.id)! }; };

  it('mọi mẫu trong thư viện (trừ chữ) chuyển được thành đường mà gần như không đổi dáng', () => {
    for (const g of LIBRARY) for (const it of g.items) {
      if (it.t === 'text') continue;
      const st = new DocStore(null);
      const s = st.addFromLibrary(it, { x: 400, y: 300 });
      s.r = 20; // kiểm tra cả khi hình đang xoay
      // điểm neo đầu tiên của hình gốc, tính trên trang
      const first = parsePath(partsOf(s.t, s.w, s.h, s.p).find((p) => p.d)!.d!)[0].n[0];
      const c = Math.cos(Math.PI / 9), n = Math.sin(Math.PI / 9), ax = first.x - s.w / 2, ay = first.y - s.h / 2;
      const want = [s.x + ax * c - ay * n, s.y + ax * n + ay * c];
      expect(st.convertToPath(), it.n).toBe(1);
      expect(s.t).toBe('path');
      noBad(exportDocument(st.doc));
      const got = pathNodesWorld(s)[0].p;
      expect(Math.hypot(got[0] - want[0], got[1] - want[1]), it.n).toBeLessThan(0.5); // hình đứng yên trên trang
    }
  });
  it('chưa sửa thì quay lại hình có thông số được; đã sửa thì không', () => {
    const { st, s } = conv('Tròn');
    expect(st.revertPath(s.id)).toBe(true);
    expect(s.t).toBe('pie');
    st.select(s.id); st.convertToPath();
    const n = pathNodesWorld(s)[0];
    moveNode(s, n.ref, n.p[0] + 30, n.p[1]);
    expect(st.revertPath(s.id)).toBe(false);
  });
  it('dời điểm neo đúng chỗ trên trang (kể cả khi xoay), khung tự ôm sát', () => {
    const { s } = conv('Chữ nhật');
    s.r = 30;
    const n = pathNodesWorld(s)[0];
    moveNode(s, n.ref, n.p[0] - 50, n.p[1] - 40);
    const m = pathNodesWorld(s)[0];
    expect(m.p[0]).toBeCloseTo(n.p[0] - 50, 3); expect(m.p[1]).toBeCloseTo(n.p[1] - 40, 3);
    for (const pt of localParts(s)) for (const sp of pt.subs) for (const q of sp.n) { expect(q.x).toBeGreaterThanOrEqual(-0.01); expect(q.y).toBeGreaterThanOrEqual(-0.01); }
  });
  it('thêm điểm giữa cạnh không đổi dáng; xóa điểm; giới hạn tối thiểu', () => {
    const { s } = conv('Tam giác');
    expect(nodeCount(s)).toBe(3);
    const near = nearestSegment(s, s.x, s.y + s.h / 2); // gần cạnh đáy
    const r = insertNode(s, near.pi, near.si, near.k, 0.5)!;
    expect(nodeCount(s)).toBe(4);
    expect(deleteNode(s, r)).toBe(true);
    expect(deleteNode(s, { pi: 0, si: 0, ni: 0 })).toBe(false); // tam giác khép kín cần ≥ 3 điểm
  });
  it('điểm trơn: kéo một tay nắm thì tay nắm kia xoay theo thẳng hàng', () => {
    const { s } = conv('Vuông');
    const n0 = pathNodesWorld(s)[1];
    toggleSmooth(s, n0.ref);
    const n = pathNodesWorld(s)[1];
    expect(n.smooth && n.i && n.o).toBeTruthy();
    moveHandle(s, n.ref, 'o', n.p[0] + 10, n.p[1] + 60);
    const m = pathNodesWorld(s)[1];
    const v1 = [m.o![0] - m.p[0], m.o![1] - m.p[1]], v2 = [m.i![0] - m.p[0], m.i![1] - m.p[1]];
    expect(v1[0] * v2[1] - v1[1] * v2[0]).toBeCloseTo(0, 3); // thẳng hàng
    expect(v1[0] * v2[0] + v1[1] * v2[1]).toBeLessThan(0); // ngược chiều
    toggleSmooth(s, m.ref);
    expect(pathNodesWorld(s)[1].i).toBeUndefined();
  });
  it('kéo cạnh để uốn cong: điểm đang kéo đi đúng theo chuột', () => {
    const { s } = conv('Chữ nhật');
    const cx = s.x, top = s.y - s.h / 2;
    const near = nearestSegment(s, cx, top); // cạnh trên
    const q0 = segmentLocal(s, near.pi, near.si, near.k)!;
    bendSegment(s, near.pi, near.si, near.k, near.t, q0, 0, -40);
    const after = nearestSegment(s, cx, top - 40);
    expect(after.dist).toBeLessThan(2);
    expect(exportDocument({ v: 6, cw: 800, ch: 600, sizeIdx: 0, seq: 9, shapes: [s] } as any)).toMatch(/ C/);
  });
  it('hình nhiều mảng sáng tối (khối 3D) giữ nguyên độ sáng tối khi chuyển', () => {
    const { s } = conv('Khối 3D');
    expect(s.p.parts.map((p: any) => p.sh)).toEqual(partsOf('cube', 160, 160, defaultParams('cube')).map((p) => p.shade || 0));
    expect(getShape('path').refit).toBeTruthy();
  });
  it('chữ, ảnh, đường nối không chuyển được', () => {
    const st = new DocStore(null);
    st.addFromLibrary(libItem('Văn bản')!);
    expect(st.convertToPath()).toBe(0);
    expect(allShapes().some((d) => d.type === 'path')).toBe(true);
  });
});
