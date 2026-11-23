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
- Định dạng tài liệu có trường `v` (phiên bản). Khi đổi cấu trúc dữ liệu, tăng `v` và viết hàm nâng cấp ở `DocStore.load`.

## Điểm mở rộng đã chừa sẵn
| Muốn thêm | Làm ở đâu |
|---|---|
| Loại hình mới | `src/shapes/*.ts` + `catalog.ts` |
| Định dạng xuất mới (PNG, PDF, PPTX) | `src/core/export.ts` thêm hàm; nút ở `editor/app.ts` |
| Lưu lên đám mây (Cloudflare R2/D1/KV) | thay `platform/` + `DocStore` storage adapter |
| Nhiều trang / nhiều tài liệu | mở rộng `Doc` (mảng `pages`), nâng `v` |
| Chọn nhiều hình, nhóm hình | `DocStore.sel` đổi thành tập id; `EditorCanvas` vẽ khung chung |
| Công cụ vẽ đường (Bézier), sửa điểm neo | thêm loại hình `path` với `points` trong `p`; công cụ mới ở `editor/` |
| Giao diện bằng framework (React/Svelte) | giữ nguyên `core/`, `shapes/`; viết lại `editor/` |

## Vì sao chưa dùng framework
Phần lõi là hình học và dữ liệu, không phụ thuộc framework. Giữ `editor/` bằng TypeScript thuần cho nhẹ và dễ hiểu ở giai đoạn đầu; khi giao diện phức tạp (panel lớp, thuộc tính nhiều, cộng tác) thì chuyển `editor/` sang framework mà không động tới lõi.
