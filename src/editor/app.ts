import { DocStore } from '../core/store';
import { SIZES } from '../core/constants';
import { exportDocument, exportShapes, rasterSize, sizedSVG, svgViewSize } from '../core/export';
import { registerBuiltinShapes } from '../shapes';
import { saveBlob, saveTextFile } from '../platform/download';
import { svgToPng } from '../platform/raster';
import { EditorCanvas } from './canvas';
import { buildLibrary } from './library';
import { PropsPanel } from './props';
import { LayersPanel } from './layers';
import { BrandPalette } from '../core/palette';
import { QuickAdd } from './quickadd';
import { libItem } from '../shapes';
import { isConnector } from '../core/connect';
import { loadImageFile, svgTextToImage } from '../platform/image';
import type { LibItem } from '../core/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function startApp() {
  registerBuiltinShapes();
  const store = new DocStore(window.localStorage);
  const canvas = new EditorCanvas($('stage') as unknown as SVGSVGElement, store);
  const palette = new BrandPalette(window.localStorage);
  store.colorSource = () => palette.cycle();
  const props = new PropsPanel($('props'), store, palette);
  canvas.onGeometryChange = () => props.syncNumbers();

  // hình mới xuất hiện ở giữa vùng đang nhìn (lệch nhẹ để không chồng khít nhau)
  let nudge = 0;
  const atView = () => { const c = canvas.viewCenter(), n = (nudge++ % 5) - 2; return { x: c.x + n * 16, y: c.y + n * 16 }; };
  const startText = (id: number) => requestAnimationFrame(() => canvas.editLabel(id));
  const addItem = (it: LibItem, at = atView()) => { const s = store.addFromLibrary(it, at); if (s.t === 'text') startText(s.id); return s; };
  buildLibrary($('lib'), {
    pick: (it) => addItem(it),
    drop: (it, cx, cy) => { const at = canvas.worldFromClient(cx, cy); if (at) addItem(it, at); },
    arm: (it) => canvas.arm(it),
  });

  // gợi ý nhỏ ở góc khung vẽ (không chặn thao tác)
  const toast = $('toast');
  canvas.onPathEdit = (id) => { toast.textContent = id !== null ? 'Đang sửa điểm neo: kéo điểm/tay nắm, kéo cạnh để uốn, bấm đúp cạnh để thêm điểm · Esc để xong' : ''; toast.hidden = id === null; };
  props.onEditPath = (id) => canvas.enterPathEdit(id);
  canvas.onArm = (it) => { toast.textContent = it ? `Kéo trên khung để vẽ “${it.n}” (Shift: giữ tỉ lệ) · Esc để thôi` : ''; toast.hidden = !it; };

  // ô "gõ để thêm": bấm đúp chỗ trống hoặc phím /
  let qaAt = { x: 0, y: 0 };
  const qa = new QuickAdd((it) => addItem(it, qaAt), (text) => store.addShape({ t: 'text', x: qaAt.x, y: qaAt.y, p: { text }, name: 'Văn bản' }));
  canvas.onDoubleClickEmpty = (at, cx, cy) => { qaAt = at; qa.open(cx, cy); };
  let lastClient = { x: 0, y: 0 };
  document.addEventListener('pointermove', (e) => { lastClient = { x: e.clientX, y: e.clientY }; }, { passive: true });

  // Tab khi đang gõ chữ trên hình: tạo ý kế tiếp, nối lại, gõ tiếp
  canvas.onTabFromEdit = (id) => { const n = store.addNext(id); if (n) startText(n.id); };

  // thu phóng
  const zpct = $('zpct');
  canvas.onCamera = (c) => { zpct.textContent = Math.round(c.z * 100) + '%'; };
  canvas.onCamera(canvas.cam);
  $('zin').onclick = () => canvas.zoomStep(1);
  $('zout').onclick = () => canvas.zoomStep(-1);
  zpct.onclick = () => canvas.zoomTo(1);
  $('zfit').onclick = () => canvas.fit();
  store.onSaveError = () => msg('⚠ Bộ nhớ trình duyệt đã đầy (thường do ảnh lớn) nên thay đổi mới chưa được lưu. Hãy xóa bớt ảnh hoặc tải file SVG về để giữ bản vẽ.');
  const layers = new LayersPanel($('layers'), store);
  layers.onRender = (n) => { $('lyrN').textContent = n ? `(${n})` : ''; };
  layers.render();
  // thẻ Hình / Lớp ở cột trái
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
    $('lib').hidden = b.dataset.tab !== 'lib';
    $('layers').hidden = b.dataset.tab !== 'layers';
  }));

  // thanh công cụ
  const csize = $<HTMLSelectElement>('csize');
  SIZES.forEach((s, i) => csize.add(new Option(s[0], String(i))));
  csize.value = String(store.doc.sizeIdx);
  csize.onchange = () => { store.setCanvasSize(+csize.value); canvas.fit(); };
  const snap = $<HTMLInputElement>('snap');
  snap.onchange = () => (canvas.snapToGrid = snap.checked);
  const guides = $<HTMLInputElement>('guides');
  guides.onchange = () => (canvas.smartGuides = guides.checked);
  $('undo').onclick = () => store.undo();
  $('redo').onclick = () => store.redo();
  $('clr').onclick = () => store.clear();
  store.on('select', () => { csize.value = String(store.doc.sizeIdx); });

  // xuất file
  function msg(t: string) { const m = $('msg'); m.textContent = t; clearTimeout((msg as any).t); (msg as any).t = setTimeout(() => (m.textContent = ''), 6000); }
  const out = (code: string, name: string) => {
    if (saveTextFile(name, code)) { msg('Đã tải file ' + name); return; }
    const box = $<HTMLTextAreaElement>('code'); box.value = code; $('codeBox').style.display = 'block'; box.select();
    msg('Không tải trực tiếp được: mã SVG đã hiện ở khung dưới, hãy sao chép rồi lưu thành file .svg.');
  };
  // định dạng xuất (SVG hoặc PNG 1x/2x/4x), nhớ lựa chọn lần trước trong trình duyệt này
  const fmt = $<HTMLSelectElement>('fmt');
  try { const v = localStorage.getItem('vector-studio-fmt'); if (v && [...fmt.options].some((o) => o.value === v)) fmt.value = v; } catch { /* bỏ qua */ }
  fmt.onchange = () => { try { localStorage.setItem('vector-studio-fmt', fmt.value); } catch { /* bỏ qua */ } };
  const transparent = () => $<HTMLInputElement>('transp').checked;
  /** Tải SVG, hoặc vẽ SVG đó thành PNG theo độ nét đang chọn. */
  const save = async (svg: string, base: string) => {
    if (fmt.value === 'svg') return out(svg, base + '.svg');
    const { w, h } = svgViewSize(svg), r = rasterSize(w, h, +fmt.value);
    try {
      const png = await svgToPng(sizedSVG(svg, r.width, r.height), r.width, r.height, transparent() ? undefined : '#FFFFFF');
      const name = `${base}-${r.width}x${r.height}.png`;
      if (!saveBlob(name, png)) return msg('Trình duyệt không cho tải file.');
      msg(`Đã tải ${name}` + (r.reduced ? ' (đã giảm độ nét cho vừa giới hạn của trình duyệt)' : ''));
    } catch (e) { msg('Không xuất được PNG: ' + (e as Error).message); }
  };
  $('exAll').onclick = () => {
    if (!store.doc.shapes.some((s) => !s.hidden)) return msg('Chưa có hình nào trong khung.');
    save(exportDocument(store.doc, transparent()), 'hinh-ve-slide');
  };
  $('exSel').onclick = () => {
    const list = store.selection; if (!list.length) return msg('Hãy chọn một hoặc nhiều hình trước.');
    save(exportShapes(list), list.length === 1 ? 'hinh-don' : 'nhom-hinh');
  };
  $('cpCode').onclick = async () => {
    const box = $<HTMLTextAreaElement>('code');
    try { await navigator.clipboard.writeText(box.value); msg('Đã sao chép.'); } catch { box.select(); msg('Đã chọn sẵn mã, bấm Ctrl+C.'); }
  };
  $('closeCode').onclick = () => { $('codeBox').style.display = 'none'; };

  // phím tắt
  let keyT: number | undefined;
  const typing = (t: EventTarget | null) => {
    const el = t as HTMLInputElement, tag = (el?.tagName || '').toLowerCase();
    return (tag === 'input' && el.type !== 'range' && el.type !== 'checkbox') || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
  };
  /** Phím một chữ để "cầm" hình rồi kéo vẽ trên khung. */
  const DRAW_KEYS: Record<string, string> = { r: 'Chữ nhật', o: 'Tròn', a: 'Mũi tên phải', t: 'Văn bản', l: 'Đường kẻ', c: 'Đường cong' };
  document.addEventListener('keyup', (e) => { if (e.key === ' ') canvas.spaceHeld = false; });
  window.addEventListener('blur', () => { canvas.spaceHeld = false; });
  document.addEventListener('keydown', (e) => {
    if (typing(e.target) || qa.isOpen || canvas.isEditing) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (e.key === ' ') { e.preventDefault(); canvas.spaceHeld = true; return; }
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); store.redo(); return; }
    if (mod && k === 'a') { e.preventDefault(); store.selectAll(); return; }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); canvas.zoomStep(1); return; }
    if (mod && k === '-') { e.preventDefault(); canvas.zoomStep(-1); return; }
    if (mod && k === '0') { e.preventDefault(); canvas.fit(); return; }
    if (mod && k === '1') { e.preventDefault(); canvas.zoomTo(1); return; }
    if (e.key === 'Escape' && canvas.armed) { canvas.arm(null); return; }
    if (e.key === 'Escape' && canvas.editPathId !== null) { canvas.exitPathEdit(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && canvas.deleteSelectedNode()) { e.preventDefault(); return; }
    if (e.key === '/') { e.preventDefault(); qaAt = canvas.lastPointer ?? canvas.viewCenter(); const r = $('stage').getBoundingClientRect(); qa.open(canvas.lastPointer ? lastClient.x : r.left + r.width / 2 - 150, canvas.lastPointer ? lastClient.y : r.top + r.height / 3); return; }
    if (!mod && !e.altKey && DRAW_KEYS[k]) { const it = libItem(DRAW_KEYS[k]); if (it) { e.preventDefault(); canvas.arm(canvas.armed === it ? null : it); } return; }
    const list = store.selection; if (!list.length) return;
    if (e.key === 'Escape') { store.select(null); return; }
    const one = store.selected;
    if (e.key === 'Tab' && one && !isConnector(one)) { e.preventDefault(); const n = store.addNext(one.id); if (n) startText(n.id); return; }
    if ((e.key === 'Enter' || e.key === 'F2') && one?.t === 'path') { e.preventDefault(); canvas.enterPathEdit(one.id); return; }
    if ((e.key === 'Enter' || e.key === 'F2') && one && !isConnector(one) && one.t !== 'image' && one.t !== 'curve') { e.preventDefault(); canvas.editLabel(one.id); return; }
    if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? store.ungroup() : store.group(); return; }
    if (mod && e.shiftKey && k === 'h') { e.preventDefault(); store.setHidden(store.sel, true); return; }
    if (mod && e.shiftKey && k === 'l') { e.preventDefault(); store.setLocked(store.sel, true); return; }
    if (mod && k === 'd') { e.preventDefault(); store.duplicate(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); store.remove(); return; }
    const st = e.shiftKey ? 10 : 1;
    const m = ({ ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] } as Record<string, number[]>)[e.key];
    if (m) { e.preventDefault(); list.forEach((s) => { s.x += m[0]; s.y += m[1]; }); store.emitChange(); props.syncNumbers(); clearTimeout(keyT); keyT = window.setTimeout(() => store.commit(), 400); }
  });

  /* ---------- Sao chép / cắt / dán, thả file ---------- */
  const CLIP = 'application/x-vector-studio';
  let clip: { json: string; text: string } | null = null;
  const pasteAt = () => canvas.lastPointer ?? undefined;
  document.addEventListener('copy', (e) => onCopy(e, false));
  document.addEventListener('cut', (e) => onCopy(e, true));
  function onCopy(e: ClipboardEvent, cut: boolean) {
    if (typing(e.target) || canvas.isEditing) return;
    const json = store.copySelection(); if (!json) return;
    const text = exportShapes(store.selection.filter((s) => !s.hidden));
    clip = { json, text };
    e.clipboardData?.setData(CLIP, json);
    e.clipboardData?.setData('text/plain', text); // dán sang chỗ khác thì được mã SVG
    e.preventDefault();
    if (cut) store.remove();
    msg(cut ? 'Đã cắt.' : 'Đã sao chép. Ctrl+V để dán (dán tại chỗ con trỏ).');
  }
  document.addEventListener('paste', async (e) => {
    if (typing(e.target) || canvas.isEditing || qa.isOpen) return;
    const dt = e.clipboardData; if (!dt) return;
    e.preventDefault();
    const own = dt.getData(CLIP);
    if (own && store.pasteShapes(own, pasteAt())) return;
    const files = [...dt.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) return addImages(files, pasteAt());
    const text = dt.getData('text/plain');
    if (!text) return;
    if (clip && text === clip.text && store.pasteShapes(clip.json, pasteAt())) return;
    if (/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) {
      try { const im = await svgTextToImage(text); placeImage(im, pasteAt()); } catch { msg('Không đọc được mã SVG.'); }
      return;
    }
    // văn bản: mỗi dòng thành một khối chữ, xếp dọc — đổ ý ra nhanh
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 40);
    const at = pasteAt() ?? canvas.viewCenter();
    const ids = lines.map((l, i) => store.addShape({ t: 'text', x: at.x, y: at.y + i * 56, p: { text: l, size: 28 }, name: 'Văn bản' }, false).id);
    store.selectMany(ids);
    if (lines.length > 1) msg(`Đã dán ${lines.length} dòng chữ.`);
  });
  function placeImage(im: { href: string; w: number; h: number }, at?: { x: number; y: number }) {
    const { cw, ch } = store.doc, k = Math.min(1, (cw * 0.6) / im.w, (ch * 0.6) / im.h);
    const c = at ?? canvas.viewCenter();
    store.addShape({ t: 'image', x: c.x, y: c.y, w: Math.round(im.w * k), h: Math.round(im.h * k), p: { href: im.href }, name: 'Ảnh', fill: '#FFFFFF' });
  }
  async function addImages(files: File[], at?: { x: number; y: number }) {
    let i = 0;
    for (const f of files.slice(0, 10)) {
      try { const im = await loadImageFile(f); const c = at ?? canvas.viewCenter(); placeImage(im, { x: c.x + i * 24, y: c.y + i * 24 }); i++; }
      catch { msg('Không đọc được ảnh ' + f.name); }
    }
  }
  const stageEl = $('stage');
  stageEl.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
  stageEl.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    addImages(files, canvas.worldFromClient(e.clientX, e.clientY) ?? undefined);
  });
}
