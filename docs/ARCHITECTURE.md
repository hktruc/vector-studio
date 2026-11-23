# Kiến trúc

> Trước khi thêm tính năng, đọc [`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md): không chế độ, không hộp thoại chặn, mặc định tự do.

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
  - v4: thêm `Shape.grad` (màu chuyển sắc).
  - v5: thêm `Shape.label`, `Shape.lc` (chữ trên hình); loại hình `connector` (đường nối) và `image` (ảnh dán).
  - v6: thêm loại hình `curve` (đường cong) và `path` (đường tự do, sửa điểm neo).

## Chọn nhiều & nhóm
- `DocStore.sel` là danh sách id. Chọn một hình thuộc nhóm luôn chọn cả nhóm. `selected` chỉ trả về hình khi chọn đúng một hình lẻ; `selection` trả về tất cả.
- Nhóm không lồng nhau: nhóm các nhóm sẽ gộp thành một nhóm phẳng. Thứ tự lớp di chuyển theo "khối" (cả nhóm một lúc).
- Nhiều hình chỉ phóng đều (giữ tỉ lệ) vì hình đã xoay không kéo giãn lệch được mà vẫn đúng dạng. Thông số cần phóng theo (ví dụ cỡ chữ) khai báo bằng `ShapeDef.scaleParams`.
- Khi xuất SVG, mỗi nhóm được bọc trong một thẻ `<g>` để Canva/Illustrator nhận ra nhóm.

## Panel lớp (editor/layers.ts)
- Hiển thị `doc.shapes` đảo ngược (trên cùng ở đầu), nhóm là một dòng mở rộng được. Ảnh thu nhỏ vẽ bằng `shapeToSVG`.
- Ẩn (`hidden`): không vẽ, không xuất, không chọn. Khóa (`locked`): vẫn vẽ và xuất, nhưng không chọn được (`selectable()` trong core/store.ts).
- Tên mặc định lấy từ tên mẫu trong thư viện (`shapeLabel` ở shapes/index.ts).

## Màu sắc
- **Bộ màu thương hiệu** (`core/palette.ts`, lớp `BrandPalette`): lưu riêng trong `localStorage` (khóa `vector-studio-palette-v1`), không nằm trong tài liệu, nên dùng chung cho mọi bản vẽ. `DocStore.colorSource` lấy màu cho hình mới từ đây.
- **Gradient** (`Shape.grad`): `shapeToSVG` tự thêm `<defs>` với `<linearGradient>`/`<radialGradient>` dùng `gradientUnits="userSpaceOnUse"` trong hệ tọa độ riêng của hình, nên xoay/lật hình thì gradient đi theo. Mỗi độ sáng tối (`shade`) có một gradient riêng. Tham số `idPrefix` tránh trùng id khi cùng một hình được vẽ nhiều lần trên trang (khung vẽ dùng `vsg`, ảnh thu nhỏ ở panel lớp dùng `lt`).
- Gradient không phải marker/mask/filter nên vẫn đúng quy tắc "hình đặc"; nhưng Canva thường không cho đổi màu gradient, giao diện có ghi chú.

## Đưa ý ra thành hình (nhóm A)
| Phần | Lõi (thuần, có test) | Giao diện |
|---|---|---|
| Khung vô hạn, thu phóng | `core/camera.ts` (`zoomAt`, `fitBox`, `viewCenter`) | `EditorCanvas.cam`, thanh thu phóng góc phải dưới |
| Chữ trên hình | `core/text.ts` ước lượng bề rộng chữ (Arial) nên chạy được trong Node; `labelSVG` trong export.ts | ô `textarea.inedit` đè lên hình khi bấm đúp |
| Đường nối | `core/connect.ts`: `routeConnector` (thẳng/gấp khúc/cong), `strokeOutline` (nét → hình đặc, mọi mảnh cùng chiều để tô nonzero), `syncConnectors` (gọi trong `DocStore.emitChange`) | bấm chọn bằng vùng bấm rộng 14px |
| Tab | `DocStore.addNext` tìm chỗ trống bên phải → dưới → trên → trái | Tab khi chọn hình, hoặc khi đang gõ chữ |
| Tự bố trí | `core/layout.ts` (`layoutTree/Ring/Grid`) làm trên khung bao của từng khối | nút Cây/Vòng/Lưới khi chọn ≥ 2 hình |
| Gõ để thêm | `shapes/search.ts` (bỏ dấu, từ đồng nghĩa — thêm từ mới vào `SYNONYMS`) | `editor/quickadd.ts` |
| Sao chép/dán | `DocStore.copySelection/pasteShapes` (id mới, nhóm mới, nối lại đường nối) | sự kiện copy/cut/paste của trình duyệt; ảnh qua `platform/image.ts` (thu nhỏ ≤ 1400px) |

- Đường nối là một `Shape` như mọi hình (đúng quy tắc 2): `p.a`, `p.b` là id hai đầu; vị trí của nó là dữ liệu suy ra, luôn được tính lại sau mỗi thay đổi.
- Xóa hình thì đường nối dính vào nó bị xóa theo.
- Khung vẽ được dựng lại sau mỗi lần bấm, nên khi cần biết hình dưới con trỏ ở sự kiện `dblclick` thì dùng `document.elementFromPoint`, không dùng `e.target`.

## Hình sống (nhóm C)
- **Tay nắm thông số** (`ShapeDef.handles`, xử lý chung ở `core/handles.ts`): mỗi tay nắm có `pos` (vị trí theo tọa độ riêng 0..w × 0..h) và `drag` (điểm kéo → thông số mới). Giá trị tự được kẹp theo `min/max` và làm tròn theo `step` của `ParamDef`, nên `drag` chỉ cần tính "thô". Giao diện vẽ hình thoi vàng, không cần biết hình là gì (đúng quy tắc 2).
- **Đường tự do** (`path`): `core/pathdata.ts` đọc/ghi `d` (M L H V C S Q T A Z, cung A đổi sang Bézier), `core/pathedit.ts` lo chuyển đổi và sửa điểm. Điểm neo lưu theo tỉ lệ khung; `orig` giữ hình gốc để "quay lại dạng thông số" khi `edited` còn false.
- **Uốn cạnh**: dời cả hai tay nắm của đoạn một lượng `d / (3t(1−t))` để điểm tại t đi đúng theo chuột (phép biến đổi tuyến tính, nên kéo từng bước nhỏ vẫn chính xác).
- Chế độ sửa điểm neo: bấm đúp vào đường (hoặc Enter) để vào; Esc, bấm ra ngoài hoặc chọn hình khác để ra (`EditorCanvas.editPathId`).

## Đường cong (core/curve.ts, shapes/curves.ts)
- Loại hình `curve`. Hai đầu mút lưu theo tỉ lệ khung (`x0,y0,x1,y1`), nên đổi cỡ khung là co giãn đường cong.
- Bézier: tay nắm mỗi đầu lưu dạng góc + độ dài **so với dây cung** (`a1,k1,a2,k2`), nên hai đầu chỉnh độc lập và kéo đầu mút thì giữ dáng. Parabol: `h` (độ cao đỉnh) và `sk` (vị trí đỉnh), vẽ như Bézier bậc hai.
- Nét → hình đặc bằng `strokeOutline` (dùng chung với đường nối); đầu mút `round`/`butt`/`arrow`/`dot`/`point` (nhọn = độ dày giảm dần về 0).
- `ShapeDef.refit` (mới): `DocStore.emitChange` gọi cho mọi hình có hook này; đường cong dùng nó để khung luôn ôm sát mà không dời đường cong.
- `ParamDef.show` (mới): ẩn/hiện thanh chỉnh theo thông số khác (ví dụ chỉ hiện "Độ cao đỉnh" khi kiểu là parabol).
- Tay nắm trên khung: chấm xanh (`data-ch="p0"/"p3"`) dời đầu mút; hình thoi hồng (`c1`/`c2`/`q`) đổi hướng, độ cong, đỉnh.

## Căn chỉnh & đường gióng (core/align.ts)
- `alignShapes` / `distributeShapes` làm việc trên "khối" (nhóm = một khối). Chỉ có một khối thì căn theo trang.
- `snapToGuides(khung đang kéo, các khung khác, trang, ngưỡng)` trả về độ dời để thẳng hàng cạnh/tâm và danh sách đường gióng; `EditorCanvas` chỉ việc vẽ. Trục nào không bắt được đường gióng thì vẫn bắt lưới như cũ.

## Điểm mở rộng đã chừa sẵn
| Muốn thêm | Làm ở đâu |
|---|---|
| Loại hình mới | `src/shapes/*.ts` + `catalog.ts` |
| Định dạng xuất mới (PDF, PPTX) | `src/core/export.ts` thêm hàm; nút ở `editor/app.ts`. PNG đã có: core tính cỡ (`rasterSize`, `sizedSVG`), `platform/raster.ts` vẽ SVG lên canvas — vẫn dùng đúng SVG xuất ra, nên PNG giống hệt SVG |
| Lưu lên đám mây (Cloudflare R2/D1/KV) | thay `platform/` + `DocStore` storage adapter |
| Nhiều trang / nhiều tài liệu | mở rộng `Doc` (mảng `pages`), nâng `v` |
| Chọn nhiều hình, nhóm hình | ✅ Đã làm: `DocStore.sel` là mảng id; nhóm = `Shape.gid` (các hình cùng nhóm luôn liền nhau); biến đổi nhiều hình ở `core/transform.ts` |
| Công cụ vẽ đường (Bézier), sửa điểm neo | thêm loại hình `path` với `points` trong `p`; công cụ mới ở `editor/` |
| Giao diện bằng framework (React/Svelte) | giữ nguyên `core/`, `shapes/`; viết lại `editor/` |

## Vì sao chưa dùng framework
Phần lõi là hình học và dữ liệu, không phụ thuộc framework. Giữ `editor/` bằng TypeScript thuần cho nhẹ và dễ hiểu ở giai đoạn đầu; khi giao diện phức tạp (panel lớp, thuộc tính nhiều, cộng tác) thì chuyển `editor/` sang framework mà không động tới lõi.
