import type { LibItem } from '../core/types';
import { LIBRARY } from '../shapes';
import { defaultParams, partsOf } from '../shapes/registry';
import { mix } from '../core/color';

/** Dựng cột thư viện hình (có hình xem trước). */
export function buildLibrary(root: HTMLElement, onPick: (it: LibItem) => void) {
  root.innerHTML = '';
  for (const g of LIBRARY) {
    const h = document.createElement('div');
    h.className = 'grp'; h.textContent = g.g; root.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'items';
    for (const it of g.items) {
      const b = document.createElement('button');
      b.className = 'it'; b.title = it.n;
      const pad = Math.max(it.w, it.h) * 0.06, fill = '#3F7FB5';
      const inner =
        it.t === 'text'
          ? `<text x="${it.w / 2}" y="${it.h / 2 + 16}" text-anchor="middle" font-size="46" font-weight="700" fill="${fill}" font-family="Arial">Aa</text>`
          : partsOf(it.t, it.w, it.h, { ...defaultParams(it.t), ...(it.p || {}) })
              .map((pt) => `<path d="${pt.d}" fill="${mix(fill, pt.shade || 0)}"${pt.rule ? ` fill-rule="${pt.rule}"` : ''}/>`)
              .join('');
      b.innerHTML = `<svg viewBox="${-pad} ${-pad} ${it.w + pad * 2} ${it.h + pad * 2}">${inner}</svg>${it.n}`;
      b.onclick = () => onPick(it);
      grid.appendChild(b);
    }
    root.appendChild(grid);
  }
}
