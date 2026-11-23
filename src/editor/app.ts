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

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function startApp() {
  registerBuiltinShapes();
  const store = new DocStore(window.localStorage);
  const canvas = new EditorCanvas($('stage') as unknown as SVGSVGElement, store);
  const palette = new BrandPalette(window.localStorage);
  store.colorSource = () => palette.cycle();
  const props = new PropsPanel($('props'), store, palette);
  canvas.onGeometryChange = () => props.syncNumbers();
  buildLibrary($('lib'), (it) => store.addFromLibrary(it));
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
  csize.onchange = () => store.setCanvasSize(+csize.value);
  const snap = $<HTMLInputElement>('snap');
  snap.onchange = () => (canvas.snapToGrid = snap.checked);
  const guides = $<HTMLInputElement>('guides');
  guides.onchange = () => (canvas.smartGuides = guides.checked);
  $('undo').onclick = () => store.undo();
  $('redo').onclick = () => store.redo();
  $('clr').onclick = () => store.clear();
  store.on('select', () => { csize.value = String(store.doc.sizeIdx); });

  // xuất file
  const msg = (t: string) => { const m = $('msg'); m.textContent = t; clearTimeout((msg as any).t); (msg as any).t = setTimeout(() => (m.textContent = ''), 4500); };
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
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLInputElement, tag = (t.tagName || '').toLowerCase();
    if ((tag === 'input' && t.type !== 'range' && t.type !== 'checkbox') || tag === 'textarea' || tag === 'select') return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); store.redo(); return; }
    if (mod && k === 'a') { e.preventDefault(); store.selectAll(); return; }
    const list = store.selection; if (!list.length) return;
    if (e.key === 'Escape') { store.select(null); return; }
    if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? store.ungroup() : store.group(); return; }
    if (mod && e.shiftKey && k === 'h') { e.preventDefault(); store.setHidden(store.sel, true); return; }
    if (mod && e.shiftKey && k === 'l') { e.preventDefault(); store.setLocked(store.sel, true); return; }
    if (mod && k === 'd') { e.preventDefault(); store.duplicate(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); store.remove(); return; }
    const st = e.shiftKey ? 10 : 1;
    const m = ({ ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] } as Record<string, number[]>)[e.key];
    if (m) { e.preventDefault(); list.forEach((s) => { s.x += m[0]; s.y += m[1]; }); store.emitChange(); props.syncNumbers(); clearTimeout(keyT); keyT = window.setTimeout(() => store.commit(), 400); }
  });
}
