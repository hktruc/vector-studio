import { describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { MAX_PNG_PIXELS, exportDocument, exportShapes, rasterSize, sizedSVG, svgViewSize } from '../src/core/export';
import { registerBuiltinShapes } from '../src/shapes';

registerBuiltinShapes();

describe('kích thước ảnh PNG', () => {
  it('nhân đúng theo độ nét', () => {
    expect(rasterSize(1280, 720, 1)).toEqual({ width: 1280, height: 720, scale: 1, reduced: false });
    expect(rasterSize(1280, 720, 2)).toMatchObject({ width: 2560, height: 1440, reduced: false });
  });
  it('quá giới hạn trình duyệt thì tự giảm độ nét, giữ đúng tỉ lệ', () => {
    const r = rasterSize(1920, 1080, 4);
    expect(r.reduced).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(MAX_PNG_PIXELS);
    expect(r.width / r.height).toBeCloseTo(1920 / 1080, 2);
    expect(r.scale).toBeLessThan(4);
  });
  it('không bao giờ ra ảnh 0 điểm ảnh', () => {
    expect(rasterSize(0.2, 0.2, 1)).toMatchObject({ width: 1, height: 1 });
  });
});

describe('chuẩn bị SVG để vẽ thành PNG', () => {
  it('đổi cỡ điểm ảnh của thẻ <svg> ngoài cùng mà giữ viewBox', () => {
    const st = new DocStore(null);
    st.addFromLibrary({ n: 'r', t: 'rrect', w: 100, h: 50 });
    const svg = exportDocument(st.doc);
    const out = sizedSVG(svg, 2560, 1440);
    expect(out).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 1280 720" width="2560" height="1440">/);
    expect(sizedSVG(out, 1280, 720)).toBe(svg); // chỉ đổi đúng hai con số, phần còn lại giữ nguyên
  });
  it('đọc được cỡ khung của SVG cả trang và SVG vùng chọn', () => {
    const st = new DocStore(null);
    const s = st.addFromLibrary({ n: 'r', t: 'rrect', w: 200, h: 100, p: { r: 0 } });
    expect(svgViewSize(exportDocument(st.doc))).toEqual({ w: 1280, h: 720 });
    expect(svgViewSize(exportShapes([s]))).toEqual({ w: 204, h: 104 });
    expect(svgViewSize('<svg>')).toEqual({ w: 0, h: 0 });
  });
});
