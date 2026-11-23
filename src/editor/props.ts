import type { DocStore } from '../core/store';
import { getShape } from '../shapes/registry';
import type { Shape } from '../core/types';
import type { BrandPalette } from '../core/palette';
import { mix } from '../core/color';
import { isConnector } from '../core/connect';
import { canConvertToPath, nodeCount, type NodeRef } from '../core/pathedit';
import type { ArrayKind } from '../core/repeat';

const esc = (t: unknown) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const $ = <T extends HTMLElement>(root: HTMLElement, id: string) => root.querySelector<T>('#' + id)!;

const HELP = `<div class="empty"><b>Đổ ý ra nhanh</b><br>• <b>Bấm đúp</b> chỗ trống (hoặc phím <b>/</b>) rồi gõ “tròn”, “mũi tên”… Enter. Gõ chữ bất kỳ để thêm chữ.<br>• <b>Kéo</b> hình từ cột trái thả vào khung; <b>nhấn giữ</b> hình rồi kéo trên khung để vẽ đúng cỡ. Phím <b>R</b> chữ nhật · <b>O</b> tròn · <b>A</b> mũi tên · <b>T</b> chữ · <b>L</b> đường kẻ · <b>C</b> đường cong.<br>• <b>Hình sống:</b> chọn hình rồi kéo <b>hình thoi vàng</b> để đổi góc quạt, đầu mũi tên, bo góc, số tầng… Nút <b>Chuyển thành đường</b> để sửa điểm neo và uốn cạnh.<br>• <b>Đường cong:</b> chọn đường cong rồi kéo chấm xanh (đầu mút) hoặc hình thoi hồng (hướng, độ cong từng đầu) ngay trên khung.<br>• <b>Bấm đúp vào hình</b> (hoặc Enter) để gõ chữ lên hình. Khi gõ, nhấn <b>Tab</b> để tạo ý tiếp theo đã nối sẵn.<br>• Dán ảnh, mã SVG, hay danh sách chữ (Ctrl+V) thẳng vào khung.<br>• Ctrl + cuộn chuột để thu phóng, giữ phím cách rồi kéo để dời khung nhìn.<br><br><b>Cách dùng</b><br>① Bấm một hình ở cột trái để thêm vào khung.<br>② Kéo để di chuyển, kéo ô vuông nhỏ để đổi cỡ (giữ Shift để giữ tỉ lệ), kéo chấm tròn phía trên để xoay.<br>③ Chọn hình để đổi màu, góc quạt, số tầng…<br>④ Bấm <b>Tải SVG</b> rồi kéo file vào Canva.<br><br><b>Chọn nhiều:</b> giữ Shift rồi bấm từng hình, hoặc kéo chuột trên vùng trống để quét chọn. Ctrl+A chọn tất cả.<br><b>Nhóm:</b> Ctrl+G nhóm · Ctrl+Shift+G bỏ nhóm.<br><b>Lớp:</b> thẻ <b>Lớp</b> ở cột trái để đổi tên, ẩn, khóa. Ctrl+Shift+H ẩn · Ctrl+Shift+L khóa hình đang chọn.<br><b>Căn chỉnh:</b> chọn hình rồi dùng các nút căn ở cột này. Khi kéo, đường gióng hồng hiện ra lúc thẳng hàng với hình khác hoặc giữa trang (giữ Alt để tạm tắt).<br><br>Phím tắt: Delete xóa · Ctrl+D nhân đôi · Ctrl+Z hoàn tác · phím mũi tên nhích hình · Esc bỏ chọn.<br><br>Chữ sẽ không bị đổi sang đường nét; Canva có thể đổi font, nên gõ chữ trong Canva cho chắc.</div>`;

/* Biểu tượng 16×16 cho các nút căn chỉnh */
const ic = (body: string) => `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">${body}</svg>`;
const ln = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="currentColor" stroke-width="1.5"/>`;
const rc = (x: number, y: number, w: number, h: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" opacity=".75"/>`;
const ALIGN: [string, string, string][] = [
  ['left', 'Căn trái', ic(ln(2, 1, 2, 15) + rc(4, 3, 9, 4) + rc(4, 9, 6, 4))],
  ['hcenter', 'Căn giữa (ngang)', ic(ln(8, 1, 8, 15) + rc(3, 3, 10, 4) + rc(5, 9, 6, 4))],
  ['right', 'Căn phải', ic(ln(14, 1, 14, 15) + rc(3, 3, 9, 4) + rc(6, 9, 6, 4))],
  ['top', 'Căn trên', ic(ln(1, 2, 15, 2) + rc(3, 4, 4, 9) + rc(9, 4, 4, 6))],
  ['vcenter', 'Căn giữa (dọc)', ic(ln(1, 8, 15, 8) + rc(3, 3, 4, 10) + rc(9, 5, 4, 6))],
  ['bottom', 'Căn dưới', ic(ln(1, 14, 15, 14) + rc(3, 3, 4, 9) + rc(9, 7, 4, 6))],
];
const DIST: [string, string, string][] = [
  ['h', 'Phân bố đều theo chiều ngang', ic(ln(1, 1, 1, 15) + ln(15, 1, 15, 15) + rc(3, 4, 3, 8) + rc(10, 4, 3, 8))],
  ['v', 'Phân bố đều theo chiều dọc', ic(ln(1, 1, 15, 1) + ln(1, 15, 15, 15) + rc(4, 3, 8, 3) + rc(4, 10, 8, 3))],
];

/* Biểu tượng phép toán hình: hai hình tròn chồng nhau, phần tô là kết quả */
const A_ = 'M1 7a6 6 0 1 0 12 0a6 6 0 1 0-12 0', B_ = 'M7 7a6 6 0 1 0 12 0a6 6 0 1 0-12 0', LENS = 'M10 1.8A6 6 0 0 1 10 12.2A6 6 0 0 1 10 1.8Z';
const bi = (body: string) => `<svg viewBox="0 0 20 14" width="22" height="16">${body}</svg>`;
const BOOL: [string, string, string][] = [
  ['union', 'Hợp', bi(`<path d="${A_} ${B_}" fill="currentColor"/>`)],
  ['subtract', 'Trừ', bi(`<path d="${A_}" fill="currentColor"/><path d="${B_}" fill="#fff" stroke="currentColor" stroke-dasharray="2 1.5"/>`)],
  ['intersect', 'Giao', bi(`<path d="${A_} ${B_}" fill="none" stroke="currentColor" stroke-dasharray="2 1.5"/><path d="${LENS}" fill="currentColor"/>`)],
  ['exclude', 'Loại trừ', bi(`<path d="${A_} ${B_}" fill="currentColor" fill-rule="evenodd"/>`)],
];

/** Khối nút căn chỉnh. toPage: chỉ có một hình/nhóm → căn theo trang. */
function alignHTML(toPage: boolean, canDistribute: boolean) {
  let h = `<div class="grp">${toPage ? 'Căn theo trang' : 'Căn chỉnh'}</div><div class="algn">`;
  for (const [k, t, i] of ALIGN) h += `<button class="b alt ib" data-al="${k}" title="${t}">${i}</button>`;
  if (!toPage) for (const [k, t, i] of DIST) h += `<button class="b alt ib" data-ds="${k}" title="${t}${canDistribute ? '' : ' (cần chọn ít nhất 3 hình/nhóm)'}" ${canDistribute ? '' : 'disabled'}>${i}</button>`;
  return h + `</div>`;
}
function wireAlign(P: HTMLElement, st: DocStore) {
  P.querySelectorAll<HTMLButtonElement>('[data-al]').forEach((b) => (b.onclick = () => st.align(b.dataset.al as any)));
  P.querySelectorAll<HTMLButtonElement>('[data-ds]').forEach((b) => (b.onclick = () => st.distribute(b.dataset.ds as 'h' | 'v')));
}

/** Bảng thuộc tính bên phải, dựng lại mỗi khi đổi hình được chọn. */
export class PropsPanel {
  /** Hiện thông báo ngắn (app nối với dòng thông báo trên thanh công cụ). */
  onMsg: (t: string) => void = () => {};
  /** Điểm neo đang chọn trên khung (khi đang sửa điểm neo) — bo/vát chỉ góc đó. */
  getNodeSel: () => NodeRef | null = () => null;
  /** Lựa chọn cho mảng lặp và góc (nhớ giữa các lần chọn hình). */
  private arr = { kind: 'row' as ArrayKind, count: 4, gap: 20, radius: 200, rotate: true };
  private cdist = 12;
  private odist = 10;
  /** Gọi khi người dùng muốn sửa điểm neo của một đường (app nối với khung vẽ). */
  onEditPath: (id: number) => void = () => {};
  /** Bấm ô màu trong bộ màu thương hiệu thì áp vào đâu. */
  private target: 'fill' | 'c2' | 'stroke' = 'fill';
  private showCodes = false;

  constructor(private root: HTMLElement, private store: DocStore, private palette: BrandPalette) {
    store.on('select', () => this.build());
    palette.onChange(() => this.build());
    this.build();
  }

  syncNumbers() {
    const s = this.store.selected, r = this.root;
    if (!s || !r.querySelector('#nx')) return;
    for (const [i, k] of [['nx', 'x'], ['ny', 'y'], ['nr', 'r'], ['nw', 'w'], ['nh', 'h']] as const) {
      const e = $<HTMLInputElement>(r, i);
      if (document.activeElement !== e) e.value = String(Math.round((s as any)[k] * 10) / 10);
    }
  }

  private build() {
    const P = this.root, st = this.store, s = st.selected;
    if (!s) { if (st.sel.length) this.buildMulti(); else P.innerHTML = HELP; return; }
    const def = getShape(s.t);
    const redraw = () => st.emitChange();
    if (isConnector(s)) return this.buildConnector(s);
    let h = s.t === 'text' || s.t === 'image' || s.t === 'curve' ? '' : `<div class="grp">Chữ trên hình</div><textarea id="lbl" rows="2" placeholder="Bấm đúp vào hình để gõ trực tiếp">${esc(s.label ?? '')}</textarea><div class="r2"><div><label>Màu chữ</label><input type="color" id="lc" value="${s.lc || '#ffffff'}"></div><div><label>&nbsp;</label><button class="b alt sm" id="lcauto" ${s.lc ? '' : 'disabled'}>Màu tự động</button></div></div><p class="hint">Chữ tự co vừa khung. Tab khi đang gõ: tạo ý tiếp theo đã nối.</p>`;
    h += `<div class="grp">Vị trí & kích thước</div><div class="r3"><div><label>X</label><input type="number" id="nx"></div><div><label>Y</label><input type="number" id="ny"></div><div><label>Xoay °</label><input type="number" id="nr"></div></div><div class="r2"><div><label>Rộng</label><input type="number" id="nw"></div><div><label>Cao</label><input type="number" id="nh"></div></div>`;
    h += alignHTML(true, false);
    h += this.toolsHTML([s]);
    h += s.t === 'image'
      ? `<div class="grp">Ảnh</div><label>Độ trong suốt <span id="opv">${Math.round(s.op * 100)}%</span></label><input type="range" id="op" min="0.1" max="1" step="0.05" value="${s.op}">`
      : this.colorHTML([s], true);
    if (s.t === 'path') {
      const canBack = s.p.orig && !s.p.edited;
      h += `<div class="grp">Đường tự do · ${nodeCount(s)} điểm neo</div><div class="btnrow"><button class="b sm" id="pedit">Sửa điểm neo</button>${canBack ? '<button class="b alt sm" id="prev">Quay lại dạng thông số</button>' : ''}</div>`;
      h += `<p class="hint">Bấm đúp vào hình (hoặc Enter) để sửa: kéo điểm vuông/tròn để dời · kéo chấm hồng để chỉnh độ cong · <b>kéo cạnh để uốn cong</b> · bấm đúp lên cạnh để thêm điểm · bấm đúp lên điểm: nhọn ↔ trơn · Alt+bấm hoặc Delete: xóa điểm.${s.p.orig && s.p.edited ? '<br>Đã sửa điểm neo nên không quay lại dạng thông số được nữa (vẫn hoàn tác bằng Ctrl+Z được).' : ''}</p>`;
    }
    if (def.params.length) {
      h += `<div class="grp">Thông số hình</div>`;
      if (def.handles?.length) h += `<p class="hint" style="margin-top:0">Kéo <b style="color:#B98A00">hình thoi vàng</b> trên khung để chỉnh trực tiếp; thanh trượt để tinh chỉnh.</p>`;
      for (const q of def.params) {
        if (q.show && !q.show(s.p)) continue;
        if (q.type === 'text') h += `<label>${q.l}</label><input type="text" data-p="${q.k}" value="${esc(s.p[q.k])}">`;
        else if (q.type === 'check') h += `<label><input type="checkbox" data-p="${q.k}" ${s.p[q.k] ? 'checked' : ''}> ${q.l}</label>`;
        else if (q.type === 'select') h += `<label>${q.l}</label><select data-p="${q.k}" style="width:100%">${(q.opts || []).map(([v, l]) => `<option value="${v}"${s.p[q.k] === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
        else h += `<label>${q.l} <span id="pv_${q.k}">${s.p[q.k]}</span></label><input type="range" data-p="${q.k}" min="${q.min}" max="${q.max}" step="${q.step}" value="${s.p[q.k]}">`;
      }
    }
    h += `<div class="grp">Thao tác</div><div class="btnrow"><button class="b alt sm" id="fx">Lật ngang</button><button class="b alt sm" id="fy">Lật dọc</button><button class="b alt sm" id="up">Lên trên</button><button class="b alt sm" id="dn">Xuống dưới</button><button class="b alt sm" id="top">Trên cùng</button><button class="b alt sm" id="bot">Dưới cùng</button><button class="b sm" id="dp">Nhân đôi</button><button class="b red sm" id="dl">Xóa</button>${canConvertToPath(s) ? '<button class="b alt sm" id="cvt" title="Biến hình thành các điểm neo để sửa tự do; chưa sửa thì quay lại được">Chuyển thành đường</button>' : ''}</div>`;
    h += `<p class="hint">Giữ Shift và bấm hình khác để chọn thêm, rồi bấm <b>Nhóm</b> (Ctrl+G).</p>`;
    P.innerHTML = h;
    wireAlign(P, st);
    this.wireTools();
    this.syncNumbers();
    const lbl = P.querySelector<HTMLTextAreaElement>('#lbl');
    if (lbl) {
      lbl.onchange = () => st.setLabel(s.id, lbl.value);
      lbl.onkeydown = (e) => e.stopPropagation();
      const lc = $<HTMLInputElement>(P, 'lc');
      lc.oninput = () => { s.lc = lc.value; redraw(); }; lc.onchange = () => { st.commit(); this.build(); };
      $(P, 'lcauto').onclick = () => { delete s.lc; st.commit(); this.build(); redraw(); };
    }

    const num = (id: string, k: 'x' | 'y' | 'r' | 'w' | 'h', fn?: (v: number) => number) => {
      const e = $<HTMLInputElement>(P, id);
      e.oninput = () => { const v = parseFloat(e.value); if (isNaN(v)) return; (s as any)[k] = fn ? fn(v) : v; redraw(); };
      e.onchange = () => st.commit();
    };
    num('nx', 'x'); num('ny', 'y');
    num('nr', 'r', (v) => ((v % 360) + 360) % 360);
    num('nw', 'w', (v) => Math.max(6, v)); num('nh', 'h', (v) => Math.max(6, v));

    if (s.t === 'image') {
      const op = $<HTMLInputElement>(P, 'op');
      op.oninput = () => { s.op = +op.value; $(P, 'opv').textContent = Math.round(s.op * 100) + '%'; redraw(); }; op.onchange = () => st.commit();
    } else this.wireColors([s], true);

    P.querySelectorAll<HTMLSelectElement>('select[data-p]').forEach((e) => { e.onchange = () => { s.p[e.dataset.p!] = e.value; redraw(); st.commit(); this.build(); }; });
    P.querySelectorAll<HTMLInputElement>('input[data-p]').forEach((e) => {
      const k = e.dataset.p!;
      if (e.type === 'range') { e.oninput = () => { s.p[k] = +e.value; $(P, 'pv_' + k).textContent = e.value; redraw(); }; e.onchange = () => st.commit(); }
      else if (e.type === 'checkbox') e.onchange = () => { s.p[k] = e.checked ? 1 : 0; st.commit(); redraw(); };
      else { e.oninput = () => { s.p[k] = e.value; redraw(); }; e.onchange = () => st.commit(); }
    });
    $(P, 'fx').onclick = () => { s.fx = (s.fx * -1) as 1 | -1; st.commit(); redraw(); };
    $(P, 'fy').onclick = () => { s.fy = (s.fy * -1) as 1 | -1; st.commit(); redraw(); };
    $(P, 'up').onclick = () => st.moveLayer(1); $(P, 'dn').onclick = () => st.moveLayer(-1);
    $(P, 'top').onclick = () => st.moveLayer('top'); $(P, 'bot').onclick = () => st.moveLayer('bottom');
    $(P, 'dp').onclick = () => st.duplicate(); $(P, 'dl').onclick = () => st.remove();
    P.querySelector<HTMLButtonElement>('#cvt')?.addEventListener('click', () => { if (st.convertToPath()) this.onEditPath(s.id); });
    P.querySelector<HTMLButtonElement>('#pedit')?.addEventListener('click', () => this.onEditPath(s.id));
    P.querySelector<HTMLButtonElement>('#prev')?.addEventListener('click', () => st.revertPath(s.id));
  }

  /** Bảng khi chọn nhiều hình hoặc một nhóm: màu chung, nhóm/bỏ nhóm, thứ tự lớp. */
  private buildMulti() {
    const P = this.root, st = this.store, list = st.selection;
    const grouped = st.selectedGroup !== undefined, anyGroup = list.some((x) => x.gid !== undefined);
    let h = `<div class="grp">${grouped ? 'Nhóm' : 'Đang chọn'} · ${list.length} hình</div><div class="btnrow">`;
    if (!grouped) h += `<button class="b sm" id="grp">Nhóm (Ctrl+G)</button>`;
    if (anyGroup) h += `<button class="b alt sm" id="ugrp">Bỏ nhóm (Ctrl+Shift+G)</button>`;
    h += `</div><p class="hint">Kéo để dời cả ${grouped ? 'nhóm' : 'vùng chọn'} · kéo ô vuông ở góc để phóng to/thu nhỏ đều · kéo chấm tròn để xoay. Bấm một hình trong vùng chọn (không kéo) để chọn riêng nó.</p>`;
    const nu = st.selectionUnits;
    const shapesN = list.filter((x) => !isConnector(x)).length;
    if (shapesN >= 2) h += `<div class="grp">Sơ đồ</div><div class="btnrow"><button class="b sm" id="conn" title="Nối các hình đang chọn thành chuỗi (trái → phải)">Nối các hình</button></div><label>Tự bố trí</label><div class="btnrow"><button class="b alt sm" data-lay="tree" title="Cây: theo đường nối, gốc bên trái">🌳 Cây</button><button class="b alt sm" data-lay="ring" title="Vòng: xếp đều quanh tâm">◯ Vòng</button><button class="b alt sm" data-lay="grid" title="Lưới: xếp hàng ngay ngắn">▦ Lưới</button></div>`;
    h += alignHTML(nu === 1, nu >= 3);
    h += this.toolsHTML(list);
    h += this.colorHTML(list, false);
    h += `<div class="grp">Thao tác</div><div class="btnrow"><button class="b alt sm" id="up">Lên trên</button><button class="b alt sm" id="dn">Xuống dưới</button><button class="b alt sm" id="top">Trên cùng</button><button class="b alt sm" id="bot">Dưới cùng</button><button class="b sm" id="dp">Nhân đôi</button><button class="b red sm" id="dl">Xóa</button><button class="b alt sm" id="cvt">Chuyển thành đường</button></div>`;
    P.innerHTML = h;
    wireAlign(P, st);
    this.wireTools();
    P.querySelector<HTMLButtonElement>('#cvt')?.addEventListener('click', () => st.convertToPath());
    P.querySelector<HTMLButtonElement>('#conn')?.addEventListener('click', () => st.connectSelection());
    P.querySelectorAll<HTMLButtonElement>('[data-lay]').forEach((b) => (b.onclick = () => st.autoLayout(b.dataset.lay as any)));
    P.querySelector<HTMLButtonElement>('#grp')?.addEventListener('click', () => st.group());
    P.querySelector<HTMLButtonElement>('#ugrp')?.addEventListener('click', () => st.ungroup());
    this.wireColors(list, false);
    $(P, 'up').onclick = () => st.moveLayer(1); $(P, 'dn').onclick = () => st.moveLayer(-1);
    $(P, 'top').onclick = () => st.moveLayer('top'); $(P, 'bot').onclick = () => st.moveLayer('bottom');
    $(P, 'dp').onclick = () => st.duplicate(); $(P, 'dl').onclick = () => st.remove();
  }

  /* ---------- Màu sắc: kiểu tô, gradient, bộ màu thương hiệu ---------- */

  private colorHTML(list: Shape[], single: boolean) {
    const a = list[0], g = a.grad, pal = this.palette.colors;
    if (this.target === 'c2' && !g) this.target = 'fill';
    const ft = g ? g.type : 'solid';
    let h = `<div class="grp">Màu sắc${single ? '' : ' (áp dụng cho tất cả)'}</div>`;
    h += `<label>Kiểu tô</label><select id="ftype" style="width:100%"><option value="solid"${ft === 'solid' ? ' selected' : ''}>Màu đặc</option><option value="linear"${ft === 'linear' ? ' selected' : ''}>Chuyển sắc thẳng (gradient)</option><option value="radial"${ft === 'radial' ? ' selected' : ''}>Chuyển sắc tròn (gradient)</option></select>`;
    h += `<div class="${g ? 'r3' : 'r2'}"><div><label>${g ? 'Màu 1' : 'Màu tô'}</label><input type="color" id="cf" value="${a.fill}"></div>`;
    if (g) h += `<div><label>Màu 2</label><input type="color" id="c2" value="${g.c2}"></div>`;
    h += `<div><label>Màu viền</label><input type="color" id="cs" value="${a.stroke}"></div></div>`;
    if (g) {
      if (g.type === 'linear') h += `<label>Hướng chuyển sắc <span id="gav">${g.a}°</span></label><input type="range" id="ga" min="0" max="345" step="15" value="${g.a}">`;
      h += `<div class="btnrow"><button class="b alt sm" id="gsw">⇄ Đảo hai màu</button></div><p class="hint">Lưu ý: Canva hiển thị được gradient trong SVG nhưng thường <b>không cho đổi màu</b> gradient. Muốn đổi màu trong Canva thì dùng màu đặc.</p>`;
    }
    // bộ màu thương hiệu
    const tg = (k: string, l: string) => `<button class="seg${this.target === k ? ' on' : ''}" data-tg="${k}">${l}</button>`;
    h += `<label>Bộ màu thương hiệu</label><div class="segs"><span>Bấm ô màu để áp vào:</span>${tg('fill', g ? 'Màu 1' : 'Màu tô')}${g ? tg('c2', 'Màu 2') : ''}${tg('stroke', 'Viền')}</div>`;
    h += `<div class="pal">${pal.map((c, i) => `<button class="sw" data-sw="${c}" title="${c}" style="background:${c}"><span class="x" data-rm="${i}" title="Bỏ màu này khỏi bộ">×</span></button>`).join('')}<button class="sw add" id="padd" title="Thêm màu đang dùng vào bộ màu">+</button></div>`;
    h += `<div class="btnrow"><button class="b alt sm" id="pcode">${this.showCodes ? 'Ẩn mã màu' : 'Nhập / chép mã màu'}</button></div>`;
    if (this.showCodes) h += `<textarea id="ptext" placeholder="Dán mã màu, ví dụ: #1E6FB5, #E0A458, 5FA87A">${pal.join(', ')}</textarea><div class="btnrow"><button class="b sm" id="psave">Lưu bộ màu</button><button class="b alt sm" id="preset">Về mặc định</button></div><p class="err" id="perr"></p><p class="hint">Dán danh sách mã màu từ bộ nhận diện thương hiệu (cách nhau bằng dấu phẩy, khoảng trắng hoặc xuống dòng). Bộ màu được lưu trong trình duyệt này và dùng chung cho mọi bản vẽ.</p>`;
    if (single) h += `<label>Độ dày viền <span id="swv">${a.sw}</span></label><input type="range" id="sw" min="0" max="30" step="1" value="${a.sw}">`;
    h += `<label>Độ trong suốt <span id="opv">${Math.round(a.op * 100)}%</span></label><input type="range" id="op" min="0.1" max="1" step="0.05" value="${a.op}">`;
    return h;
  }

  private wireColors(list: Shape[], single: boolean) {
    const P = this.root, st = this.store, pal = this.palette;
    const redraw = () => st.emitChange();
    const q = <T extends HTMLElement>(id: string) => P.querySelector<T>('#' + id);
    const sw = q<HTMLInputElement>('sw');
    const setStroke = (c: string) => list.forEach((x) => { x.stroke = c; if (!x.sw) { x.sw = 4; if (sw) { sw.value = '4'; $(P, 'swv').textContent = '4'; } } });
    const setColor = (k: 'fill' | 'c2' | 'stroke', c: string) => {
      if (k === 'fill') list.forEach((x) => (x.fill = c));
      else if (k === 'c2') list.forEach((x) => { if (x.grad) x.grad = { ...x.grad, c2: c }; });
      else setStroke(c);
    };
    const live = (id: string, k: 'fill' | 'c2' | 'stroke') => {
      const e = q<HTMLInputElement>(id); if (!e) return;
      e.oninput = () => { setColor(k, e.value); redraw(); };
      e.onchange = () => st.commit();
    };
    live('cf', 'fill'); live('c2', 'c2'); live('cs', 'stroke');

    q<HTMLSelectElement>('ftype')!.onchange = (e) => {
      const v = (e.target as HTMLSelectElement).value;
      list.forEach((x) => {
        if (v === 'solid') delete x.grad;
        else x.grad = { type: v as 'linear' | 'radial', c2: x.grad?.c2 ?? mix(x.fill, 0.55), a: x.grad?.a ?? 90 };
      });
      st.commit(); this.build(); redraw();
    };
    const ga = q<HTMLInputElement>('ga');
    if (ga) { ga.oninput = () => { list.forEach((x) => { if (x.grad) x.grad = { ...x.grad, a: +ga.value }; }); $(P, 'gav').textContent = ga.value + '°'; redraw(); }; ga.onchange = () => st.commit(); }
    const gsw = q('gsw');
    if (gsw) gsw.onclick = () => { list.forEach((x) => { if (x.grad) { const c = x.fill; x.fill = x.grad.c2; x.grad = { ...x.grad, c2: c }; } }); st.commit(); this.build(); redraw(); };

    P.querySelectorAll<HTMLButtonElement>('[data-tg]').forEach((b) => (b.onclick = () => { this.target = b.dataset.tg as any; this.build(); }));
    P.querySelectorAll<HTMLButtonElement>('[data-sw]').forEach((b) => (b.onclick = (e) => {
      const rm = (e.target as HTMLElement).dataset.rm;
      if (rm !== undefined) { pal.remove(+rm); return; }
      setColor(this.target, b.dataset.sw!); st.commit(); this.build(); redraw();
    }));
    q('padd')!.onclick = () => {
      const a = list[0];
      pal.add(this.target === 'stroke' ? a.stroke : this.target === 'c2' && a.grad ? a.grad.c2 : a.fill);
    };
    q('pcode')!.onclick = () => { this.showCodes = !this.showCodes; this.build(); };
    const psave = q('psave');
    if (psave) psave.onclick = () => {
      // không dùng hộp thoại chặn: báo lỗi ngay dưới ô nhập
      const n = pal.setFromText(q<HTMLTextAreaElement>('ptext')!.value);
      if (!n) { const m = q('perr'); if (m) m.textContent = 'Không tìm thấy mã màu hợp lệ (dạng #RRGGBB).'; }
    };
    const preset = q('preset');
    if (preset) preset.onclick = () => pal.reset();

    if (sw) { sw.oninput = () => { list.forEach((x) => (x.sw = +sw.value)); $(P, 'swv').textContent = sw.value; redraw(); }; sw.onchange = () => st.commit(); }
    const op = q<HTMLInputElement>('op')!;
    op.oninput = () => { list.forEach((x) => (x.op = +op.value)); $(P, 'opv').textContent = Math.round(+op.value * 100) + '%'; redraw(); };
    op.onchange = () => st.commit();
    void single;
  }

  /** Bảng cho đường nối: kiểu đường, đầu mút, độ dày, màu. */
  private buildConnector(s: Shape) {
    const P = this.root, st = this.store, def = getShape(s.t);
    let h = `<div class="grp">Đường nối</div><p class="hint" style="margin-top:0">Đường nối tự đi theo khi kéo hai hình. Xóa một hình thì đường nối cũng mất.</p>`;
    for (const q of def.params) {
      if (q.type === 'select') h += `<label>${q.l}</label><select data-p="${q.k}" style="width:100%">${(q.opts || []).map(([v, l]) => `<option value="${v}"${s.p[q.k] === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
      else h += `<label>${q.l} <span id="pv_${q.k}">${s.p[q.k]}</span></label><input type="range" data-p="${q.k}" min="${q.min}" max="${q.max}" step="${q.step}" value="${s.p[q.k]}">`;
    }
    h += `<div class="r2"><div><label>Màu</label><input type="color" id="cf" value="${s.fill}"></div><div></div></div>`;
    h += `<label>Bộ màu thương hiệu</label><div class="pal">${this.palette.colors.map((c) => `<button class="sw" data-sw="${c}" title="${c}" style="background:${c}"></button>`).join('')}</div>`;
    h += `<div class="grp">Thao tác</div><div class="btnrow"><button class="b red sm" id="dl">Xóa đường nối</button></div>`;
    P.innerHTML = h;
    const redraw = () => st.emitChange();
    P.querySelectorAll<HTMLSelectElement>('select[data-p]').forEach((e) => { e.onchange = () => { s.p[e.dataset.p!] = e.value; redraw(); st.commit(); this.build(); }; });
    P.querySelectorAll<HTMLInputElement>('input[data-p]').forEach((e) => { const k = e.dataset.p!; e.oninput = () => { s.p[k] = +e.value; $(P, 'pv_' + k).textContent = e.value; redraw(); }; e.onchange = () => st.commit(); });
    const cf = $<HTMLInputElement>(P, 'cf'); cf.oninput = () => { s.fill = cf.value; redraw(); }; cf.onchange = () => st.commit();
    P.querySelectorAll<HTMLButtonElement>('[data-sw]').forEach((b) => (b.onclick = () => { s.fill = b.dataset.sw!; st.commit(); this.build(); redraw(); }));
    $(P, 'dl').onclick = () => st.remove();
  }

  /* ---------- Tạo hình phức tạp: kết hợp, lặp, đối xứng, góc, đường viền ---------- */

  private toolsHTML(list: Shape[]) {
    const solids = list.filter((x) => canConvertToPath(x) || x.t === 'path');
    if (!list.some((x) => !isConnector(x))) return '';
    let h = '';
    if (solids.length >= 2)
      h += `<div class="grp">Kết hợp hình</div><div class="bool">${BOOL.map(([k, l, i]) => `<button class="b alt" data-bool="${k}" title="${l} các hình đang chọn">${i}<span>${l}</span></button>`).join('')}</div><p class="hint">Màu lấy theo hình nằm dưới cùng. <b>Trừ</b>: hình dưới cùng trừ đi các hình phía trên.</p>`;
    const a = this.arr, ring = a.kind === 'ring';
    h += `<div class="grp">Lặp & đối xứng</div><div class="btnrow" style="margin-top:0"><button class="b alt sm" data-mir="h" title="Tạo bản lật trái–phải, đặt sát bên phải">⇋ Gương ngang</button><button class="b alt sm" data-mir="v" title="Tạo bản lật trên–dưới, đặt sát bên dưới">⇅ Gương dọc</button></div>`;
    h += `<div class="r3"><div><label>Mảng</label><select id="akind" style="width:100%">${([['row', 'Hàng ngang'], ['col', 'Hàng dọc'], ['grid', 'Lưới'], ['ring', 'Vòng tròn']] as const).map(([v, l]) => `<option value="${v}"${a.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div><label>Số bản</label><input type="number" id="acount" min="2" max="200" value="${a.count}"></div><div><label>${ring ? 'Bán kính' : 'Khoảng cách'}</label><input type="number" id="agap" value="${ring ? a.radius : a.gap}"></div></div>`;
    if (ring) h += `<label><input type="checkbox" id="arot" ${a.rotate ? 'checked' : ''}> Xoay theo vòng</label>`;
    h += `<div class="btnrow"><button class="b sm" id="amake">Tạo mảng</button></div>`;
    if (solids.length)
      h += `<div class="grp">Góc & đường viền</div><div class="r2"><div><label>Bo / vát (px)</label><input type="number" id="cdist" min="1" value="${this.cdist}"></div><div><label>Phình / co (px)</label><input type="number" id="odist" min="1" value="${this.odist}"></div></div><div class="btnrow"><button class="b alt sm" data-corner="round" title="Bo tròn mọi góc nhọn">◜ Bo góc</button><button class="b alt sm" data-corner="chamfer" title="Vát xéo mọi góc nhọn">◸ Vát góc</button><button class="b alt sm" data-off="1">⊕ Phình ra</button><button class="b alt sm" data-off="-1">⊖ Co vào</button></div><p class="hint">Đang sửa điểm neo và đã chọn một điểm thì chỉ bo/vát góc đó. Hình sẽ được chuyển thành đường.</p>`;
    return h;
  }

  private wireTools() {
    const P = this.root, st = this.store, q = <T extends HTMLElement>(id: string) => P.querySelector<T>('#' + id);
    P.querySelectorAll<HTMLButtonElement>('[data-bool]').forEach((b) => (b.onclick = () => {
      const r = st.booleanOp(b.dataset.bool as any);
      if (r === -1) this.onMsg('Kết quả rỗng: các hình không chồng lên nhau theo cách này.');
      else if (r === 0) this.onMsg('Cần chọn ít nhất 2 hình.');
    }));
    P.querySelectorAll<HTMLButtonElement>('[data-mir]').forEach((b) => (b.onclick = () => st.mirrorCopy(b.dataset.mir as 'h' | 'v')));
    const kind = q<HTMLSelectElement>('akind'), count = q<HTMLInputElement>('acount'), gap = q<HTMLInputElement>('agap'), rot = q<HTMLInputElement>('arot');
    const keep = (e: HTMLInputElement | null, f: (v: number) => void) => { if (e) { e.onkeydown = (ev) => ev.stopPropagation(); e.onchange = () => { const v = parseFloat(e.value); if (isFinite(v)) f(v); }; } };
    if (kind) kind.onchange = () => { this.arr.kind = kind.value as ArrayKind; this.build(); };
    keep(count, (v) => (this.arr.count = Math.max(2, Math.min(200, Math.round(v)))));
    keep(gap, (v) => { if (this.arr.kind === 'ring') this.arr.radius = Math.max(1, v); else this.arr.gap = v; });
    if (rot) rot.onchange = () => (this.arr.rotate = rot.checked);
    const make = q('amake');
    if (make) make.onclick = () => {
      // đọc lại ô số phòng khi người dùng chưa rời ô
      const c = parseFloat(count!.value), g = parseFloat(gap!.value);
      if (isFinite(c)) this.arr.count = Math.max(2, Math.min(200, Math.round(c)));
      if (isFinite(g)) { if (this.arr.kind === 'ring') this.arr.radius = Math.max(1, g); else this.arr.gap = g; }
      const a = this.arr, n = st.makeArray(a.kind, a.count, a.kind === 'ring' ? a.radius : a.gap, { rotate: a.rotate });
      if (n) this.onMsg(`Đã tạo ${n} bản sao và nhóm lại (Ctrl+Shift+G để bỏ nhóm).`);
    };
    const cd = q<HTMLInputElement>('cdist'), od = q<HTMLInputElement>('odist');
    keep(cd, (v) => (this.cdist = Math.max(1, v)));
    keep(od, (v) => (this.odist = Math.max(1, v)));
    P.querySelectorAll<HTMLButtonElement>('[data-corner]').forEach((b) => (b.onclick = () => {
      const v = parseFloat(cd!.value); if (isFinite(v)) this.cdist = Math.max(1, v);
      const ref = this.getNodeSel();
      const n = st.cornerSelection(b.dataset.corner as 'round' | 'chamfer', this.cdist, ref ? [ref] : undefined);
      this.onMsg(n ? `Đã ${b.dataset.corner === 'round' ? 'bo' : 'vát'} ${n} góc.` : 'Không có góc nhọn nào giữa hai cạnh thẳng để xử lý.');
    }));
    P.querySelectorAll<HTMLButtonElement>('[data-off]').forEach((b) => (b.onclick = () => {
      const v = parseFloat(od!.value); if (isFinite(v)) this.odist = Math.max(1, v);
      if (!st.offsetSelection(+b.dataset.off! * this.odist)) this.onMsg('Co vào quá nhiều: hình biến mất nên không đổi.');
    }));
  }
}
