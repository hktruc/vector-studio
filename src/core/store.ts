import type { Doc, LibItem, Shape } from './types';
import { COLORS, SIZES, STORAGE_KEY } from './constants';
import { defaultParams } from '../shapes/registry';

type Listener = () => void;

/** Trạng thái tài liệu + chọn hình + hoàn tác/làm lại. Không biết gì về giao diện. */
export class DocStore {
  doc: Doc = { v: 1, cw: SIZES[0][1], ch: SIZES[0][2], sizeIdx: 0, seq: 1, shapes: [] };
  sel: number | null = null;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private onChange = new Set<Listener>();
  private onSelect = new Set<Listener>();
  private colorIdx = 0;

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = null) {
    this.load();
    this.undoStack = [this.snapshot()];
  }

  /** Đăng ký nghe: 'change' = vẽ lại khung; 'select' = dựng lại bảng thuộc tính. */
  on(ev: 'change' | 'select', fn: Listener) {
    (ev === 'change' ? this.onChange : this.onSelect).add(fn);
  }
  emitChange() { this.onChange.forEach((f) => f()); }
  emitSelect() { this.onSelect.forEach((f) => f()); this.emitChange(); }

  get selected(): Shape | undefined { return this.doc.shapes.find((s) => s.id === this.sel); }
  select(id: number | null) { if (this.sel !== id) { this.sel = id; this.emitSelect(); } }

  private snapshot() { return JSON.stringify(this.doc); }
  private restore(j: string) {
    this.doc = JSON.parse(j);
    if (!this.selected) this.sel = null;
    this.emitSelect();
  }
  /** Ghi nhận một mốc để hoàn tác (gọi sau mỗi thao tác xong). */
  commit() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
    this.save();
  }
  undo() { if (this.undoStack.length > 1) { this.redoStack.push(this.undoStack.pop()!); this.restore(this.undoStack[this.undoStack.length - 1]); this.save(); } }
  redo() { const j = this.redoStack.pop(); if (j) { this.undoStack.push(j); this.restore(j); this.save(); } }

  addFromLibrary(it: LibItem): Shape {
    const n = this.doc.shapes.length % 5 - 2;
    const s: Shape = {
      id: this.doc.seq++, t: it.t, x: this.doc.cw / 2 + n * 14, y: this.doc.ch / 2 + n * 14, w: it.w, h: it.h,
      r: 0, fx: 1, fy: 1,
      fill: it.t === 'text' ? '#1B2A3A' : COLORS[this.colorIdx++ % COLORS.length],
      stroke: '#12497A', sw: 0, op: 1,
      p: { ...defaultParams(it.t), ...(it.p || {}) },
    };
    this.doc.shapes.push(s);
    this.sel = s.id;
    this.commit(); this.emitSelect();
    return s;
  }
  duplicate() {
    const s = this.selected; if (!s) return;
    const c: Shape = JSON.parse(JSON.stringify(s)); c.id = this.doc.seq++; c.x += 20; c.y += 20;
    this.doc.shapes.push(c); this.sel = c.id; this.commit(); this.emitSelect();
  }
  remove() {
    const s = this.selected; if (!s) return;
    this.doc.shapes = this.doc.shapes.filter((x) => x.id !== s.id); this.sel = null; this.commit(); this.emitSelect();
  }
  clear() { if (!this.doc.shapes.length) return; this.doc.shapes = []; this.sel = null; this.commit(); this.emitSelect(); }
  /** d: ±1 lên/xuống một lớp, hoặc 'top' / 'bottom'. */
  moveLayer(d: number | 'top' | 'bottom') {
    const a = this.doc.shapes, i = a.findIndex((x) => x.id === this.sel); if (i < 0) return;
    const j = d === 'top' ? a.length - 1 : d === 'bottom' ? 0 : Math.max(0, Math.min(a.length - 1, i + d));
    const [s] = a.splice(i, 1); a.splice(j, 0, s); this.commit(); this.emitChange();
  }
  setCanvasSize(idx: number) {
    this.doc.sizeIdx = idx; this.doc.cw = SIZES[idx][1]; this.doc.ch = SIZES[idx][2]; this.commit(); this.emitChange();
  }

  private save() { try { this.storage?.setItem(STORAGE_KEY, this.snapshot()); } catch { /* bỏ qua */ } }
  private load() {
    try {
      const j = this.storage?.getItem(STORAGE_KEY);
      if (j) { const o = JSON.parse(j); if (o && o.v === 1) this.doc = o; }
    } catch { /* bỏ qua */ }
  }
}
