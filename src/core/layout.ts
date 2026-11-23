/**
 * Tự bố trí sơ đồ bằng một nút: cây, vòng, lưới. Thuần dữ liệu.
 * Làm việc trên các "nút" (mỗi nút là khung bao của một hình hoặc một nhóm) và các cạnh nối (chỉ số nút).
 * Trả về tâm mới cho từng nút; nơi gọi tự dời hình theo.
 */

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type XY = { x: number; y: number };
export type LayoutKind = 'tree' | 'ring' | 'grid';

const cx = (b: Box) => (b.x0 + b.x1) / 2;
const cy = (b: Box) => (b.y0 + b.y1) / 2;
const bw = (b: Box) => b.x1 - b.x0;
const bh = (b: Box) => b.y1 - b.y0;

/** Lưới: sắp theo thứ tự đọc (trên → dưới, trái → phải), số cột ≈ căn bậc hai. */
export function layoutGrid(nodes: Box[], gap = 40): XY[] {
  if (!nodes.length) return [];
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const cellW = Math.max(...nodes.map(bw)) + gap, cellH = Math.max(...nodes.map(bh)) + gap;
  const x0 = Math.min(...nodes.map((b) => b.x0)), y0 = Math.min(...nodes.map((b) => b.y0));
  const order = nodes.map((b, i) => i).sort((i, j) => (Math.round(cy(nodes[i]) / cellH) - Math.round(cy(nodes[j]) / cellH)) || (cx(nodes[i]) - cx(nodes[j])));
  const out: XY[] = new Array(nodes.length);
  order.forEach((i, k) => { out[i] = { x: x0 + (k % cols) * cellW + (cellW - gap) / 2, y: y0 + Math.floor(k / cols) * cellH + (cellH - gap) / 2 }; });
  return out;
}

/**
 * Vòng: nút gốc (nút có nhiều đường đi ra nhất, nếu có nối) ở giữa, các nút khác xếp đều trên vòng tròn,
 * giữ thứ tự theo góc hiện tại quanh tâm để hình không bị xáo trộn.
 */
export function layoutRing(nodes: Box[], edges: [number, number][] = [], gap = 40): XY[] {
  const n = nodes.length; if (!n) return [];
  const c = { x: nodes.reduce((s, b) => s + cx(b), 0) / n, y: nodes.reduce((s, b) => s + cy(b), 0) / n };
  const out = edges.reduce((m, [a]) => (m.set(a, (m.get(a) || 0) + 1), m), new Map<number, number>());
  let hub = -1, best = 1;
  out.forEach((k, i) => { if (k > best || (k === best && hub < 0 && k >= 2)) { hub = i; best = k; } });
  const ring = nodes.map((_, i) => i).filter((i) => i !== hub);
  const size = Math.max(...nodes.map((b) => Math.max(bw(b), bh(b))));
  const r = Math.max((ring.length * (size + gap)) / (2 * Math.PI), hub >= 0 ? size * 1.6 : size * 0.8, 60);
  ring.sort((i, j) => Math.atan2(cy(nodes[i]) - c.y, cx(nodes[i]) - c.x) - Math.atan2(cy(nodes[j]) - c.y, cx(nodes[j]) - c.x));
  const res: XY[] = new Array(n);
  if (hub >= 0) res[hub] = { ...c };
  ring.forEach((i, k) => { const a = -Math.PI / 2 + (2 * Math.PI * k) / ring.length; res[i] = { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }; });
  return res;
}

/**
 * Cây (kiểu sơ đồ tư duy, trái → phải): nút không có đường vào là gốc; con xếp ở cột kế tiếp,
 * cha nằm giữa các con. Nút không nối với ai được coi là một cây riêng.
 */
export function layoutTree(nodes: Box[], edges: [number, number][], gapX = 80, gapY = 30): XY[] {
  const n = nodes.length; if (!n) return [];
  const kids: number[][] = nodes.map(() => []), hasParent = new Array(n).fill(false);
  const seen = new Set<number>();
  // thứ tự con theo vị trí dọc hiện tại
  const sorted = [...edges].sort((e1, e2) => cy(nodes[e1[1]]) - cy(nodes[e2[1]]));
  for (const [a, b] of sorted) if (a !== b && !hasParent[b] && a < n && b < n) { kids[a].push(b); hasParent[b] = true; }
  const roots = nodes.map((_, i) => i).filter((i) => !hasParent[i]).sort((i, j) => cy(nodes[i]) - cy(nodes[j]));
  if (!roots.length) roots.push(0); // toàn vòng tròn: chọn đại một gốc
  const colW: number[] = [], depth = new Array(n).fill(0);
  const res: XY[] = new Array(n);
  let cursor = Math.min(...nodes.map((b) => b.y0));
  const place = (i: number, d: number): number => {
    seen.add(i); depth[i] = d; colW[d] = Math.max(colW[d] || 0, bw(nodes[i]));
    const ch = kids[i].filter((k) => !seen.has(k));
    if (!ch.length) { const y = cursor + bh(nodes[i]) / 2; cursor += bh(nodes[i]) + gapY; res[i] = { x: 0, y }; return y; }
    const ys = ch.map((k) => place(k, d + 1));
    const y = (ys[0] + ys[ys.length - 1]) / 2;
    res[i] = { x: 0, y };
    return y;
  };
  for (const r of roots) if (!seen.has(r)) place(r, 0);
  for (let i = 0; i < n; i++) if (!seen.has(i)) place(i, 0);
  const left = Math.min(...nodes.map((b) => b.x0));
  const colX: number[] = [];
  colW.forEach((w, d) => { colX[d] = d === 0 ? left + w / 2 : colX[d - 1] + colW[d - 1] / 2 + gapX + w / 2; });
  for (let i = 0; i < n; i++) res[i].x = colX[depth[i]];
  return res;
}

export function layout(kind: LayoutKind, nodes: Box[], edges: [number, number][]): XY[] {
  return kind === 'grid' ? layoutGrid(nodes) : kind === 'ring' ? layoutRing(nodes, edges) : layoutTree(nodes, edges);
}
