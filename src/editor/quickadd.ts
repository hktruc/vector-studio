import type { LibItem } from '../core/types';
import { searchLibrary } from '../shapes';
import { itemThumb } from './library';

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * Ô "gõ để thêm": nổi ngay tại chỗ (bấm đúp lên khung trống, hoặc phím /).
 * Gõ vài chữ → Enter thêm hình khớp nhất; không khớp hình nào thì thêm chính dòng chữ đó.
 * Không phải hộp thoại chặn: bấm ra ngoài hoặc Esc là đóng.
 */
export class QuickAdd {
  private box: HTMLDivElement | null = null;

  constructor(private onPick: (it: LibItem) => void, private onText: (text: string) => void) {}

  get isOpen() { return !!this.box; }

  open(clientX: number, clientY: number) {
    this.close();
    const box = (this.box = document.createElement('div'));
    box.className = 'qa';
    box.innerHTML = `<input type="text" placeholder="Gõ tên hình: tròn, mũi tên, phễu… hoặc gõ chữ" aria-label="Gõ để thêm hình"><div class="qa-list" role="listbox"></div>`;
    document.body.appendChild(box);
    const W = 300, H = 330;
    box.style.left = `${Math.max(8, Math.min(window.innerWidth - W - 8, clientX - 20))}px`;
    box.style.top = `${Math.max(8, Math.min(window.innerHeight - H - 8, clientY - 18))}px`;
    const input = box.querySelector('input')!, list = box.querySelector<HTMLDivElement>('.qa-list')!;
    let items: LibItem[] = [], idx = 0;
    const draw = () => {
      const q = input.value.trim();
      items = searchLibrary(q);
      const rows = items.map((it, i) => `<button class="qa-it${i === idx ? ' on' : ''}" data-i="${i}" role="option">${itemThumb(it)}<span>${esc(it.n)}</span></button>`);
      if (q) rows.push(`<button class="qa-it${idx === items.length ? ' on' : ''}" data-i="${items.length}" role="option"><b class="qa-aa">Aa</b><span>Thêm chữ “${esc(q)}”</span></button>`);
      list.innerHTML = rows.join('') || '<p class="hint">Gõ để tìm hình</p>';
      list.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => (b.onmousedown = (e) => { e.preventDefault(); idx = +b.dataset.i!; choose(); }));
    };
    const total = () => items.length + (input.value.trim() ? 1 : 0);
    const choose = () => {
      const q = input.value.trim();
      if (idx < items.length && items[idx]) { const it = items[idx]; this.close(); this.onPick(it); }
      else if (q) { this.close(); this.onText(q); }
    };
    input.oninput = () => { idx = 0; draw(); };
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(total() - 1, idx + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
    };
    input.onblur = () => setTimeout(() => this.close(), 0);
    draw();
    input.focus();
  }

  close() { this.box?.remove(); this.box = null; }
}
