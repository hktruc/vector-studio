import { describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { exportDocument, exportShape } from '../src/core/export';
import { registerBuiltinShapes } from '../src/shapes';
import { LIBRARY } from '../src/shapes';

registerBuiltinShapes();

describe('xuất SVG', () => {
  it('xuất cả khung với viewBox đúng và có đủ hình', () => {
    const st = new DocStore(null);
    st.addFromLibrary(LIBRARY[0].items[3]);
    st.addFromLibrary(LIBRARY[2].items[0]);
    const svg = exportDocument(st.doc, true);
    expect(svg).toContain('viewBox="0 0 1280 720"');
    expect((svg.match(/<path /g) || []).length).toBe(2);
    expect(svg).not.toContain('<rect width="1280"');
    expect(exportDocument(st.doc, false)).toContain('<rect width="1280"');
  });
  it('xuất riêng một hình có kích thước sát hình', () => {
    const st = new DocStore(null);
    const s = st.addFromLibrary({ n: 't', t: 'rrect', w: 200, h: 100, p: { r: 0 } });
    expect(exportShape(s)).toContain('viewBox="0 0 204 104"');
  });
});

describe('hoàn tác / làm lại', () => {
  it('undo rồi redo trả lại đúng số hình', () => {
    const st = new DocStore(null);
    st.addFromLibrary(LIBRARY[0].items[0]);
    st.addFromLibrary(LIBRARY[0].items[1]);
    expect(st.doc.shapes.length).toBe(2);
    st.undo(); expect(st.doc.shapes.length).toBe(1);
    st.redo(); expect(st.doc.shapes.length).toBe(2);
  });
});
