import type { Shape } from '../core/types';
import type { DocStore } from '../core/store';
import { rad } from '../core/geometry';
import { shapeToSVG } from '../core/export';
import { shapeTransform } from '../core/transform';

const NS = 'http://www.w3.org/2000/svg';
function el(n: string, a: Record<string, string | number>, p?: Element) {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  p?.appendChild(e);
  return e;
}

type Drag =
  | { mode: 'move' | 'rot' | 'size'; h: string; start: { x: number; y: number }; s0: Shape; moved: boolean };

/** Khung vẽ: hiển thị tài liệu và xử lý kéo / đổi cỡ / xoay. */
export class EditorCanvas {
  private drag: Drag | null = null;
  snapToGrid = true;
  /** Gọi khi vị trí / kích thước đổi trong lúc kéo (để cập nhật ô số bên phải). */
  onGeometryChange: () => void = () => {};

  constructor(private svg: SVGSVGElement, private store: DocStore) {
    store.on('change', () => this.render());
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', () => this.up());
    svg.addEventListener('pointercancel', () => this.up());
    window.addEventListener('resize', () => this.render());
    this.render();
  }

  private scale() { return this.svg.getScreenCTM()?.a || 1; }
  private toCanvas(e: PointerEvent) {
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
    const s = this.store.selected;
    if (s) this.drawSelection(s);
  }

  private drawSelection(s: Shape) {
    const k = 1 / this.scale(), hs = 8 * k;
    const g = el('g', { transform: `translate(${s.x} ${s.y}) rotate(${s.r})` }, this.svg);
    el('rect', { x: -s.w / 2, y: -s.h / 2, width: s.w, height: s.h, fill: 'none', stroke: '#1E6FB5', 'stroke-width': 1.5 * k, 'stroke-dasharray': `${5 * k} ${4 * k}`, 'pointer-events': 'none' }, g);
    el('line', { x1: 0, y1: -s.h / 2, x2: 0, y2: -s.h / 2 - 26 * k, stroke: '#1E6FB5', 'stroke-width': 1.5 * k, 'pointer-events': 'none' }, g);
    el('circle', { cx: 0, cy: -s.h / 2 - 26 * k, r: 6 * k, fill: '#fff', stroke: '#1E6FB5', 'stroke-width': 2 * k, 'data-h': 'rot', style: 'cursor:grab' }, g);
    const hand: [number, number, string][] = [[-1, -1, 'nwse'], [0, -1, 'ns'], [1, -1, 'nesw'], [1, 0, 'ew'], [1, 1, 'nwse'], [0, 1, 'ns'], [-1, 1, 'nesw'], [-1, 0, 'ew']];
    for (const [a, b, c] of hand)
      el('rect', { x: (a * s.w) / 2 - hs / 2, y: (b * s.h) / 2 - hs / 2, width: hs, height: hs, fill: '#fff', stroke: '#1E6FB5', 'stroke-width': 1.6 * k, 'data-h': `${a},${b}`, style: `cursor:${c}-resize` }, g);
  }

  private down(e: PointerEvent) {
    const t = e.target as Element;
    const h = t.getAttribute?.('data-h');
    const sidEl = t.closest?.('[data-sid]');
    const p = this.toCanvas(e), sel = this.store.selected;
    if (h && sel) {
      this.drag = { mode: h === 'rot' ? 'rot' : 'size', h, start: p, s0: { ...sel }, moved: false };
      this.svg.setPointerCapture(e.pointerId);
      return;
    }
    if (sidEl) {
      const id = Number(sidEl.getAttribute('data-sid'));
      this.store.sel = id;
      this.drag = { mode: 'move', h: '', start: p, s0: { ...this.store.selected! }, moved: false };
      this.svg.setPointerCapture(e.pointerId);
      this.store.emitSelect();
      return;
    }
    this.store.select(null);
  }

  private move(e: PointerEvent) {
    const d = this.drag, s = this.store.selected;
    if (!d || !s) return;
    const p = this.toCanvas(e), s0 = d.s0;
    d.moved = true;
    if (d.mode === 'move') {
      s.x = this.sn(s0.x + p.x - d.start.x);
      s.y = this.sn(s0.y + p.y - d.start.y);
    } else if (d.mode === 'rot') {
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
    this.store.emitChange();
    this.onGeometryChange();
  }

  private up() {
    if (this.drag?.moved) this.store.commit();
    this.drag = null;
  }
}
