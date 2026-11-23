import type { LibItem, Shape } from '../core/types';
import { selectable, type DocStore } from '../core/store';
import { rad } from '../core/geometry';
import { shapeToSVG } from '../core/export';
import { bboxOf, moveShapes, rotateShapes, scaleShapes, shapeTransform } from '../core/transform';
import { getShape } from '../shapes/registry';
import { snapToGuides, type Guide } from '../core/align';
import { isConnector } from '../core/connect';
import { fitText } from '../core/text';
import { fitBox, panBy, stepZoom, toWorld, zoomAt, type Camera } from '../core/camera';
import { curveHandles, placeCurve, setCurveHandle, type CurveKey } from '../core/curve';

const NS = 'http://www.w3.org/2000/svg';
const BLUE = '#1E6FB5';
const GUIDE = '#E0338A';
function el(n: string, a: Record<string, string | number>, p?: Element) {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  p?.appendChild(e);
  return e;
}
const clone = (l: Shape[]): Shape[] => JSON.parse(JSON.stringify(l));
const scaleParamsOf = (t: string) => getShape(t).scaleParams ?? [];
/** Mẫu hình vẽ theo hướng kéo (mũi tên, đường kẻ) thay vì theo khung chữ nhật. */
export const isDirectional = (it: LibItem) => it.t === 'arrow' || it.t === 'dblarrow' || it.t === 'curve' || it.n === 'Đường kẻ';

type Pt = { x: number; y: number };
type Drag =
  /** một hình lẻ: xoay / đổi cỡ tự do */
  | { mode: 'rot' | 'size'; h: string; start: Pt; s0: Shape; moved: boolean }
  /** kéo dời tất cả hình đang chọn; clickId: bấm (không kéo) vào hình này thì chỉ chọn riêng nó */
  | { mode: 'move'; start: Pt; s0: Shape[]; list: Shape[]; moved: boolean; clickId?: number }
  /** nhiều hình: xoay quanh tâm khung chọn */
  | { mode: 'grot'; start: Pt; c: Pt; s0: Shape[]; list: Shape[]; moved: boolean }
  /** nhiều hình: phóng đều quanh góc đối diện */
  | { mode: 'gsize'; start: Pt; anchor: Pt; s0: Shape[]; list: Shape[]; moved: boolean }
  /** quét chọn bằng khung chữ nhật trên vùng trống */
  | { mode: 'marquee'; start: Pt; cur: Pt; base: number[]; moved: boolean }
  /** vẽ hình mới bằng kéo (sau phím R/O/A/T/L hoặc nhấn giữ mẫu trong thư viện) */
  | { mode: 'draw'; start: Pt; cur: Pt; it: LibItem; moved: boolean; shift: boolean }
  /** kéo khung nhìn (Space + kéo, chuột giữa) */
  | { mode: 'pan'; sx: number; sy: number; cam0: Camera; moved: boolean }
  /** kéo tay nắm của đường cong (đầu mút, hướng, đỉnh) */
  | { mode: 'curve'; key: CurveKey; start: Pt; moved: boolean }
  /** hai ngón tay: thu phóng + kéo khung nhìn */
  | { mode: 'pinch'; d0: number; m0: Pt; cam0: Camera; moved: boolean };

/** Khung vẽ vô hạn: hiển thị tài liệu và xử lý chọn / kéo / đổi cỡ / xoay / vẽ / thu phóng. */
export class EditorCanvas {
  private drag: Drag | null = null;
  private guides: Guide[] = [];
  /** Mặc định tắt (nguyên tắc "mặc định tự do"); bật trên thanh công cụ khi cần chính xác. */
  snapToGrid = false;
  /** Đang giữ Alt: tạm tắt mọi bắt điểm (lưới, góc, đường gióng). */
  private free = false;
  /** Đường gióng thông minh khi kéo (giữ Alt để tạm tắt). */
  smartGuides = true;
  /** Khung nhìn hiện tại. */
  cam: Camera = { x: 0, y: 0, z: 1 };
  private size = { w: 0, h: 0 };
  /** Mẫu hình đang "cầm" để vẽ bằng kéo (một lần, Esc để thả). */
  armed: LibItem | null = null;
  /** Đang giữ phím cách: kéo để dời khung nhìn. */
  spaceHeld = false;
  private touches = new Map<number, Pt>();
  private editingId: number | null = null;
  /** Vị trí con trỏ gần nhất trên khung (tọa độ trang), để dán / gõ thêm đúng chỗ. */
  lastPointer: Pt | null = null;

  /** Gọi khi vị trí / kích thước đổi trong lúc kéo (để cập nhật ô số bên phải). */
  onGeometryChange: () => void = () => {};
  /** Gọi khi khung nhìn đổi (để cập nhật % thu phóng). */
  onCamera: (c: Camera) => void = () => {};
  /** Gọi khi "cầm" / "thả" mẫu hình để vẽ. */
  onArm: (it: LibItem | null) => void = () => {};
  /** Bấm đúp vào chỗ trống: mở ô gõ để thêm hình tại đó. */
  onDoubleClickEmpty: (at: Pt, clientX: number, clientY: number) => void = () => {};
  /** Nhấn Tab khi đang gõ chữ trên hình: tạo ý tiếp theo. */
  onTabFromEdit: (id: number) => void = () => {};

  constructor(private svg: SVGSVGElement, private store: DocStore) {
    store.on('change', () => this.render());
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', (e) => this.up(e));
    svg.addEventListener('pointercancel', (e) => this.up(e));
    svg.addEventListener('dblclick', (e) => this.dbl(e));
    svg.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    svg.addEventListener('pointerleave', () => { if (!this.drag) this.lastPointer = null; });
    new ResizeObserver(() => this.resized()).observe(svg);
    this.resized();
    this.fit();
  }

  /* ---------- Khung nhìn ---------- */

  private resized() {
    const w = this.svg.clientWidth, h = this.svg.clientHeight;
    if (!w || !h) return;
    if (this.size.w) { // giữ nguyên tâm nhìn khi đổi cỡ cửa sổ
      const c = toWorld(this.cam, this.size.w / 2, this.size.h / 2);
      this.cam = { x: c.x - w / 2 / this.cam.z, y: c.y - h / 2 / this.cam.z, z: this.cam.z };
    }
    this.size = { w, h };
    this.render();
  }
  private setCam(c: Camera) { this.cam = c; this.render(); this.onCamera(c); }
  /** Vừa khít cả trang. */
  fit() {
    const { cw, ch } = this.store.doc;
    if (!this.size.w) { requestAnimationFrame(() => { this.resized(); if (this.size.w) this.fit(); }); return; }
    this.setCam(fitBox({ x0: 0, y0: 0, x1: cw, y1: ch }, this.size.w, this.size.h, 32, 1));
  }
  /** Thu phóng theo nấc (+1 / −1), hoặc đặt đúng mức z, quanh tâm vùng nhìn. */
  zoomStep(dir: 1 | -1) { this.zoomTo(stepZoom(this.cam.z, dir)); }
  zoomTo(z: number) { this.setCam(zoomAt(this.cam, z / this.cam.z, this.size.w / 2, this.size.h / 2)); }
  /** Tâm vùng đang nhìn (tọa độ trang): nơi đặt hình mới. */
  viewCenter(): Pt { return toWorld(this.cam, this.size.w / 2, this.size.h / 2); }
  /** Đổi tọa độ màn hình sang tọa độ trang; null nếu điểm nằm ngoài khung vẽ. */
  worldFromClient(cx: number, cy: number): Pt | null {
    const r = this.svg.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    return toWorld(this.cam, cx - r.left, cy - r.top);
  }
  private local(e: { clientX: number; clientY: number }): Pt {
    const r = this.svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private toCanvas(e: { clientX: number; clientY: number }): Pt { const l = this.local(e); return toWorld(this.cam, l.x, l.y); }
  private sn(v: number) { return this.snapToGrid && !this.free ? Math.round(v / 10) * 10 : v; }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    if (e.ctrlKey || e.metaKey) { // Ctrl+cuộn hoặc chụm hai ngón trên bàn di chuột: thu phóng tại con trỏ
      const l = this.local(e);
      this.setCam(zoomAt(this.cam, Math.exp(-e.deltaY * unit * 0.0025), l.x, l.y));
    } else this.setCam(panBy(this.cam, -e.deltaX * unit, -e.deltaY * unit));
  }

  /** Cầm một mẫu hình để vẽ bằng kéo (null = thả). */
  arm(it: LibItem | null) {
    this.armed = it;
    this.svg.style.cursor = it ? 'crosshair' : '';
    this.onArm(it);
  }

  /* ---------- Vẽ ---------- */

  render() {
    const { cw, ch, shapes } = this.store.doc, svg = this.svg, { w, h } = this.size;
    if (!w || !h) return;
    const z = this.cam.z, k = 1 / z, vx = this.cam.x, vy = this.cam.y, vw = w / z, vh = h / z;
    svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    svg.innerHTML = '';
    // lưới thưa dần khi thu nhỏ để không rối mắt
    let gs = 40; while (gs * z < 14) gs *= 5;
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'grid', width: gs, height: gs, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: `M${gs} 0H0V${gs}`, fill: 'none', stroke: '#E4E0D6', 'stroke-width': k }, pat);
    el('rect', { x: vx, y: vy, width: vw, height: vh, fill: '#EEEBE4' }, svg);
    el('rect', { x: vx, y: vy, width: vw, height: vh, fill: 'url(#grid)', opacity: 0.6 }, svg);
    el('rect', { x: 0, y: 3 * k, width: cw, height: ch, fill: 'rgba(0,0,0,.07)' }, svg);
    el('rect', { x: 0, y: 0, width: cw, height: ch, fill: '#fff' }, svg);
    el('rect', { x: 0, y: 0, width: cw, height: ch, fill: 'url(#grid)' }, svg);
    for (const s of shapes) {
      if (s.hidden) continue;
      const shown = s.id === this.editingId ? (s.t === 'text' ? { ...s, p: { ...s.p, text: '' } } : { ...s, label: undefined }) : s;
      if (s.locked) { el('g', { 'pointer-events': 'none' }, svg).innerHTML = shapeToSVG(shown); continue; }
      const g = el('g', { 'data-sid': s.id, style: this.armed ? '' : 'cursor:move' }, svg);
      g.innerHTML = shapeToSVG(shown);
      if (isConnector(s)) // vùng bấm rộng hơn nét để dễ chọn
        el('path', { d: 'M' + (s.p.pts || []).map((p: number[]) => p.join(' ')).join(' L'), fill: 'none', stroke: 'transparent', 'stroke-width': 14 * k, transform: shapeTransform(s) }, g);
      else el('rect', { x: 0, y: 0, width: s.w, height: s.h, fill: 'transparent', transform: shapeTransform(s) }, g);
    }
    const one = this.store.selected, list = this.store.selection;
    if (one && isConnector(one)) this.drawConnectorSel(one);
    else if (one) { this.drawSelection(one); if (one.t === 'curve') this.drawCurveHandles(one); }
    else if (list.length) this.drawMulti(list);
    for (const g of this.guides) {
      const [x1, y1, x2, y2] = g.dir === 'v' ? [g.at, g.a, g.at, g.b] : [g.a, g.at, g.b, g.at];
      el('line', { x1, y1, x2, y2, stroke: GUIDE, 'stroke-width': k, 'pointer-events': 'none' }, svg);
    }
    const d = this.drag;
    if (d?.mode === 'marquee' && d.moved) {
      const r = rectOf(d.start, d.cur);
      el('rect', { x: r.x0, y: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0, fill: 'rgba(30,111,181,.08)', stroke: BLUE, 'stroke-width': k, 'stroke-dasharray': `${4 * k} ${3 * k}`, 'pointer-events': 'none' }, svg);
    }
    if (d?.mode === 'draw' && d.moved) {
      const prev = this.drawResult(d);
      el('g', { opacity: 0.55, 'pointer-events': 'none' }, svg).innerHTML = shapeToSVG({ id: -1, t: d.it.t, x: prev.at.x, y: prev.at.y, w: prev.size.w, h: prev.size.h, r: prev.rot, fx: 1, fy: 1, fill: '#1E6FB5', stroke: '#000', sw: 0, op: 1, p: { ...defaultsOf(d.it) } });
    }
  }

  private drawSelection(s: Shape) {
    const k = 1 / this.cam.z, hs = 8 * k;
    const g = el('g', { transform: `translate(${s.x} ${s.y}) rotate(${s.r})` }, this.svg);
    el('rect', { x: -s.w / 2, y: -s.h / 2, width: s.w, height: s.h, fill: 'none', stroke: BLUE, 'stroke-width': 1.5 * k, 'stroke-dasharray': `${5 * k} ${4 * k}`, 'pointer-events': 'none' }, g);
    el('line', { x1: 0, y1: -s.h / 2, x2: 0, y2: -s.h / 2 - 26 * k, stroke: BLUE, 'stroke-width': 1.5 * k, 'pointer-events': 'none' }, g);
    el('circle', { cx: 0, cy: -s.h / 2 - 26 * k, r: 6 * k, fill: '#fff', stroke: BLUE, 'stroke-width': 2 * k, 'data-h': 'rot', style: 'cursor:grab' }, g);
    const hand: [number, number, string][] = [[-1, -1, 'nwse'], [0, -1, 'ns'], [1, -1, 'nesw'], [1, 0, 'ew'], [1, 1, 'nwse'], [0, 1, 'ns'], [-1, 1, 'nesw'], [-1, 0, 'ew']];
    for (const [a, b, c] of hand)
      el('rect', { x: (a * s.w) / 2 - hs / 2, y: (b * s.h) / 2 - hs / 2, width: hs, height: hs, fill: '#fff', stroke: BLUE, 'stroke-width': 1.6 * k, 'data-h': `${a},${b}`, style: `cursor:${c}-resize` }, g);
  }

  /** Tay nắm đường cong: chấm tròn ở hai đầu mút, hình thoi ở điểm điều khiển (kéo để đổi hướng/độ cong). */
  private drawCurveHandles(s: Shape) {
    const k = 1 / this.cam.z, hd = curveHandles(s), svg = this.svg;
    const line = (a?: number[], b?: number[]) => a && b && el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: BLUE, 'stroke-width': k, 'stroke-dasharray': `${3 * k} ${3 * k}`, 'pointer-events': 'none' }, svg);
    if (hd.q) { line(hd.p0, hd.q); line(hd.p3, hd.q); } else { line(hd.p0, hd.c1); line(hd.p3, hd.c2); }
    for (const key of ['c1', 'c2', 'q'] as const) {
      const p = hd[key]; if (!p) continue;
      const r = 6 * k;
      el('path', { d: `M${p[0]} ${p[1] - r}L${p[0] + r} ${p[1]}L${p[0]} ${p[1] + r}L${p[0] - r} ${p[1]}Z`, fill: '#fff', stroke: GUIDE, 'stroke-width': 2 * k, 'data-ch': key, style: 'cursor:move' }, svg)
        .appendChild(Object.assign(document.createElementNS(NS, 'title'), { textContent: key === 'q' ? 'Kéo để đổi đỉnh parabol' : 'Kéo để đổi hướng và độ cong ở đầu này' }));
    }
    for (const key of ['p0', 'p3'] as const) {
      const p = hd[key]!;
      el('circle', { cx: p[0], cy: p[1], r: 6.5 * k, fill: BLUE, stroke: '#fff', 'stroke-width': 2 * k, 'data-ch': key, style: 'cursor:move' }, svg)
        .appendChild(Object.assign(document.createElementNS(NS, 'title'), { textContent: 'Kéo để dời đầu mút' }));
    }
  }

  /** Đường nối đang chọn: tô sáng đường đi (đường nối tự đi theo hình nên không có tay nắm). */
  private drawConnectorSel(s: Shape) {
    el('path', { d: 'M' + (s.p.pts || []).map((p: number[]) => p.join(' ')).join(' L'), fill: 'none', stroke: BLUE, 'stroke-opacity': 0.45, 'stroke-width': (s.p.th || 3) + 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', transform: shapeTransform(s), 'pointer-events': 'none' }, this.svg);
  }

  /** Khung chọn chung cho nhiều hình / nhóm: viền mảnh từng hình + khung bao có 4 góc phóng đều và nút xoay. */
  private drawMulti(all: Shape[]) {
    const k = 1 / this.cam.z, hs = 8 * k, svg = this.svg;
    for (const s of all.filter(isConnector)) this.drawConnectorSel(s);
    const list = all.filter((s) => !isConnector(s));
    if (!list.length) return;
    for (const s of list)
      el('rect', { x: -s.w / 2, y: -s.h / 2, width: s.w, height: s.h, fill: 'none', stroke: BLUE, 'stroke-opacity': 0.55, 'stroke-width': k, transform: `translate(${s.x} ${s.y}) rotate(${s.r})`, 'pointer-events': 'none' }, svg);
    const b = bboxOf(list), cx = (b.x0 + b.x1) / 2;
    const grouped = this.store.selectedGroup !== undefined;
    el('rect', { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0, fill: 'none', stroke: BLUE, 'stroke-width': 1.5 * k, 'stroke-dasharray': grouped ? 'none' : `${5 * k} ${4 * k}`, 'pointer-events': 'none' }, svg);
    el('line', { x1: cx, y1: b.y0, x2: cx, y2: b.y0 - 26 * k, stroke: BLUE, 'stroke-width': 1.5 * k, 'pointer-events': 'none' }, svg);
    el('circle', { cx, cy: b.y0 - 26 * k, r: 6 * k, fill: '#fff', stroke: BLUE, 'stroke-width': 2 * k, 'data-h': 'rot', style: 'cursor:grab' }, svg);
    for (const [a, c, cur] of [[-1, -1, 'nwse'], [1, -1, 'nesw'], [1, 1, 'nwse'], [-1, 1, 'nesw']] as const) {
      const x = a < 0 ? b.x0 : b.x1, y = c < 0 ? b.y0 : b.y1;
      el('rect', { x: x - hs / 2, y: y - hs / 2, width: hs, height: hs, fill: '#fff', stroke: BLUE, 'stroke-width': 1.6 * k, 'data-h': `${a},${c}`, style: `cursor:${cur}-resize` }, svg);
    }
  }

  /* ---------- Chuột / cảm ứng ---------- */

  private down(e: PointerEvent) {
    if (this.editingId !== null) return;
    const st = this.store;
    const capture = () => this.svg.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) { // ngón thứ hai: bỏ thao tác đang làm, chuyển sang chụm/kéo khung nhìn
        // phần đã kéo dở được giữ lại và ghi mốc hoàn tác
        if (this.drag?.moved && !['marquee', 'pan', 'draw', 'pinch'].includes(this.drag.mode)) this.store.commit();
        this.guides = [];
        const [a, b] = [...this.touches.values()];
        this.drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, m0: this.local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }), cam0: { ...this.cam }, moved: false };
        capture();
        return;
      }
    }
    const p = this.toCanvas(e);
    if (e.button === 1 || this.spaceHeld) {
      e.preventDefault();
      this.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, cam0: { ...this.cam }, moved: false };
      this.svg.style.cursor = 'grabbing';
      capture();
      return;
    }
    if (e.button !== 0) return;
    if (this.armed) {
      this.drag = { mode: 'draw', start: p, cur: p, it: this.armed, moved: false, shift: e.shiftKey };
      capture();
      return;
    }
    const t = e.target as Element;
    const ch = t.getAttribute?.('data-ch') as CurveKey | null;
    if (ch && st.selected?.t === 'curve') { this.drag = { mode: 'curve', key: ch, start: p, moved: false }; capture(); return; }
    const h = t.getAttribute?.('data-h');
    const sidEl = t.closest?.('[data-sid]');

    if (h && st.sel.length) {
      const one = st.selected;
      if (one) this.drag = { mode: h === 'rot' ? 'rot' : 'size', h, start: p, s0: { ...one }, moved: false };
      else {
        const list = st.selection.filter((s) => !isConnector(s)), s0 = clone(list), b = bboxOf(list);
        if (h === 'rot') this.drag = { mode: 'grot', start: p, c: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, s0, list, moved: false };
        else {
          const [a, c] = h.split(',').map(Number);
          this.drag = { mode: 'gsize', start: p, anchor: { x: a < 0 ? b.x1 : b.x0, y: c < 0 ? b.y1 : b.y0 }, s0, list, moved: false };
        }
      }
      capture();
      return;
    }
    if (sidEl) {
      const id = Number(sidEl.getAttribute('data-sid'));
      let clickId: number | undefined;
      if (e.shiftKey) { st.toggle(id); if (!st.isSelected(id)) return; }
      else if (!st.isSelected(id)) st.select(id);
      else clickId = id;
      const list = st.selection.filter((s) => !isConnector(s));
      this.drag = { mode: 'move', start: p, s0: clone(list), list, moved: false, clickId };
      capture();
      return;
    }
    // vùng trống: bắt đầu quét chọn
    const base = e.shiftKey ? [...st.sel] : [];
    if (!e.shiftKey) st.select(null);
    this.drag = { mode: 'marquee', start: p, cur: p, base, moved: false };
    capture();
  }

  private move(e: PointerEvent) {
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = this.drag;
    const p = this.toCanvas(e);
    if (!d || d.mode !== 'pan') this.lastPointer = p;
    if (!d) return;
    this.free = e.altKey;
    if (d.mode === 'pinch') {
      const [a, b] = [...this.touches.values()]; if (!a || !b) return;
      const m = this.local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }), dist = Math.hypot(a.x - b.x, a.y - b.y);
      d.moved = true;
      this.setCam(zoomAt(panBy(d.cam0, m.x - d.m0.x, m.y - d.m0.y), dist / d.d0, m.x, m.y));
      return;
    }
    if (d.mode === 'pan') { d.moved = true; this.setCam(panBy(d.cam0, e.clientX - d.sx, e.clientY - d.sy)); return; }
    // bỏ qua rung tay rất nhỏ để "bấm" không bị tính là "kéo"
    if (!d.moved && Math.hypot(p.x - (d as any).start.x, p.y - (d as any).start.y) * this.cam.z < 4) return;
    if (d.mode === 'draw') { d.cur = p; d.moved = true; d.shift = e.shiftKey; this.render(); return; }
    if (d.mode === 'marquee') {
      d.cur = p; d.moved = true;
      const r = rectOf(d.start, p);
      const hit = this.store.doc.shapes.filter(selectable).filter((s) => { const b = bboxOf([s]); return b.x1 >= r.x0 && b.x0 <= r.x1 && b.y1 >= r.y0 && b.y0 <= r.y1; }).map((s) => s.id);
      this.store.selectMany([...d.base, ...hit]);
      this.render();
      return;
    }
    d.moved = true;
    if (d.mode === 'curve') {
      const s = this.store.selected; if (!s) return;
      setCurveHandle(s, d.key, this.sn(p.x), this.sn(p.y));
    } else if (d.mode === 'move') {
      if (!d.list.length) return;
      // ưu tiên đường gióng (thẳng hàng với hình khác/trang); trục nào không bắt được thì bắt lưới theo tâm hình đầu tiên
      const a = d.s0[0], rx = p.x - d.start.x, ry = p.y - d.start.y;
      let dx = this.sn(a.x + rx) - a.x, dy = this.sn(a.y + ry) - a.y;
      this.guides = [];
      if (this.smartGuides && !e.altKey) {
        const b = bboxOf(d.s0), ids = new Set(d.list.map((s) => s.id));
        const others = this.store.doc.shapes.filter((s) => !ids.has(s.id) && !s.hidden && !isConnector(s)).map((s) => bboxOf([s]));
        const { cw, ch } = this.store.doc;
        const r = snapToGuides({ x0: b.x0 + rx, y0: b.y0 + ry, x1: b.x1 + rx, y1: b.y1 + ry }, others, { x0: 0, y0: 0, x1: cw, y1: ch }, 6 / this.cam.z);
        if (r.dx !== null) dx = rx + r.dx;
        if (r.dy !== null) dy = ry + r.dy;
        this.guides = r.guides;
      }
      moveShapes(d.s0, d.list, dx, dy);
    } else if (d.mode === 'grot') {
      let a = ((Math.atan2(p.y - d.c.y, p.x - d.c.x) - Math.atan2(d.start.y - d.c.y, d.start.x - d.c.x)) * 180) / Math.PI;
      if ((e.shiftKey || this.snapToGrid) && !this.free) a = Math.round(a / 15) * 15;
      rotateShapes(d.s0, d.list, d.c.x, d.c.y, a);
    } else if (d.mode === 'gsize') {
      const vx = d.start.x - d.anchor.x, vy = d.start.y - d.anchor.y, L = vx * vx + vy * vy || 1;
      const k = Math.max(0.05, ((p.x - d.anchor.x) * vx + (p.y - d.anchor.y) * vy) / L);
      scaleShapes(d.s0, d.list, d.anchor.x, d.anchor.y, k, scaleParamsOf);
    } else {
      const s = this.store.selected, s0 = d.s0;
      if (!s || isConnector(s)) return;
      if (d.mode === 'rot') {
        let a = (Math.atan2(p.y - s0.y, p.x - s0.x) * 180) / Math.PI + 90;
        if ((e.shiftKey || this.snapToGrid) && !this.free) a = Math.round(a / 15) * 15;
        s.r = ((Math.round(a) % 360) + 360) % 360;
      } else {
        const [hx, hy] = d.h.split(',').map(Number);
        const c = Math.cos(rad(-s0.r)), n = Math.sin(rad(-s0.r));
        const dx = p.x - s0.x, dy = p.y - s0.y, lx = dx * c - dy * n, ly = dx * n + dy * c;
        let nw = s0.w, nh = s0.h;
        if (hx) nw = Math.max(6, hx * (lx + (hx * s0.w) / 2));
        if (hy) nh = Math.max(6, hy * (ly + (hy * s0.h) / 2));
        if (e.shiftKey && hx && hy) { const k = Math.max(nw / s0.w, nh / s0.h); nw = s0.w * k; nh = s0.h * k; }
        nw = Math.max(6, this.sn(nw)); nh = Math.max(6, this.sn(nh));
        const sx = (hx * (nw - s0.w)) / 2, sy = (hy * (nh - s0.h)) / 2, c2 = Math.cos(rad(s0.r)), n2 = Math.sin(rad(s0.r));
        s.w = nw; s.h = nh;
        s.x = s0.x + sx * c2 - sy * n2;
        s.y = s0.y + sx * n2 + sy * c2;
      }
    }
    this.store.emitChange();
    this.onGeometryChange();
  }

  private up(e: PointerEvent) {
    this.touches.delete(e.pointerId);
    const d = this.drag;
    if (d?.mode === 'pinch') { if (this.touches.size < 2) this.drag = null; return; }
    this.drag = null;
    if (this.guides.length) { this.guides = []; this.render(); }
    if (!d) return;
    if (d.mode === 'pan') { this.svg.style.cursor = this.armed ? 'crosshair' : ''; return; }
    if (d.mode === 'draw') { this.finishDraw(d); return; }
    if (d.mode === 'marquee') { if (d.moved) this.render(); return; }
    if (d.moved) this.store.commit();
    else if (d.mode === 'move' && d.clickId !== undefined && !e.shiftKey) this.store.select(d.clickId);
  }

  /** Kích thước/vị trí/góc của hình đang vẽ bằng kéo. */
  private drawResult(d: Extract<Drag, { mode: 'draw' }>) {
    const it = d.it, a = d.start, b = d.cur;
    if (!d.moved) return { at: a, size: { w: it.w, h: it.h }, rot: 0 };
    if (isDirectional(it)) { // mũi tên, đường kẻ: theo hướng kéo
      const L = Math.max(20, Math.hypot(b.x - a.x, b.y - a.y));
      let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (d.shift && !this.free) ang = Math.round(ang / 15) * 15;
      return { at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, size: { w: L, h: Math.min(it.h, Math.max(6, L * 0.45)) }, rot: ((ang % 360) + 360) % 360 };
    }
    let w = Math.max(8, Math.abs(b.x - a.x)), h = Math.max(8, Math.abs(b.y - a.y));
    if (d.shift) { const k = Math.max(w / it.w, h / it.h); w = it.w * k; h = it.h * k; } // giữ tỉ lệ mẫu
    const x0 = b.x < a.x ? a.x - w : a.x, y0 = b.y < a.y ? a.y - h : a.y;
    return { at: { x: x0 + w / 2, y: y0 + h / 2 }, size: { w, h }, rot: 0 };
  }
  private finishDraw(d: Extract<Drag, { mode: 'draw' }>) {
    const r = this.drawResult(d);
    const s = this.store.addFromLibrary(d.it, r.at, r.size, r.rot);
    // đường cong: hai đầu mút đặt đúng điểm bắt đầu và kết thúc kéo
    if (s.t === 'curve' && d.moved) { s.r = 0; placeCurve(s, d.start, d.cur); this.store.commit(); this.store.emitChange(); }
    this.arm(null);
    if (s.t === 'text') this.editLabel(s.id);
  }

  /* ---------- Gõ chữ trực tiếp ---------- */

  private dbl(e: MouseEvent) {
    if (this.armed || this.editingId !== null) return;
    // khung vẽ được dựng lại sau mỗi lần bấm nên e.target có thể đã bị thay; hỏi lại phần tử đang nằm dưới con trỏ
    const sidEl = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-sid]');
    if (sidEl) {
      const s = this.store.doc.shapes.find((x) => x.id === Number(sidEl.getAttribute('data-sid')));
      if (s && !isConnector(s) && s.t !== 'image' && s.t !== 'curve') this.editLabel(s.id);
      return;
    }
    this.onDoubleClickEmpty(this.toCanvas(e), e.clientX, e.clientY);
  }

  /** Mở ô gõ chữ đè lên hình. Enter: xong · Shift+Enter: xuống dòng · Tab: xong và tạo ý tiếp theo · Esc: hủy. */
  editLabel(id: number) {
    const s = this.store.doc.shapes.find((x) => x.id === id); if (!s) return;
    this.store.select(id);
    this.editingId = id; this.render();
    const z = this.cam.z, r = this.svg.getBoundingClientRect(), b = bboxOf([s]);
    const isText = s.t === 'text';
    const value = isText ? String(s.p.text ?? '') : s.label ?? '';
    const fs = isText ? (+s.p.size || 36) * z : fitText(value || 'Aa', s.w, s.h, { bold: true }).size * z;
    const ta = document.createElement('textarea');
    ta.className = 'inedit';
    ta.value = value;
    ta.placeholder = 'Gõ chữ…';
    const W = Math.max(140, (b.x1 - b.x0) * z), H = Math.max(44, (b.y1 - b.y0) * z);
    Object.assign(ta.style, {
      left: `${r.left + ((b.x0 + b.x1) / 2 - this.cam.x) * z - W / 2}px`, top: `${r.top + ((b.y0 + b.y1) / 2 - this.cam.y) * z - H / 2}px`,
      width: `${W}px`, height: `${H}px`, fontSize: `${Math.min(48, Math.max(13, fs))}px`, fontWeight: isText && !s.p.bold ? '400' : '700',
    });
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    let done = false;
    const finish = (save: boolean, next = false) => {
      if (done) return; done = true;
      const v = ta.value;
      ta.remove(); this.editingId = null;
      if (save && v !== value) this.store.setLabel(id, v); else this.render();
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (next) this.onTabFromEdit(id);
    };
    ta.onkeydown = (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); finish(true); }
      else if (ev.key === 'Tab') { ev.preventDefault(); finish(true, true); }
    };
    ta.onblur = () => finish(true);
  }
  get isEditing() { return this.editingId !== null; }
}

const defaultsOf = (it: LibItem) => { try { const o: Record<string, any> = {}; getShape(it.t).params.forEach((q) => (o[q.k] = q.def)); return { ...o, ...(it.p || {}) }; } catch { return it.p || {}; } };

function rectOf(a: Pt, b: Pt) {
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}
