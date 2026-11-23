import type { DocStore } from '../core/store';
import { getShape } from '../shapes/registry';

const esc = (t: unknown) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const $ = <T extends HTMLElement>(root: HTMLElement, id: string) => root.querySelector<T>('#' + id)!;

const HELP = `<div class="empty"><b>Cách dùng</b><br>① Bấm một hình ở cột trái để thêm vào khung.<br>② Kéo để di chuyển, kéo ô vuông nhỏ để đổi cỡ (giữ Shift để giữ tỉ lệ), kéo chấm tròn phía trên để xoay.<br>③ Chọn hình để đổi màu, góc quạt, số tầng…<br>④ Bấm <b>Tải SVG</b> rồi kéo file vào Canva.<br><br>Phím tắt: Delete xóa · Ctrl+D nhân đôi · Ctrl+Z hoàn tác · phím mũi tên nhích hình.<br><br>Chữ sẽ không bị đổi sang đường nét; Canva có thể đổi font, nên gõ chữ trong Canva cho chắc.</div>`;

/** Bảng thuộc tính bên phải, dựng lại mỗi khi đổi hình được chọn. */
export class PropsPanel {
  constructor(private root: HTMLElement, private store: DocStore) {
    store.on('select', () => this.build());
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
    if (!s) { P.innerHTML = HELP; return; }
    const def = getShape(s.t);
    const redraw = () => st.emitChange();
    let h = `<div class="grp">Vị trí & kích thước</div><div class="r3"><div><label>X</label><input type="number" id="nx"></div><div><label>Y</label><input type="number" id="ny"></div><div><label>Xoay °</label><input type="number" id="nr"></div></div><div class="r2"><div><label>Rộng</label><input type="number" id="nw"></div><div><label>Cao</label><input type="number" id="nh"></div></div>`;
    h += `<div class="grp">Màu sắc</div><div class="r2"><div><label>Màu tô</label><input type="color" id="cf" value="${s.fill}"></div><div><label>Màu viền</label><input type="color" id="cs" value="${s.stroke}"></div></div><label>Độ dày viền <span id="swv">${s.sw}</span></label><input type="range" id="sw" min="0" max="30" step="1" value="${s.sw}"><label>Độ trong suốt <span id="opv">${Math.round(s.op * 100)}%</span></label><input type="range" id="op" min="0.1" max="1" step="0.05" value="${s.op}">`;
    if (def.params.length) {
      h += `<div class="grp">Thông số hình</div>`;
      for (const q of def.params) {
        if (q.type === 'text') h += `<label>${q.l}</label><input type="text" data-p="${q.k}" value="${esc(s.p[q.k])}">`;
        else if (q.type === 'check') h += `<label><input type="checkbox" data-p="${q.k}" ${s.p[q.k] ? 'checked' : ''}> ${q.l}</label>`;
        else h += `<label>${q.l} <span id="pv_${q.k}">${s.p[q.k]}</span></label><input type="range" data-p="${q.k}" min="${q.min}" max="${q.max}" step="${q.step}" value="${s.p[q.k]}">`;
      }
    }
    h += `<div class="grp">Thao tác</div><div class="btnrow"><button class="b alt sm" id="fx">Lật ngang</button><button class="b alt sm" id="fy">Lật dọc</button><button class="b alt sm" id="up">Lên trên</button><button class="b alt sm" id="dn">Xuống dưới</button><button class="b alt sm" id="top">Trên cùng</button><button class="b alt sm" id="bot">Dưới cùng</button><button class="b sm" id="dp">Nhân đôi</button><button class="b red sm" id="dl">Xóa</button></div>`;
    P.innerHTML = h;
    this.syncNumbers();

    const num = (id: string, k: 'x' | 'y' | 'r' | 'w' | 'h', fn?: (v: number) => number) => {
      const e = $<HTMLInputElement>(P, id);
      e.oninput = () => { const v = parseFloat(e.value); if (isNaN(v)) return; (s as any)[k] = fn ? fn(v) : v; redraw(); };
      e.onchange = () => st.commit();
    };
    num('nx', 'x'); num('ny', 'y');
    num('nr', 'r', (v) => ((v % 360) + 360) % 360);
    num('nw', 'w', (v) => Math.max(6, v)); num('nh', 'h', (v) => Math.max(6, v));

    const cf = $<HTMLInputElement>(P, 'cf'), cs = $<HTMLInputElement>(P, 'cs'), sw = $<HTMLInputElement>(P, 'sw'), op = $<HTMLInputElement>(P, 'op');
    cf.oninput = () => { s.fill = cf.value; redraw(); }; cf.onchange = () => st.commit();
    cs.oninput = () => { s.stroke = cs.value; if (!s.sw) { s.sw = 4; sw.value = '4'; $(P, 'swv').textContent = '4'; } redraw(); }; cs.onchange = () => st.commit();
    sw.oninput = () => { s.sw = +sw.value; $(P, 'swv').textContent = sw.value; redraw(); }; sw.onchange = () => st.commit();
    op.oninput = () => { s.op = +op.value; $(P, 'opv').textContent = Math.round(s.op * 100) + '%'; redraw(); }; op.onchange = () => st.commit();

    P.querySelectorAll<HTMLInputElement>('[data-p]').forEach((e) => {
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
  }
}
