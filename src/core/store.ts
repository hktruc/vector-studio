import { DOC_VERSION, type Doc, type LibItem, type Shape } from './types';
import { COLORS, SIZES, STORAGE_KEY } from './constants';
import { defaultParams, getShape } from '../shapes/registry';
import { alignShapes, distributeShapes, unitsOf, type AlignMode } from './align';
import { isConnector, syncConnectors } from './connect';
import { bboxOf } from './transform';
import { layout, type LayoutKind } from './layout';
import { textWidth } from './text';

type Listener = () => void;

/**
 * Nâng cấp tài liệu cũ lên định dạng hiện tại. Trả về null nếu không đọc được.
 * v1 → v2: thêm Shape.gid (không bắt buộc), nên chỉ cần đổi số phiên bản.
 * v2 → v3: thêm name/hidden/locked, gnames (đều không bắt buộc).
 */
export function migrateDoc(o: any): Doc | null {
  if (!o || typeof o !== 'object' || !Array.isArray(o.shapes)) return null;
  if (o.v === 1) o = { ...o, v: 2 };
  if (o.v === 2) o = { ...o, v: 3 };
  if (o.v === 3) o = { ...o, v: 4 }; // v3 → v4: thêm grad (không bắt buộc)
  if (o.v === 4) o = { ...o, v: 5 }; // v4 → v5: thêm label/lc, hình 'connector', 'image' (đều mới, không cần đổi dữ liệu cũ)
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

const refitOf = (t: string) => { try { return getShape(t).refit; } catch { return undefined; } };

/** Hình chọn được trên khung: không ẩn, không khóa. */
export const selectable = (s: Shape) => !s.hidden && !s.locked;

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

  /** Nguồn màu cho hình mới (mặc định là bảng màu có sẵn; app gắn bộ màu thương hiệu vào đây). */
  colorSource: () => string[] = () => COLORS;

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = null) {
    this.load();
    this.undoStack = [this.snapshot()];
  }

  /** Đăng ký nghe: 'change' = vẽ lại khung; 'select' = dựng lại bảng thuộc tính. */
  on(ev: 'change' | 'select', fn: Listener) {
    (ev === 'change' ? this.onChange : this.onSelect).add(fn);
  }
  /** Báo vẽ lại; trước đó cập nhật đường nối theo vị trí hình mới nhất. */
  emitChange() {
    for (const s of this.doc.shapes) { const r = refitOf(s.t); if (r) r(s); } // hình tự chỉnh khung (đường cong)
    syncConnectors(this.doc);
    this.onChange.forEach((f) => f());
  }
  /** Gọi khi không lưu được vào trình duyệt (thường do bộ nhớ đầy vì ảnh quá lớn). */
  onSaveError: (e: unknown) => void = () => {};
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
    return l.length === this.doc.shapes.filter((s) => s.gid === g && selectable(s)).length ? g : undefined;
  }

  /** id kèm toàn bộ thành viên cùng nhóm; bỏ hình đang ẩn hoặc khóa. */
  private withGroup(ids: number[]): number[] {
    const gids = new Set(this.doc.shapes.filter((s) => ids.includes(s.id) && s.gid !== undefined).map((s) => s.gid));
    return this.doc.shapes.filter((s) => selectable(s) && (ids.includes(s.id) || (s.gid !== undefined && gids.has(s.gid)))).map((s) => s.id);
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
    syncConnectors(this.doc);
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

  private nextColor() { const c = this.colorSource(); return c[this.colorIdx++ % c.length]; }

  /**
   * Thêm hình từ thư viện. at: tâm hình (mặc định giữa trang, lệch nhẹ để không chồng khít);
   * size/rot: khi người dùng vẽ bằng kéo chuột.
   */
  addFromLibrary(it: LibItem, at?: { x: number; y: number }, size?: { w: number; h: number }, rot = 0): Shape {
    const n = this.doc.shapes.length % 5 - 2;
    const pos = at ?? { x: this.doc.cw / 2 + n * 14, y: this.doc.ch / 2 + n * 14 };
    return this.addShape({ t: it.t, x: pos.x, y: pos.y, w: size?.w ?? it.w, h: size?.h ?? it.h, r: rot, p: { ...(it.p || {}) }, name: it.n });
  }

  /** Thêm một hình bất kỳ (các trường thiếu lấy mặc định), chọn nó, ghi mốc hoàn tác. */
  addShape(o: Partial<Shape> & { t: string }, select = true): Shape {
    const s: Shape = {
      id: this.doc.seq++, x: this.doc.cw / 2, y: this.doc.ch / 2, w: 160, h: 100, r: 0, fx: 1, fy: 1,
      fill: o.t === 'text' ? '#1B2A3A' : o.t === 'connector' ? '#445566' : o.fill ?? this.nextColor(),
      stroke: '#12497A', sw: 0, op: 1,
      ...o,
      p: { ...defaultParams(o.t), ...(o.p || {}) },
    };
    if (s.t === 'connector') this.doc.shapes.unshift(s); // đường nối nằm dưới cùng, không che hình
    else this.doc.shapes.push(s);
    if (s.t === 'text') this.fitTextShape(s);
    if (select) this.sel = [s.id];
    syncConnectors(this.doc);
    this.commit(); this.emitSelect();
    return s;
  }

  /** Hình chữ (kiểu 'text') tự giãn bề rộng theo nội dung. */
  private fitTextShape(s: Shape) {
    const size = +s.p.size || 36;
    s.w = Math.max(40, Math.round(textWidth(String(s.p.text ?? ''), size, !!s.p.bold) + size * 0.8));
    s.h = Math.max(s.h, Math.round(size * 1.5));
  }

  /** Đặt chữ cho hình (bấm đúp vào hình để gõ). Với hình chữ thì đổi nội dung và tự giãn. */
  setLabel(id: number, text: string) {
    const s = this.doc.shapes.find((x) => x.id === id); if (!s) return;
    if (s.t === 'text') { s.p.text = text.replace(/\s*\n\s*/g, ' ').trim() || 'Văn bản'; this.fitTextShape(s); }
    else if (text.trim()) s.label = text.replace(/\s+$/, ''); else delete s.label;
    this.commit(); this.emitChange();
  }

  /* ---------- Đường nối ---------- */

  /** Nối hai hình bằng một đường nối (mũi tên ở đầu b). Trả về đường nối. */
  connect(a: number, b: number, p: Record<string, any> = {}): Shape | undefined {
    const A = this.doc.shapes.find((s) => s.id === a), B = this.doc.shapes.find((s) => s.id === b);
    if (!A || !B || a === b || isConnector(A) || isConnector(B)) return;
    return this.addShape({ t: 'connector', p: { ...p, a, b }, name: 'Đường nối' }, false);
  }

  /** Nối các hình đang chọn theo thứ tự trái → phải / trên → dưới (chuỗi). */
  connectSelection() {
    const list = this.selection.filter((s) => !isConnector(s)).sort((p, q) => (p.x - q.x) || (p.y - q.y));
    for (let i = 1; i < list.length; i++) this.connect(list[i - 1].id, list[i].id);
  }

  /**
   * Phím Tab: tạo hình kế tiếp giống hình đang chọn (cùng loại, cỡ, màu, chưa có chữ) đặt kề bên chỗ trống
   * (ưu tiên bên phải, rồi dưới, trên, trái) và nối hai hình. Trả về hình mới.
   */
  addNext(fromId?: number): Shape | undefined {
    const src = this.doc.shapes.find((s) => s.id === (fromId ?? this.selected?.id));
    if (!src || isConnector(src)) return;
    const gap = 80, b = bboxOf([src]), W = b.x1 - b.x0, H = b.y1 - b.y0;
    const others = this.doc.shapes.filter((s) => !isConnector(s) && !s.hidden).map((s) => bboxOf([s]));
    const free = (x: number, y: number) => others.every((o) => o.x1 < x - W / 2 - 10 || o.x0 > x + W / 2 + 10 || o.y1 < y - H / 2 - 10 || o.y0 > y + H / 2 + 10);
    const sib = this.doc.shapes.filter((s) => isConnector(s) && s.p.a === src.id).length; // đã có bao nhiêu nhánh
    const cands: [number, number][] = [];
    for (let k = 0; k < 8; k++) cands.push([src.x + W + gap, src.y + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (H + 30)]);
    cands.push([src.x, src.y + H + gap], [src.x, src.y - H - gap], [src.x - W - gap, src.y]);
    const [x, y] = cands.find(([cx, cy]) => free(cx, cy)) ?? [src.x + W + gap, src.y + (sib + 1) * (H + 30)];
    const n = this.addShape({ t: src.t, x, y, w: src.w, h: src.h, r: src.r, fx: src.fx, fy: src.fy, fill: src.fill, stroke: src.stroke, sw: src.sw, op: src.op, grad: src.grad ? { ...src.grad } : undefined, lc: src.lc, p: JSON.parse(JSON.stringify(src.p)), name: src.name });
    if (n.t === 'text') { n.p.text = 'Ý mới'; this.fitTextShape(n); }
    const conn = this.doc.shapes.find((s) => isConnector(s) && s.p.b === src.id) ?? this.doc.shapes.find((s) => isConnector(s) && s.p.a === src.id);
    this.connect(src.id, n.id, conn ? { style: conn.p.style, th: conn.p.th, sa: conn.p.sa, ea: conn.p.ea } : {});
    this.sel = [n.id]; this.emitSelect();
    return n;
  }

  /* ---------- Tự bố trí ---------- */

  /** Bố trí lại vùng chọn (hoặc cả trang nếu chưa chọn gì) thành cây, vòng hoặc lưới theo các đường nối. */
  autoLayout(kind: LayoutKind) {
    const pool = (this.sel.length ? this.selection : this.doc.shapes.filter((s) => !s.hidden && !s.locked)).filter((s) => !isConnector(s));
    const us = unitsOf(pool); if (us.length < 2) return;
    const idx = new Map<number, number>(); us.forEach((u, i) => u.forEach((s) => idx.set(s.id, i)));
    const edges: [number, number][] = this.doc.shapes.filter(isConnector)
      .map((c) => [idx.get(c.p.a), idx.get(c.p.b)] as [number | undefined, number | undefined])
      .filter((e): e is [number, number] => e[0] !== undefined && e[1] !== undefined && e[0] !== e[1]);
    const boxes = us.map((u) => bboxOf(u));
    const pos = layout(kind, boxes, edges);
    us.forEach((u, i) => { const b = boxes[i], dx = pos[i].x - (b.x0 + b.x1) / 2, dy = pos[i].y - (b.y0 + b.y1) / 2; u.forEach((s) => { s.x += dx; s.y += dy; }); });
    this.commit(); this.emitChange();
  }

  /* ---------- Sao chép / dán ---------- */

  /** Chuỗi JSON của vùng chọn (kèm đường nối mà cả hai đầu đều được chọn). */
  copySelection(): string | null {
    const sel = this.selection;
    const ids = new Set(sel.filter((s) => !isConnector(s)).map((s) => s.id));
    const list = sel.filter((s) => !isConnector(s)); if (!list.length) return null;
    // chỉ chép đường nối khi chép cả hai hình ở hai đầu
    const conns = this.doc.shapes.filter((c) => isConnector(c) && ids.has(c.p.a) && ids.has(c.p.b));
    return JSON.stringify({ kind: 'vector-studio/shapes', v: DOC_VERSION, shapes: [...conns, ...list], gnames: this.doc.gnames || {} });
  }

  /**
   * Dán hình đã sao chép: cấp id mới, nhóm mới, nối lại đường nối. at: tâm vùng dán (mặc định lệch 20px).
   * Trả về số hình đã dán (0 nếu chuỗi không phải dữ liệu của Vector Studio).
   */
  pasteShapes(json: string, at?: { x: number; y: number }): number {
    let o: any; try { o = JSON.parse(json); } catch { return 0; }
    if (!o || o.kind !== 'vector-studio/shapes' || !Array.isArray(o.shapes) || !o.shapes.length) return 0;
    const src: Shape[] = o.shapes;
    const real = src.filter((s) => !isConnector(s));
    const b = bboxOf(real.length ? real : src);
    const dx = at ? at.x - (b.x0 + b.x1) / 2 : 20, dy = at ? at.y - (b.y0 + b.y1) / 2 : 20;
    const idMap = new Map<number, number>(), gMap = new Map<number, number>();
    for (const s of src) idMap.set(s.id, this.doc.seq++);
    const out: Shape[] = src.filter((s) => !isConnector(s) || (idMap.has(s.p.a) && idMap.has(s.p.b))).map((s) => {
      const c: Shape = JSON.parse(JSON.stringify(s));
      c.id = idMap.get(s.id)!; c.x += dx; c.y += dy; delete c.hidden; delete c.locked;
      if (c.gid !== undefined) {
        if (!gMap.has(c.gid)) { const g = this.doc.seq++; gMap.set(c.gid, g); const nm = o.gnames?.[c.gid]; if (nm) this.doc.gnames = { ...(this.doc.gnames || {}), [g]: nm }; }
        c.gid = gMap.get(c.gid);
      }
      if (isConnector(c)) { c.p.a = idMap.get(c.p.a); c.p.b = idMap.get(c.p.b); }
      return c;
    });
    const conns = out.filter(isConnector), rest = out.filter((s) => !isConnector(s));
    this.doc.shapes = [...conns, ...this.doc.shapes, ...rest];
    this.sel = rest.map((s) => s.id);
    syncConnectors(this.doc);
    this.commit(); this.emitSelect();
    return out.length;
  }
  /** Nhân đôi các hình đang chọn (nhóm thành nhóm mới, đường nối giữa chúng được nối lại). */
  duplicate() {
    const j = this.copySelection(); if (j) this.pasteShapes(j);
  }
  remove() {
    if (!this.sel.length) return;
    const set = new Set(this.sel);
    // xóa luôn đường nối mất một đầu
    this.doc.shapes = this.doc.shapes.filter((x) => !set.has(x.id) && !(isConnector(x) && (set.has(x.p.a) || set.has(x.p.b))));
    this.sel = []; this.commit(); this.emitSelect();
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
    list.forEach((s) => { if (this.doc.gnames) delete this.doc.gnames[s.gid!]; delete s.gid; });
    this.commit(); this.emitSelect();
  }

  /* ---------- Panel lớp: tên, ẩn, khóa ---------- */

  rename(id: number, name: string) {
    const s = this.doc.shapes.find((x) => x.id === id); if (!s) return;
    const n = name.trim(); if (n) s.name = n; else delete s.name;
    this.commit(); this.emitChange();
  }
  renameGroup(gid: number, name: string) {
    const n = name.trim(), g = { ...(this.doc.gnames || {}) };
    if (n) g[gid] = n; else delete g[gid];
    this.doc.gnames = g; this.commit(); this.emitChange();
  }
  /** Ẩn/hiện các hình. Hình bị ẩn được bỏ khỏi vùng chọn. */
  setHidden(ids: number[], on: boolean) { this.setFlag(ids, 'hidden', on); }
  /** Khóa/mở khóa các hình. Hình bị khóa được bỏ khỏi vùng chọn. */
  setLocked(ids: number[], on: boolean) { this.setFlag(ids, 'locked', on); }
  private setFlag(ids: number[], k: 'hidden' | 'locked', on: boolean) {
    const set = new Set(ids), list = this.doc.shapes.filter((s) => set.has(s.id)); if (!list.length) return;
    list.forEach((s) => { if (on) s[k] = true; else delete s[k]; });
    const before = this.sel.length;
    this.sel = this.sel.filter((id) => selectable(this.doc.shapes.find((s) => s.id === id)!));
    this.commit();
    if (this.sel.length !== before) this.emitSelect(); else this.emitChange();
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
    alignShapes(list.filter((s) => !isConnector(s)), mode, { x0: 0, y0: 0, x1: this.doc.cw, y1: this.doc.ch });
    this.commit(); this.emitChange();
  }
  /** Phân bố đều theo chiều ngang ('h') hoặc dọc ('v'); cần ≥ 3 khối. */
  distribute(axis: 'h' | 'v'): boolean {
    const ok = distributeShapes(this.selection.filter((s) => !isConnector(s)), axis);
    if (ok) { this.commit(); this.emitChange(); }
    return ok;
  }
  /** Số khối (hình lẻ hoặc nhóm) trong vùng chọn. */
  get selectionUnits() { return unitsOf(this.selection).length; }

  setCanvasSize(idx: number) {
    this.doc.sizeIdx = idx; this.doc.cw = SIZES[idx][1]; this.doc.ch = SIZES[idx][2]; this.commit(); this.emitChange();
  }

  private save() { try { this.storage?.setItem(STORAGE_KEY, this.snapshot()); } catch (e) { this.onSaveError(e); } }
  private load() {
    try {
      const j = this.storage?.getItem(STORAGE_KEY);
      if (j) { const o = migrateDoc(JSON.parse(j)); if (o) { this.doc = o; syncConnectors(this.doc); } }
    } catch { /* bỏ qua */ }
  }
}
