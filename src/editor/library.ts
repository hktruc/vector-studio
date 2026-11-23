import type { LibItem } from '../core/types';
import { LIBRARY } from '../shapes';
import { defaultParams, partsOf } from '../shapes/registry';
import { mix } from '../core/color';

/** Ảnh xem trước của một mẫu hình (dùng ở thư viện và ô "gõ để thêm"). */
export function itemThumb(it: LibItem, fill = '#3F7FB5'): string {
  const pad = Math.max(it.w, it.h) * 0.06;
  const inner =
    it.t === 'text'
      ? `<text x="${it.w / 2}" y="${it.h / 2 + 16}" text-anchor="middle" font-size="46" font-weight="700" fill="${fill}" font-family="Arial">Aa</text>`
      : partsOf(it.t, it.w, it.h, { ...defaultParams(it.t), ...(it.p || {}) })
          .map((pt) => `<path d="${pt.d}" fill="${mix(fill, pt.shade || 0)}"${pt.rule ? ` fill-rule="${pt.rule}"` : ''}/>`)
          .join('');
  return `<svg viewBox="${-pad} ${-pad} ${it.w + pad * 2} ${it.h + pad * 2}">${inner}</svg>`;
}

export interface LibraryActions {
  /** Bấm: thêm vào giữa vùng đang nhìn. */
  pick: (it: LibItem) => void;
  /** Kéo rồi thả tại điểm màn hình (clientX, clientY). */
  drop: (it: LibItem, clientX: number, clientY: number) => void;
  /** Nhấn giữ: cầm mẫu để vẽ bằng kéo trên khung. */
  arm: (it: LibItem) => void;
}

/**
 * Dựng cột thư viện hình. Một nút cho ba cử chỉ, không cần chọn công cụ trước:
 * bấm = thêm · kéo = thả đúng chỗ · nhấn giữ = vẽ bằng kéo.
 */
export function buildLibrary(root: HTMLElement, act: LibraryActions) {
  root.innerHTML = '<p class="hint" style="margin-top:0">Bấm để thêm · kéo thả vào khung · nhấn giữ rồi kéo trên khung để vẽ đúng cỡ.</p>';
  for (const g of LIBRARY) {
    const h = document.createElement('div');
    h.className = 'grp'; h.textContent = g.g; root.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'items';
    for (const it of g.items) {
      const b = document.createElement('button');
      b.className = 'it'; b.title = `${it.n} — bấm để thêm, kéo để thả, nhấn giữ để vẽ`;
      b.innerHTML = itemThumb(it) + it.n;
      wireItem(b, it, act);
      grid.appendChild(b);
    }
    root.appendChild(grid);
  }
}

function wireItem(b: HTMLButtonElement, it: LibItem, act: LibraryActions) {
  let start: { x: number; y: number } | null = null, ghost: HTMLElement | null = null, holdT = 0, handled = false;
  const clear = () => { clearTimeout(holdT); ghost?.remove(); ghost = null; start = null; b.classList.remove('held'); };
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY }; handled = false;
    b.setPointerCapture(e.pointerId);
    holdT = window.setTimeout(() => { if (!start || ghost) return; handled = true; b.classList.add('held'); act.arm(it); }, 450);
  });
  b.addEventListener('pointermove', (e) => {
    if (!start || handled && !ghost) return;
    if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
      clearTimeout(holdT); handled = true;
      ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.innerHTML = itemThumb(it);
      document.body.appendChild(ghost);
    }
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
  });
  b.addEventListener('pointerup', (e) => { if (ghost) act.drop(it, e.clientX, e.clientY); clear(); });
  b.addEventListener('pointercancel', clear);
  // bấm (chuột hoặc phím Enter/Space) — bỏ qua nếu vừa kéo hoặc nhấn giữ
  b.addEventListener('click', () => { if (handled) { handled = false; return; } act.pick(it); });
}
