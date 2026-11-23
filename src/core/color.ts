/** Làm sáng (s>0) hoặc tối (s<0) một màu hex #rrggbb. */
export function mix(hex: string, s: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (s > 0 ? v + (255 - v) * s : v * (1 + s)));
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
