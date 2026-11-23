# Kiến trúc

## Nguyên tắc
1. **Tách dữ liệu khỏi giao diện.** `src/core` và `src/shapes` không dùng `document`/`window`; chạy được trong Node (nhờ vậy kiểm thử nhanh, và sau này dùng được ở server/Worker để xuất file hàng loạt).
2. **Mọi hình là dữ liệu.** Một hình = một object JSON (`Shape`) + một định nghĩa loại hình (`ShapeDef`). Lưu, hoàn tác, xuất, chia sẻ đều làm trên JSON.
3. **Một nguồn sự thật cho việc vẽ.** Hàm `shapeToSVG` (core/export.ts) vẽ hình cho cả màn hình, ảnh xem trước và file xuất. Xem gì ra nấy.
4. **Thêm loại hình = thêm một khai báo**, không sửa giao diện (xem ADDING-A-SHAPE.md).

## Luồng dữ liệu

```
Thư viện (catalog) ──bấm──▶ DocStore.addFromLibrary ──▶ doc.shapes[]
                                   ▲        │ emit('change' | 'select')
 EditorCanvas / PropsPanel ────────┘        ▼
 (sửa trực tiếp Shape, rồi commit)     EditorCanvas.render() ◀── shapeToSVG ◀── ShapeDef.parts()
                                            │
                                  exportDocument / exportShape ──▶ file .svg
```

- `DocStore` (core/store.ts): giữ `Doc`, hình đang chọn, hoàn tác/làm lại (snapshot JSON), lưu tạm vào `localStorage`. Giao diện chỉ nghe hai sự kiện: `change` (vẽ lại) và `select` (dựng lại bảng thuộc tính).
- `ShapeDef.parts(w, h, params)` trả về các mảnh path trong hệ tọa độ cục bộ `0..w × 0..h`. Phép xoay/lật/dời do `shapeTransform` lo.
- Định dạng tài liệu có trường `v` (phiên bản, hằng `DOC_VERSION`). Khi đổi cấu trúc dữ liệu, tăng `v` và thêm bước nâng cấp trong `migrateDoc` (core/store.ts).
  - v2: thêm `Shape.gid` (nhóm hình).
  - v3: thêm `Shape.name`, `Shape.hidden`, `Shape.locked`, `Doc.gnames` (tên nhóm).

## Chọn nhiều & nhóm
- `DocStore.sel` là danh sách id. Chọn một hình thuộc nhóm luôn chọn cả nhóm. `selected` chỉ trả về hình khi chọn đúng một hình lẻ; `selection` trả về tất cả.
- Nhóm không lồng nhau: nhóm các nhóm sẽ gộp thành một nhóm phẳng. Thứ tự lớp di chuyển theo "khối" (cả nhóm một lúc).
- Nhiều hình chỉ phóng đều (giữ tỉ lệ) vì hình đã xoay không kéo giãn lệch được mà vẫn đúng dạng. Thông số cần phóng theo (ví dụ cỡ chữ) khai báo bằng `ShapeDef.scaleParams`.
- Khi xuất SVG, mỗi nhóm được bọc trong một thẻ `<g>` để Canva/Illustrator nhận ra nhóm.

## Panel lớp (editor/layers.ts)
- Hiển thị `doc.shapes` đảo ngược (trên cùng ở đầu), nhóm là một dòng mở rộng được. Ảnh thu nhỏ vẽ bằng `shapeToSVG`.
- Ẩn (`hidden`): không vẽ, không xuất, không chọn. Khóa (`locked`): vẫn vẽ và xuất, nhưng không chọn được (`selectable()` trong core/store.ts).
- Tên mặc định lấy từ tên mẫu trong thư viện (`shapeLabel` ở shapes/index.ts).

## Căn chỉnh & đường gióng (core/align.ts)
- `alignShapes` / `distributeShapes` làm việc trên "khối" (nhóm = một khối). Chỉ có một khối thì căn theo trang.
- `snapToGuides(khung đang kéo, các khung khác, trang, ngưỡng)` trả về độ dời để thẳng hàng cạnh/tâm và danh sách đường gióng; `EditorCanvas` chỉ việc vẽ. Trục nào không bắt được đường gióng thì vẫn bắt lưới như cũ.

## Điểm mở rộng đã chừa sẵn
| Muốn thêm | Làm ở đâu |
|---|---|
| Loại hình mới | `src/shapes/*.ts` + `catalog.ts` |
| Định dạng xuất mới (PNG, PDF, PPTX) | `src/core/export.ts` thêm hàm; nút ở `editor/app.ts` |
| Lưu lên đám mây (Cloudflare R2/D1/KV) | thay `platform/` + `DocStore` storage adapter |
| Nhiều trang / nhiều tài liệu | mở rộng `Doc` (mảng `pages`), nâng `v` |
| Chọn nhiều hình, nhóm hình | ✅ Đã làm: `DocStore.sel` là mảng id; nhóm = `Shape.gid` (các hình cùng nhóm luôn liền nhau); biến đổi nhiều hình ở `core/transform.ts` |
| Công cụ vẽ đường (Bézier), sửa điểm neo | thêm loại hình `path` với `points` trong `p`; công cụ mới ở `editor/` |
| Giao diện bằng framework (React/Svelte) | giữ nguyên `core/`, `shapes/`; viết lại `editor/` |

## Vì sao chưa dùng framework
Phần lõi là hình học và dữ liệu, không phụ thuộc framework. Giữ `editor/` bằng TypeScript thuần cho nhẹ và dễ hiểu ở giai đoạn đầu; khi giao diện phức tạp (panel lớp, thuộc tính nhiều, cộng tác) thì chuyển `editor/` sang framework mà không động tới lõi.
