import type { ShapeDef } from '../core/types';
import { pathToD } from '../core/pathdata';
import { refitPath, type PathPart } from '../core/pathedit';

/** Đường tự do: tạo bằng "Chuyển thành đường"; bấm đúp để sửa điểm neo (core/pathedit.ts). */
export const pathShapes: ShapeDef[] = [
  { type: 'path', params: [], refit: refitPath,
    parts: (w, h, p) => (p.parts || []).map((pt: PathPart) => ({ d: pathToD(pt.subs, w, h) || 'M0 0 Z', shade: pt.sh, rule: pt.rule })) },
];
