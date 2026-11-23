import type { Shape } from '../core/types';
import type { DocStore } from '../core/store';
import { rad } from '../core/geometry';
import { shapeToSVG } from '../core/export';
import { bboxOf, moveShapes, rotateShapes, scaleShapes, shapeTransform } from '../core/transform';
import { getShape } from '../shapes/registry';
import { snapToGuides, type Guide } from '../core/align';

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
  | { mode: 'marquee'; start: Pt; cur: Pt; base: number[]; moved: boolean };

/** Khung vẽ: hiển thị tài liệu và xử lý chọn / kéo / đổi cỡ / xoay. */
export class EditorCanvas {
  private drag: Drag | null = null;
  private guides: Guide[] = [];
  snapToGrid = true;
  /** Đường gióng thông minh khi kéo (giữ Alt để tạm tắt). */
  smartGuides = true;
  /** Gọi khi vị trí / kích thước đổi trong lúc kéo (để cập nhật ô số bên phải). */
  onGeometryChange: () => void = () => {};

  constructor(private svg: SVGSVGElement, private store: DocStore) {
    store.on('change', () => this.render());
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', (e) => this.up(e));
    svg.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('resize', () => this.render());
    this.render();
  }

  private scale() { return this.svg.getScreenCTM()?.a || 1; }
  private toCanvas(e: PointerEvent): Pt {
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(this.svg.getScreenCTM()!.inverse());
    return { x: q.x, y: q.y };
  }
  private sn(v: number) { return this.snapToGrid ? Math.round(v / 10) * 10 : v; }

  render() {
    const { cw, ch, shapes } = this.store.doc, svg = this.svg;
    svg.setAttribute('viewBox', `0 0 ${cw} ${ch}`);
    svg.style.aspectRatio = `${cw}/${ch}`;
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'grid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M40 0H0V40', fill: 'none', stroke: '#EEE9DF', 'stroke-width': 1 }, pat);
    el('rect', { x: 0, y: 0, width: cw, height: ch, fill: '#fff' }, svg);
    el('rect', { x: 0, y: 0, width: cw, height: ch, fill: 'url(#grid)' }, svg);
    for (const s of shapes) {
      const g = el('g', { 'data-sid': s.id, style: 'cursor:move' }, svg);
      g.innerHTML = shapeToSVG(s);
      el('rect', { x: 0, y: 0, width: s.w, height: s.h, fill: 'transparent', transform: shapeTransform(s) }, g);
    }
    const one = this.store.selected, list = this.store.selection;
    if (one) this.drawSelection(one);
    else if (list.length) this.drawMulti(list);
    if (this.guides.length) {
      const k = 1 / this.scale();
      for (const g of this.guides) {
        const [x1, y1, x2, y2] = g.dir === 'v' ? [g.at, g.a, g.at, g.b] : [g.a, g.at, g.b, g.at];
        el('line', { x1, y1, x2, y2, stroke: GUIDE, 'stroke-width': k, 'pointer-events': 'none' }, svg);
      }
    }
    const d = this.drag;
    if (d?.mode === 'marquee' && d.moved) {
      const k = 1 / this.scale(), r = rectOf(d.start, d.cur);
      el('rect', { x: r.x0, y: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0, fill: 'rgba(30,111,181,.08)', stroke: BLUE, 'stroke-width': k, 'stroke-dasharray': `${4 * k} ${3 * k}`, 'pointer-events': 'none' }, svg);
    }
  }

  private drawSelection(s: Shape) {
    const k = 1 / this.scale(), hs = 8 * k;
    const g = el('g', { transform: `translate(${s.x} ${s.y}) rotate(${s.r})` }, this.svg);
    el('rect', { x: -s.w / 2, y: -s.h / 2, width: s.w, height: s.h, fill: 'none', stroke: BLUE, 'stroke-width': 1.5 * k, 'stroke-dasharray': `${5 * k} ${4 * k}`, 'pointer-events': 'none' }, g);
    el('line', { x1: 0, y1: -s.h / 2, x2: 0, y2: -s.h / 2 - 26 * k, stroke: BLUE, 'stroke-width': 1.5 * k, 'pointer-events': 'none' }, g);
    el('circle', { cx: 0, cy: -s.h / 2 - 26 * k, r: 6 * k, fill: '#fff', stroke: BLUE, 'stroke-width': 2 * k, 'data-h': 'rot', style: 'cursor:grab' }, g);
    const hand: [number, number, string][] = [[-1, -1, 'nwse'], [0, -1, 'ns'], [1, -1, 'nesw'], [1, 0, 'ew'], [1, 1, 'nwse'], [0, 1, 'ns'], [-1, 1, 'nesw'], [-1, 0, 'ew']];
    for (const [a, b, c] of hand)
      el('rect', { x: (a * s.w) / 2 - hs / 2, y: (b * s.h) / 2 - hs / 2, width: hs, height: hs, fill: '#fff', stroke: BLUE, 'stroke-width': 1.6 * k, 'data-h': `${a},${b}`, style: `cursor:${c}-resize` }, g);
  }

  /** Khung chọn chung cho nhiều hình / nhóm: viền mảnh từng hình + khung bao có 4 góc phóng đều và nút xoay. */
  private drawMulti(list: Shape[]) {
    const k = 1 / this.scale(), hs = 8 * k, svg = this.svg;
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

  private down(e: PointerEvent) {
    const t = e.target as Element, st = this.store;
    const h = t.getAttribute?.('data-h');
    const sidEl = t.closest?.('[data-sid]');
    const p = this.toCanvas(e);
    const capture = () => this.svg.setPointerCapture(e.pointerId);

    if (h && st.sel.length) {
      const one = st.selected;
      if (one) this.drag = { mode: h === 'rot' ? 'rot' : 'size', h, start: p, s0: { ...one }, moved: false };
      else {
        const list = st.selection, s0 = clone(list), b = bboxOf(list);
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
      const list = st.selection;
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
    const d = this.drag;
    if (!d) return;
    const p = this.toCanvas(e);
    if (d.mode === 'marquee') {
      d.cur = p;
      if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) * this.scale() < 3) return;
      d.moved = true;
      const r = rectOf(d.start, p);
      const hit = this.store.doc.shapes.filter((s) => { const b = bboxOf([s]); return b.x1 >= r.x0 && b.x0 <= r.x1 && b.y1 >= r.y0 && b.y0 <= r.y1; }).map((s) => s.id);
      this.store.selectMany([...d.base, ...hit]);
      this.render();
      return;
    }
    // bỏ qua rung tay rất nhỏ để "bấm" không bị tính là "kéo"
    if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) * this.scale() < 3) return;
    d.moved = true;
    if (d.mode === 'move') {
      // ưu tiên đường gióng (thẳng hàng với hình khác/trang); trục nào không bắt được thì bắt lưới theo tâm hình đầu tiên
      const a = d.s0[0], rx = p.x - d.start.x, ry = p.y - d.start.y;
      let dx = this.sn(a.x + rx) - a.x, dy = this.sn(a.y + ry) - a.y;
      this.guides = [];
      if (this.smartGuides && !e.altKey) {
        const b = bboxOf(d.s0), ids = new Set(d.list.map((s) => s.id));
        const others = this.store.doc.shapes.filter((s) => !ids.has(s.id)).map((s) => bboxOf([s]));
        const { cw, ch } = this.store.doc;
        const r = snapToGuides({ x0: b.x0 + rx, y0: b.y0 + ry, x1: b.x1 + rx, y1: b.y1 + ry }, others, { x0: 0, y0: 0, x1: cw, y1: ch }, 6 / this.scale());
        if (r.dx !== null) dx = rx + r.dx;
        if (r.dy !== null) dy = ry + r.dy;
        this.guides = r.guides;
      }
      moveShapes(d.s0, d.list, dx, dy);
    } else if (d.mode === 'grot') {
      let a = ((Math.atan2(p.y - d.c.y, p.x - d.c.x) - Math.atan2(d.start.y - d.c.y, d.start.x - d.c.x)) * 180) / Math.PI;
      if (e.shiftKey || this.snapToGrid) a = Math.round(a / 15) * 15;
      rotateShapes(d.s0, d.list, d.c.x, d.c.y, a);
    } else if (d.mode === 'gsize') {
      const vx = d.start.x - d.anchor.x, vy = d.start.y - d.anchor.y, L = vx * vx + vy * vy || 1;
      const k = Math.max(0.05, ((p.x - d.anchor.x) * vx + (p.y - d.anchor.y) * vy) / L);
      scaleShapes(d.s0, d.list, d.anchor.x, d.anchor.y, k, scaleParamsOf);
    } else {
      const s = this.store.selected, s0 = d.s0;
      if (!s) return;
      if (d.mode === 'rot') {
        let a = (Math.atan2(p.y - s0.y, p.x - s0.x) * 180) / Math.PI + 90;
        if (e.shiftKey || this.snapToGrid) a = Math.round(a / 15) * 15;
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
    const d = this.drag;
    this.drag = null;
    if (this.guides.length) { this.guides = []; this.render(); }
    if (!d) return;
    if (d.mode === 'marquee') { if (d.moved) this.render(); return; }
    if (d.moved) this.store.commit();
    else if (d.mode === 'move' && d.clickId !== undefined && !e.shiftKey) this.store.select(d.clickId);
  }
}

function rectOf(a: Pt, b: Pt) {
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}
