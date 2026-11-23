import { describe, expect, it } from 'vitest';
import { DocStore, migrateDoc } from '../src/core/store';
import { exportDocument, shapeToSVG } from '../src/core/export';
import { bboxOf } from '../src/core/transform';
import { contrastText, fitText, textWidth, wrapText } from '../src/core/text';
import { clipToBox, routeConnector, strokeOutline, syncConnectors } from '../src/core/connect';
import { layoutGrid, layoutRing, layoutTree } from '../src/core/layout';
import { fold, libItem, registerBuiltinShapes, searchLibrary } from '../src/shapes';
import { DOC_VERSION } from '../src/core/types';

registerBuiltinShapes();
const rect = { n: 'Chữ nhật', t: 'rrect', w: 100, h: 60, p: { r: 0 } };
const noBad = (s: string) => expect(s).not.toMatch(/NaN|undefined|Infinity/);

describe('chữ tự co vừa khung', () => {
  it('chữ dài thì nhỏ lại và xuống dòng, vẫn nằm gọn trong khung', () => {
    const short = fitText('Ý tưởng', 200, 100);
    const long = fitText('Một ý tưởng rất dài cần nhiều dòng để hiển thị hết nội dung', 200, 100);
    expect(long.size).toBeLessThan(short.size);
    expect(long.lines.length).toBeGreaterThan(1);
    for (const l of long.lines) expect(textWidth(l, long.size, false)).toBeLessThanOrEqual(200 * 0.76 + 0.01);
    expect(long.lines.length * long.size * 1.2).toBeLessThanOrEqual(100 * 0.76 + 0.01);
  });
  it('thu nhỏ chữ để không cắt giữa từ', () => {
    const r = fitText('Nhánh 1', 120, 120, { bold: true, pad: 0.2 });
    expect(r.lines.join(' ')).toBe('Nhánh 1');
    for (const l of r.lines) expect(l.split(' ').every((w) => ['Nhánh', '1'].includes(w))).toBe(true);
  });
  it('giữ xuống dòng người dùng gõ; cắt được từ quá dài', () => {
    expect(wrapText('a\nb', 20, 500)).toEqual(['a', 'b']);
    const parts = wrapText('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 20, 100);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join('')).toBe('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  });
  it('màu chữ tự tương phản với màu tô', () => {
    expect(contrastText('#12497A')).toBe('#FFFFFF');
    expect(contrastText('#FFCC00')).toBe('#1B2A3A');
  });
  it('chữ trên hình xuất dạng <text>, không bị lật theo hình', () => {
    const st = new DocStore(null);
    const s = st.addFromLibrary(rect);
    st.setLabel(s.id, 'Bán hàng & <Tiếp thị>');
    s.fx = -1;
    const svg = shapeToSVG(s);
    expect(svg).toContain('<text');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;Tiếp');
    expect(svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).toContain('Bán hàng &amp; &lt;Tiếp thị&gt;');
    expect(svg).toMatch(/scale\(-1 1\)"><text/); // bù lại phép lật
    st.setLabel(s.id, '   ');
    expect(s.label).toBeUndefined();
  });
  it('hình chữ tự giãn theo nội dung; không cho để trống', () => {
    const st = new DocStore(null);
    const t = st.addFromLibrary(libItem('Văn bản')!);
    const w0 = t.w;
    st.setLabel(t.id, 'Một tiêu đề dài hơn nhiều so với ban đầu');
    expect(t.w).toBeGreaterThan(w0);
    st.setLabel(t.id, '');
    expect(t.p.text).toBe('Văn bản');
  });
});

describe('đường nối', () => {
  const A = { x0: 0, y0: 0, x1: 100, y1: 50 }, B = { x0: 300, y0: 0, x1: 400, y1: 50 };
  it('đường thẳng bắt đầu và kết thúc ở cạnh hình (chừa khe nhỏ)', () => {
    expect(clipToBox(A, [1000, 25])).toEqual([104, 25]);
    const pts = routeConnector(A, B, 'straight');
    expect(pts).toEqual([[104, 25], [296, 25]]);
  });
  it('gấp khúc chỉ đi ngang/dọc; cong đi từ cạnh tới cạnh', () => {
    const C = { x0: 300, y0: 200, x1: 400, y1: 250 };
    const el = routeConnector(A, C, 'elbow');
    for (let i = 1; i < el.length; i++) expect(el[i][0] === el[i - 1][0] || el[i][1] === el[i - 1][1]).toBe(true);
    const cv = routeConnector(A, C, 'curve');
    expect(cv[0]).toEqual([104, 25]);
    expect(cv[cv.length - 1]).toEqual([296, 225]);
  });
  it('nét được chuyển thành hình đặc, có mũi tên, không NaN', () => {
    const d = strokeOutline([[0, 0], [100, 0], [100, 100]], 4, 'dot', 'arrow');
    noBad(d);
    expect(d.split('M').length - 1).toBeGreaterThanOrEqual(5); // 2 đoạn + khớp + chấm + mũi tên
    expect(strokeOutline([[0, 0]], 4)).toBe('');
  });
  it('nối hai hình; kéo hình thì đường nối đi theo; xóa hình thì xóa đường nối', () => {
    const st = new DocStore(null);
    const a = st.addFromLibrary(rect, { x: 100, y: 100 }), b = st.addFromLibrary(rect, { x: 400, y: 100 });
    const c = st.connect(a.id, b.id)!;
    expect(st.doc.shapes[0]).toBe(c); // nằm dưới cùng
    const x0 = c.x;
    b.x += 200; b.y += 150; st.emitChange();
    expect(c.x).toBeGreaterThan(x0);
    const svg = exportDocument(st.doc);
    expect(svg).not.toMatch(/<marker|<mask|<filter|stroke-dasharray/);
    noBad(svg);
    st.select(b.id); st.remove();
    expect(st.doc.shapes.find((s) => s.t === 'connector')).toBeUndefined();
  });
  it('không nối hình với chính nó hoặc với đường nối', () => {
    const st = new DocStore(null);
    const a = st.addFromLibrary(rect), b = st.addFromLibrary(rect);
    const c = st.connect(a.id, b.id)!;
    expect(st.connect(a.id, a.id)).toBeUndefined();
    expect(st.connect(a.id, c.id)).toBeUndefined();
  });
});

describe('Tab: hình kế tiếp và nối', () => {
  it('tạo hình giống hình gốc ở chỗ trống bên phải, nối lại, chọn hình mới', () => {
    const st = new DocStore(null);
    const a = st.addFromLibrary(rect, { x: 200, y: 200 });
    st.setLabel(a.id, 'Gốc');
    const n = st.addNext()!;
    expect(n.t).toBe(a.t);
    expect(n.label).toBeUndefined();
    expect(n.x).toBeGreaterThan(a.x + a.w);
    expect(n.y).toBe(a.y);
    expect(st.sel).toEqual([n.id]);
    const conn = st.doc.shapes.find((s) => s.t === 'connector')!;
    expect([conn.p.a, conn.p.b]).toEqual([a.id, n.id]);
  });
  it('Tab lần nữa từ hình gốc không đè lên hình đã có', () => {
    const st = new DocStore(null);
    const a = st.addFromLibrary(rect, { x: 200, y: 200 });
    const n1 = st.addNext(a.id)!, n2 = st.addNext(a.id)!;
    const b1 = bboxOf([n1]), b2 = bboxOf([n2]);
    expect(b1.x1 < b2.x0 || b2.x1 < b1.x0 || b1.y1 < b2.y0 || b2.y1 < b1.y0).toBe(true);
    expect(st.doc.shapes.filter((s) => s.t === 'connector').length).toBe(2);
  });
});

describe('tự bố trí', () => {
  const box = (x: number, y: number) => ({ x0: x, y0: y, x1: x + 100, y1: y + 50 });
  it('lưới: số cột ≈ căn bậc hai, không chồng nhau', () => {
    const pos = layoutGrid([box(0, 0), box(500, 300), box(30, 10), box(900, 0), box(10, 600)]);
    const keys = new Set(pos.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(5);
    expect(new Set(pos.map((p) => p.x)).size).toBe(3);
  });
  it('cây: con ở cột bên phải, cha nằm giữa các con', () => {
    const nodes = [box(0, 0), box(0, 100), box(0, 200), box(0, 300)];
    const pos = layoutTree(nodes, [[0, 1], [0, 2], [2, 3]]);
    expect(pos[1].x).toBeGreaterThan(pos[0].x);
    expect(pos[3].x).toBeGreaterThan(pos[2].x);
    expect(pos[0].y).toBeCloseTo((pos[1].y + pos[2].y) / 2);
  });
  it('vòng: nút có nhiều nhánh ở giữa, các nút khác cách tâm bằng nhau', () => {
    const nodes = [box(0, 0), box(200, 0), box(0, 200), box(200, 200), box(400, 100)];
    const pos = layoutRing(nodes, [[4, 0], [4, 1], [4, 2], [4, 3]]);
    const c = pos[4];
    const d = [0, 1, 2, 3].map((i) => Math.hypot(pos[i].x - c.x, pos[i].y - c.y));
    for (const x of d) expect(x).toBeCloseTo(d[0]);
  });
  it('bố trí trong DocStore dời cả hình lẫn đường nối, hoàn tác được', () => {
    const st = new DocStore(null);
    const a = st.addFromLibrary(rect, { x: 100, y: 100 }), b = st.addFromLibrary(rect, { x: 120, y: 400 }), c = st.addFromLibrary(rect, { x: 700, y: 50 });
    st.connect(a.id, b.id); st.connect(a.id, c.id);
    st.select(null);
    st.autoLayout('tree');
    expect(b.x).toBeGreaterThan(a.x);
    expect(c.x).toBe(b.x);
    st.undo();
    expect(b.x).not.toBe(st.doc.shapes.find((s) => s.id === a.id)!.x + 0.123);
    expect(st.doc.shapes.find((s) => s.id === b.id)!.x).toBe(120);
  });
});

describe('gõ để thêm', () => {
  it('tìm được khi gõ không dấu, gõ tiếng Anh, gõ từ đồng nghĩa', () => {
    expect(fold('Đường Tròn')).toBe('duong tron');
    expect(searchLibrary('tron')[0].n).toBe('Tròn');
    expect(searchLibrary('mũi tên')[0].n).toMatch(/^Mũi tên/);
    expect(searchLibrary('arrow').some((i) => i.n === 'Mũi tên phải')).toBe(true);
    expect(searchLibrary('database')[0].n).toBe('Trụ');
    expect(searchLibrary('pheu')[0].n).toBe('Phễu');
    expect(searchLibrary('zzzz')).toEqual([]);
    expect(searchLibrary('').length).toBe(8);
  });
});

describe('sao chép / dán', () => {
  it('dán tạo id mới, giữ nhóm và nối lại đường nối giữa các hình được chép', () => {
    const st = new DocStore(null);
    const a = st.addFromLibrary(rect, { x: 100, y: 100 }), b = st.addFromLibrary(rect, { x: 400, y: 100 });
    st.connect(a.id, b.id);
    st.selectMany([a.id, b.id]); st.group();
    const j = st.copySelection()!;
    expect(st.pasteShapes(j, { x: 600, y: 500 })).toBe(3);
    expect(st.doc.shapes.length).toBe(6);
    const conns = st.doc.shapes.filter((s) => s.t === 'connector');
    expect(conns.length).toBe(2);
    const pasted = st.selection;
    expect(pasted.length).toBe(2);
    expect(pasted.every((s) => s.gid !== undefined && s.gid !== a.gid)).toBe(true);
    const nc = conns.find((c) => c.p.a !== a.id)!;
    expect(pasted.map((s) => s.id).sort()).toEqual([nc.p.a, nc.p.b].sort());
    const bb = bboxOf(pasted);
    expect((bb.x0 + bb.x1) / 2).toBeCloseTo(600);
  });
  it('chuỗi lạ thì không dán gì', () => {
    const st = new DocStore(null);
    expect(st.pasteShapes('xin chào')).toBe(0);
    expect(st.pasteShapes('{"kind":"khac"}')).toBe(0);
  });
  it('nhân đôi một đường nối đơn lẻ không tạo đường trùng', () => {
    const st = new DocStore(null);
    const a = st.addFromLibrary(rect), b = st.addFromLibrary(rect, { x: 500, y: 300 });
    const c = st.connect(a.id, b.id)!;
    st.select(c.id); st.duplicate();
    expect(st.doc.shapes.filter((s) => s.t === 'connector').length).toBe(1);
  });
});

describe('ảnh dán vào', () => {
  it('ảnh xuất thành thẻ <image>, đường dẫn được thoát ký tự', () => {
    const st = new DocStore(null);
    const s = st.addShape({ t: 'image', w: 120, h: 80, p: { href: 'data:image/png;base64,AAA"x' } });
    const svg = shapeToSVG(s);
    expect(svg).toContain('<image href="data:image/png;base64,AAA&quot;x" x="0" y="0" width="120" height="80"');
  });
  it('báo lỗi khi bộ nhớ trình duyệt đầy, không âm thầm mất dữ liệu', () => {
    let err = 0;
    const st = new DocStore({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
    st.onSaveError = () => err++;
    st.addFromLibrary(rect);
    expect(err).toBe(1);
  });
});

describe('dữ liệu v5', () => {
  it('đường nối trong tài liệu được tính lại khi mở', () => {
    const st = new DocStore(null);
    const a = st.addFromLibrary(rect, { x: 100, y: 100 }), b = st.addFromLibrary(rect, { x: 400, y: 100 });
    st.connect(a.id, b.id);
    const raw = JSON.parse(JSON.stringify(st.doc));
    raw.shapes[0].p.pts = [];
    const d = migrateDoc(raw)!;
    syncConnectors(d);
    expect(d.v).toBe(DOC_VERSION);
    expect(d.shapes[0].p.pts.length).toBe(2);
  });
});

import { fitBox, panBy, stepZoom, toWorld, viewCenter, zoomAt } from '../src/core/camera';
describe('khung vô hạn: thu phóng, kéo khung nhìn', () => {
  it('thu phóng giữ nguyên điểm dưới con trỏ', () => {
    const c = { x: 100, y: 50, z: 1 };
    const before = toWorld(c, 300, 200), z2 = zoomAt(c, 2, 300, 200), after = toWorld(z2, 300, 200);
    expect(z2.z).toBe(2);
    expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y);
    expect(zoomAt(c, 1000, 0, 0).z).toBe(8); // có giới hạn
  });
  it('vừa trang: cả trang nằm gọn và ở giữa; tâm nhìn là nơi đặt hình mới', () => {
    const c = fitBox({ x0: 0, y0: 0, x1: 1280, y1: 720 }, 1000, 800, 40);
    expect(c.z).toBeCloseTo(920 / 1280);
    const vc = viewCenter(c, 1000, 800);
    expect(vc.x).toBeCloseTo(640); expect(vc.y).toBeCloseTo(360);
  });
  it('kéo khung nhìn và các nấc thu phóng', () => {
    expect(panBy({ x: 0, y: 0, z: 2 }, 100, -50)).toEqual({ x: -50, y: 25, z: 2 });
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(0.8, -1)).toBe(0.75);
  });
});
