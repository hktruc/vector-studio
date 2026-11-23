import { DOC_VERSION, type Doc, type LibItem, type Shape } from './types';
import { COLORS, SIZES, STORAGE_KEY } from './constants';
import { defaultParams } from '../shapes/registry';
import { alignShapes, distributeShapes, unitsOf, type AlignMode } from './align';

type Listener = () => void;

/**
 * Nâng cấp tài liệu cũ lên định dạng hiện tại. Trả về null nếu không đọc được.
 * v1 → v2: thêm Shape.gid (không bắt buộc), nên chỉ cần đổi số phiên bản.
 */
export function migrateDoc(o: any): Doc | null {
  if (!o || typeof o !== 'object' || !Array.isArray(o.shapes)) return null;
  if (o.v === 1) o = { ...o, v: 2 };
  if (o.v !== DOC_VERSION) return null;
  return o as Doc;
}

/** Một "khối" trong thứ tự lớp: một hình lẻ hoặc cả một nhóm (các hình liền nhau cùng gid). */
function units(shapes: Shape[]): Shape[][] {
  const out: Shape[][] = [];
  for (const s of shapes) {
    const last = out[out.length - 1];
    if (last && s.gid !== undefined && last[0].gid === s.gid) last.push(s);
    else out.push([s]);
  }
  return out;
}

/** Trạng thái tài liệu + chọn hình (một hoặc nhiều) + hoàn tác/làm lại. Không biết gì về giao diện. */
export class DocStore {
  doc: Doc = { v: DOC_VERSION, cw: SIZES[0][1], ch: SIZES[0][2], sizeIdx: 0, seq: 1, shapes: [] };
  /** Danh sách id đang chọn. Chọn một hình trong nhóm luôn chọn cả nhóm. */
  sel: number[] = [];
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

  /* ---------- Chọn hình ---------- */

  /** Các hình đang chọn, theo thứ tự lớp (dưới → trên). */
  get selection(): Shape[] { const set = new Set(this.sel); return this.doc.shapes.filter((s) => set.has(s.id)); }
  /** Hình đang chọn nếu chỉ chọn đúng một hình lẻ; ngược lại undefined. */
  get selected(): Shape | undefined { const l = this.selection; return l.length === 1 ? l[0] : undefined; }
  /** gid chung nếu vùng chọn đúng bằng một nhóm. */
  get selectedGroup(): number | undefined {
    const l = this.selection, g = l[0]?.gid;
    if (g === undefined || l.some((s) => s.gid !== g)) return undefined;
    return l.length === this.doc.shapes.filter((s) => s.gid === g).length ? g : undefined;
  }

  /** id kèm toàn bộ thành viên cùng nhóm. */
  private withGroup(ids: number[]): number[] {
    const gids = new Set(this.doc.shapes.filter((s) => ids.includes(s.id) && s.gid !== undefined).map((s) => s.gid));
    return this.doc.shapes.filter((s) => ids.includes(s.id) || (s.gid !== undefined && gids.has(s.gid))).map((s) => s.id);
  }
  private setSel(ids: number[]) {
    const next = this.withGroup(ids);
    if (next.length === this.sel.length && next.every((id) => this.sel.includes(id))) return;
    this.sel = next; this.emitSelect();
  }
  /** Chọn một hình (cả nhóm của nó), hoặc bỏ chọn với null. */
  select(id: number | null) { this.setSel(id === null ? [] : [id]); }
  /** Chọn đúng danh sách này (dùng cho quét chọn). */
  selectMany(ids: number[]) { this.setSel(ids); }
  /** Thêm/bớt một hình (cả nhóm) khỏi vùng chọn — Shift + bấm. */
  toggle(id: number) {
    const unit = this.withGroup([id]);
    const on = unit.every((u) => this.sel.includes(u));
    this.setSel(on ? this.sel.filter((s) => !unit.includes(s)) : [...this.sel, ...unit]);
  }
  selectAll() { this.setSel(this.doc.shapes.map((s) => s.id)); }
  isSelected(id: number) { return this.sel.includes(id); }

  /* ---------- Hoàn tác ---------- */

  private snapshot() { return JSON.stringify(this.doc); }
  private restore(j: string) {
    this.doc = JSON.parse(j);
    const ids = new Set(this.doc.shapes.map((s) => s.id));
    this.sel = this.withGroup(this.sel.filter((id) => ids.has(id)));
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

  /* ---------- Thêm / xóa / nhân đôi ---------- */

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
    this.sel = [s.id];
    this.commit(); this.emitSelect();
    return s;
  }
  /** Nhân đôi các hình đang chọn (nhóm được nhân đôi thành nhóm mới). */
  duplicate() {
    const list = this.selection; if (!list.length) return;
    const gmap = new Map<number, number>();
    const copies = list.map((s) => {
      const c: Shape = JSON.parse(JSON.stringify(s));
      c.id = this.doc.seq++; c.x += 20; c.y += 20;
      if (s.gid !== undefined) { if (!gmap.has(s.gid)) gmap.set(s.gid, this.doc.seq++); c.gid = gmap.get(s.gid); }
      return c;
    });
    this.doc.shapes.push(...copies); this.sel = copies.map((c) => c.id); this.commit(); this.emitSelect();
  }
  remove() {
    if (!this.sel.length) return;
    const set = new Set(this.sel);
    this.doc.shapes = this.doc.shapes.filter((x) => !set.has(x.id)); this.sel = []; this.commit(); this.emitSelect();
  }
  clear() { if (!this.doc.shapes.length) return; this.doc.shapes = []; this.sel = []; this.commit(); this.emitSelect(); }

  /* ---------- Nhóm ---------- */

  /** Gộp các hình đang chọn (≥ 2) thành một nhóm. Nhóm cũ bên trong được gộp luôn. Trả về gid mới. */
  group(): number | undefined {
    const list = this.selection; if (list.length < 2) return;
    const gid = this.doc.seq++;
    const set = new Set(this.sel);
    // đưa các thành viên về liền nhau, đặt tại vị trí của thành viên trên cùng
    const a = this.doc.shapes;
    const top = Math.max(...list.map((s) => a.indexOf(s)));
    const below = a.slice(0, top + 1).filter((s) => !set.has(s.id));
    const above = a.slice(top + 1);
    list.forEach((s) => (s.gid = gid));
    this.doc.shapes = [...below, ...list, ...above];
    this.commit(); this.emitSelect();
    return gid;
  }
  /** Bỏ nhóm: các hình đang chọn trở thành hình lẻ (vẫn giữ nguyên vùng chọn). */
  ungroup() {
    const list = this.selection.filter((s) => s.gid !== undefined); if (!list.length) return;
    list.forEach((s) => delete s.gid);
    this.commit(); this.emitSelect();
  }

  /* ---------- Thứ tự lớp ---------- */

  /** d: ±1 lên/xuống một lớp, hoặc 'top' / 'bottom'. Nhóm luôn di chuyển nguyên khối. */
  moveLayer(d: number | 'top' | 'bottom') {
    if (!this.sel.length) return;
    const set = new Set(this.sel);
    let u = units(this.doc.shapes);
    const isSel = (x: Shape[]) => x.some((s) => set.has(s.id));
    if (d === 'top') u = [...u.filter((x) => !isSel(x)), ...u.filter(isSel)];
    else if (d === 'bottom') u = [...u.filter(isSel), ...u.filter((x) => !isSel(x))];
    else {
      const order = d > 0 ? [...u.keys()].reverse() : [...u.keys()];
      for (const i of order) {
        const j = i + (d > 0 ? 1 : -1);
        if (isSel(u[i]) && j >= 0 && j < u.length && !isSel(u[j])) [u[i], u[j]] = [u[j], u[i]];
      }
    }
    this.doc.shapes = u.flat(); this.commit(); this.emitChange();
  }
  /* ---------- Căn chỉnh ---------- */

  /** Căn vùng chọn; chọn một hình/một nhóm thì căn theo trang. */
  align(mode: AlignMode) {
    const list = this.selection; if (!list.length) return;
    alignShapes(list, mode, { x0: 0, y0: 0, x1: this.doc.cw, y1: this.doc.ch });
    this.commit(); this.emitChange();
  }
  /** Phân bố đều theo chiều ngang ('h') hoặc dọc ('v'); cần ≥ 3 khối. */
  distribute(axis: 'h' | 'v'): boolean {
    const ok = distributeShapes(this.selection, axis);
    if (ok) { this.commit(); this.emitChange(); }
    return ok;
  }
  /** Số khối (hình lẻ hoặc nhóm) trong vùng chọn. */
  get selectionUnits() { return unitsOf(this.selection).length; }

  setCanvasSize(idx: number) {
    this.doc.sizeIdx = idx; this.doc.cw = SIZES[idx][1]; this.doc.ch = SIZES[idx][2]; this.commit(); this.emitChange();
  }

  private save() { try { this.storage?.setItem(STORAGE_KEY, this.snapshot()); } catch { /* bỏ qua */ } }
  private load() {
    try {
      const j = this.storage?.getItem(STORAGE_KEY);
      if (j) { const o = migrateDoc(JSON.parse(j)); if (o) this.doc = o; }
    } catch { /* bỏ qua */ }
  }
}
