import type { LibItem } from '../core/types';
import { LIBRARY } from './catalog';

/** Bỏ dấu tiếng Việt + chữ thường, để gõ "tron" vẫn ra "Tròn". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

/**
 * Từ đồng nghĩa (đã bỏ dấu) → tên mẫu trong thư viện. Thêm từ mới ở đây là tìm được ngay.
 */
const SYNONYMS: Record<string, string[]> = {
  'Chữ nhật': ['hcn', 'rect', 'rectangle', 'hop', 'box', 'khung', 'o', 'the', 'card'],
  'Bo góc': ['bo tron', 'rounded', 'nut', 'button', 'pill'],
  'Vuông': ['square', 'hinh vuong'],
  'Tròn': ['circle', 'hinh tron', 'chấm', 'cham', 'dot', 'nut tron'],
  'Elip': ['ellipse', 'oval', 'bau duc'],
  'Vành khuyên': ['ring', 'donut', 'banh xe', 'vong'],
  'Tam giác': ['triangle', 'tg'],
  'Thoi': ['diamond', 'quyet dinh', 'decision', 'hinh thoi'],
  'Ngôi sao': ['star', 'sao'],
  'Dấu cộng': ['plus', 'cong', 'them'],
  'Đường kẻ': ['line', 'duong', 'gach', 'ke'],
  'Mũi tên phải': ['arrow', 'mui ten', '->', 'mt'],
  'Mũi tên đôi': ['<->', 'hai chieu', 'double arrow'],
  'Chevron': ['quy trinh', 'process', 'buoc'],
  'Mũi tên gấp': ['re', 'turn', 'bent arrow'],
  '1/2 hình tròn': ['nua tron', 'ban nguyet', 'half circle', 'quat'],
  '1/3 hình tròn': ['quat', 'pie', 'banh', 'mot phan ba'],
  '1/4 hình tròn': ['quat', 'pie', 'mot phan tu', 'goc tu'],
  'Vòng mũi tên': ['chu ky', 'cycle', 'vong lap', 'loop', 'refresh'],
  'Khối 3D': ['cube', 'hop 3d', 'khoi', '3d'],
  'Trụ': ['cylinder', 'database', 'csdl', 'du lieu', 'tru'],
  'Bong bóng thoại': ['callout', 'loi thoai', 'chat', 'speech', 'ghi chu', 'note'],
  'Kim tự tháp': ['pyramid', 'thap', 'tang'],
  'Phễu': ['funnel', 'pheu', 'sales'],
  'Bậc thang': ['steps', 'cau thang', 'tang truong'],
  'Đường cong': ['curve', 'bezier', 'cong', 'uon', 'luon', 'song', 'wave', 's'],
  'Cung parabol': ['parabol', 'parabola', 'cung', 'vom', 'arc', 'nhip cau'],
  'Mũi tên cong': ['curved arrow', 'mui ten cong', 'vong'],
  'Nét bút nhọn': ['brush', 'net but', 'nhon', 'thu phap'],
  'Văn bản': ['text', 'chu', 'tieu de', 'title', 'ghi'],
};

const ALL: LibItem[] = LIBRARY.flatMap((g) => g.items);

/**
 * Tìm mẫu hình theo chữ gõ. Xếp hạng: trùng tên > tên bắt đầu bằng > chứa > từ đồng nghĩa.
 * Chuỗi rỗng trả về các hình hay dùng.
 */
export function searchLibrary(q: string, limit = 8): LibItem[] {
  const k = fold(q);
  if (!k) return ALL.slice(0, limit);
  const scored: [number, number, LibItem][] = [];
  ALL.forEach((it, i) => {
    const n = fold(it.n), syn = (SYNONYMS[it.n] || []).map(fold);
    let sc = 0;
    if (n === k) sc = 100;
    else if (n.startsWith(k)) sc = 80;
    else if (n.split(/\s+/).some((w) => w.startsWith(k))) sc = 70;
    else if (n.includes(k)) sc = 60;
    else if (syn.some((s) => s === k)) sc = 55;
    else if (syn.some((s) => s.startsWith(k) || s.split(/\s+/).some((w) => w.startsWith(k)))) sc = 40;
    if (sc) scored.push([sc, i, it]);
  });
  return scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, limit).map((x) => x[2]);
}

/** Tìm đúng một mẫu theo tên (dùng cho phím tắt vẽ R, O, A…). */
export const libItem = (name: string): LibItem | undefined => ALL.find((it) => it.n === name);
