import { describe, expect, it } from 'vitest';
import { CLIP_MAX_PIXELS, CLIP_SCALE, clipImageSize, isOwnPaste, type OwnCopy } from '../src/core/clipboard';
import { DocStore } from '../src/core/store';
import { exportShapes, svgViewSize } from '../src/core/export';
import { registerBuiltinShapes } from '../src/shapes';

registerBuiltinShapes();
const c = (o: Partial<OwnCopy> = {}): OwnCopy => ({ json: '{}', svg: '<svg/>', w: 408, h: 248, at: 1000, left: false, ...o });

describe('sao chép sang Canva / PowerPoint', () => {
  it('ảnh sao chép nét gấp đôi, có giới hạn điểm ảnh', () => {
    expect(CLIP_SCALE).toBe(2);
    expect(clipImageSize(204, 124)).toMatchObject({ width: 408, height: 248 });
    const big = clipImageSize(4000, 3000);
    expect(big.width * big.height).toBeLessThanOrEqual(CLIP_MAX_PIXELS);
  });
  it('chưa rời trang: dán lại là hình sửa được', () => {
    expect(isOwnPaste(c(), null, 5000)).toBe(true);
    expect(isOwnPaste(null, null, 5000)).toBe(false);
  });
  it('đã rời trang: chỉ nhận là của mình khi ảnh đúng cỡ, trong 30 phút', () => {
    const left = c({ left: true });
    expect(isOwnPaste(left, { w: 408, h: 248 }, 60_000)).toBe(true);
    expect(isOwnPaste(left, { w: 409, h: 248 }, 60_000)).toBe(false); // ảnh khác (chụp màn hình…)
    expect(isOwnPaste(left, null, 60_000)).toBe(false); // không có ảnh (đã sao chép chữ ở nơi khác)
    expect(isOwnPaste(left, { w: 408, h: 248 }, 1000 + 31 * 60_000)).toBe(false);
  });
  it('ảnh sao chép đúng cỡ vùng chọn (gồm cả viền), SVG không có thứ Canva/PowerPoint đọc kém', () => {
    const st = new DocStore(null);
    const s = st.addFromLibrary({ n: 'r', t: 'rrect', w: 200, h: 120, p: { r: 0 } });
    s.sw = 4;
    const svg = exportShapes([s]);
    expect(svgViewSize(svg)).toEqual({ w: 208, h: 128 });
    expect(clipImageSize(208, 128)).toMatchObject({ width: 416, height: 256 });
    expect(svg).not.toMatch(/<marker|<mask|<filter|<foreignObject|<script/);
  });
});
