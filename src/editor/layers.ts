import type { Shape } from '../core/types';
import { selectable, type DocStore } from '../core/store';
import { shapeToSVG } from '../core/export';
import { bboxOf } from '../core/transform';
import { unitsOf } from '../core/align';
import { shapeLabel } from '../shapes';

const esc = (t: unknown) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const ico = (d: string) => `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const EYE = ico('<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/>');
const EYE_OFF = ico('<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" opacity=".35"/><path d="M2.5 13.5 13.5 2.5"/>');
const LOCK = ico('<rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>');
const UNLOCK = ico('<rect x="3.5" y="7" width="9" height="6.5" rx="1.2" opacity=".35"/><path d="M5.5 7V5a2.5 2.5 0 0 1 4.8-1" opacity=".35"/>');
const CARET = (open: boolean) => `<svg viewBox="0 0 10 10" width="10" height="10"><path d="${open ? 'M1.5 3h7L5 7.5z' : 'M3 1.5v7L7.5 5z'}" fill="currentColor"/></svg>`;

/** Ảnh thu nhỏ của hình (dùng đúng shapeToSVG như khung vẽ). */
function thumb(list: Shape[]) {
  const shown = list.filter((s) => !s.hidden), src = shown.length ? shown : list;
  const b = bboxOf(src), w = Math.max(1, b.x1 - b.x0), h = Math.max(1, b.y1 - b.y0), pad = Math.max(w, h) * 0.08;
  const body = src.map((s) => shapeToSVG({ ...s, hidden: false }, 'lt')).join('');
  return `<svg class="th" viewBox="${b.x0 - pad} ${b.y0 - pad} ${w + pad * 2} ${h + pad * 2}">${body}</svg>`;
}

/** Panel lớp: danh sách hình (trên cùng ở đầu), chọn, đổi tên (bấm đúp), ẩn, khóa. */
export class LayersPanel {
  private open = new Set<number>(); // các nhóm đang mở rộng
  private queued = false;
  /** Gọi sau mỗi lần dựng lại (để cập nhật số đếm trên thẻ). */
  onRender: (count: number) => void = () => {};

  constructor(private root: HTMLElement, private store: DocStore) {
    const later = () => this.schedule();
    store.on('change', later);
    store.on('select', later);
    this.render();
  }

  private schedule() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.render(); });
  }

  render() {
    const R = this.root, st = this.store;
    if (R.querySelector('input:focus')) return; // đang đổi tên: không dựng lại
    const shapes = st.doc.shapes;
    this.onRender(shapes.length);
    if (!shapes.length) { R.innerHTML = `<p class="empty">Chưa có hình nào. Bấm một hình ở thẻ <b>Hình</b> để thêm vào khung.</p>`; return; }
    const us = unitsOf(shapes).reverse(); // trên cùng ở đầu danh sách
    let h = '<div class="lyr">';
    for (const u of us) {
      const gid = u[0].gid;
      if (gid !== undefined && u.length > 1) {
        const op = this.open.has(gid);
        const name = st.doc.gnames?.[gid] || 'Nhóm';
        h += this.row(u, name, `data-g="${gid}"`, `<button class="cr" data-open="${gid}" title="${op ? 'Thu gọn' : 'Mở rộng'}">${CARET(op)}</button>`, 0);
        if (op) for (const s of [...u].reverse()) h += this.row([s], shapeLabel(s), `data-id="${s.id}"`, '', 1);
      } else h += this.row(u, shapeLabel(u[0]), `data-id="${u[0].id}"`, '', 0);
    }
    h += '</div><p class="hint">Bấm để chọn · Shift+bấm chọn thêm · bấm đúp vào tên để đổi tên.<br>Hình bị ẩn sẽ không có trong file xuất. Hình bị khóa không kéo nhầm được trên khung.</p>';
    R.innerHTML = h;
    this.wire();
  }

  private row(list: Shape[], name: string, key: string, lead: string, depth: number) {
    const st = this.store;
    const hidden = list.every((s) => s.hidden), locked = list.every((s) => s.locked);
    const sel = list.some((s) => st.isSelected(s.id));
    const cls = ['row', sel ? 'on' : '', hidden ? 'off' : '', depth ? 'kid' : ''].join(' ');
    return `<div class="${cls}" ${key}>${lead || '<span class="cr"></span>'}${thumb(list)}<span class="nm" title="Bấm đúp để đổi tên">${esc(name)}</span>`
      + `<button class="ic${hidden ? ' act' : ''}" data-act="hide" title="${hidden ? 'Hiện' : 'Ẩn'}">${hidden ? EYE_OFF : EYE}</button>`
      + `<button class="ic${locked ? ' act' : ''}" data-act="lock" title="${locked ? 'Mở khóa' : 'Khóa'}">${locked ? LOCK : UNLOCK}</button></div>`;
  }

  /** Các hình mà một dòng đại diện (một hình, hoặc cả nhóm). */
  private idsOf(row: HTMLElement): number[] {
    if (row.dataset.g) { const g = +row.dataset.g; return this.store.doc.shapes.filter((s) => s.gid === g).map((s) => s.id); }
    return [+row.dataset.id!];
  }

  private wire() {
    const R = this.root, st = this.store;
    R.querySelectorAll<HTMLElement>('.row').forEach((row) => {
      const ids = this.idsOf(row);
      const list = () => st.doc.shapes.filter((s) => ids.includes(s.id));
      row.onclick = (e) => {
        const t = e.target as HTMLElement;
        const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
        const open = t.closest<HTMLElement>('[data-open]')?.dataset.open;
        if (open) { const g = +open; this.open.has(g) ? this.open.delete(g) : this.open.add(g); this.render(); return; }
        if (act === 'hide') { st.setHidden(ids, !list().every((s) => s.hidden)); return; }
        if (act === 'lock') { st.setLocked(ids, !list().every((s) => s.locked)); return; }
        const target = list().find(selectable);
        if (!target) return; // hình đang ẩn/khóa: bấm biểu tượng để mở trước
        if (e.shiftKey) st.toggle(target.id); else st.select(target.id);
      };
      const nm = row.querySelector<HTMLElement>('.nm')!;
      nm.ondblclick = (e) => { e.stopPropagation(); this.startRename(row, nm); };
    });
  }

  private startRename(row: HTMLElement, nm: HTMLElement) {
    const st = this.store, inp = document.createElement('input');
    inp.type = 'text'; inp.value = nm.textContent || ''; inp.className = 'nmi';
    nm.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (save: boolean) => {
      if (done) return; done = true;
      const v = inp.value;
      inp.blur();
      if (save) row.dataset.g ? st.renameGroup(+row.dataset.g, v) : st.rename(+row.dataset.id!, v);
      this.render();
    };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); };
    inp.onblur = () => finish(true);
    inp.onclick = (e) => e.stopPropagation();
  }
}
