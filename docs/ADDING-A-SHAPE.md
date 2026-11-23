# Thêm một loại hình mới

Ví dụ: thêm hình **trái tim** hoặc **mây**. Chỉ cần 3 bước.

## 1. Khai báo trong `src/shapes/` (ví dụ `basic.ts`)

```ts
{
  type: 'badge',                       // tên duy nhất
  params: [                            // các thanh trượt ở bảng thuộc tính
    { k: 'r', l: 'Bo góc', min: 0, max: 0.5, step: 0.01, def: 0.2 },
  ],
  parts: (w, h, p) => [                // trả về các mảnh path, tọa độ 0..w × 0..h
    { d: rrect(w, h, p.r) },
    // { d: '...', shade: 0.28 }       // shade > 0 sáng hơn, < 0 tối hơn (dùng cho khối 3D)
  ],
}
```

Thông số có các kiểu: thanh trượt (mặc định), `type: 'text'`, `type: 'check'`, `type: 'select'` (kèm `opts: [['giá trị', 'Nhãn'], …]`).

Tiện ích hình học có sẵn trong `core/geometry.ts`: `Pn` (đa giác theo tọa độ 0..1), `rrect`, `ellipseD`, `pieD`, `polar`, `ngonD`, `starD`, `tiers`.

## 2. Đưa vào thư viện hiển thị: `src/shapes/catalog.ts`

```ts
{ n: 'Huy hiệu', t: 'badge', w: 160, h: 160, p: { r: 0.3 } },
```

Mỗi mục là một "mẫu": cùng loại hình nhưng khác kích thước/thông số (ví dụ 1/2, 1/3, 1/4 hình tròn đều là loại `pie`).

## 2a. (Nên làm) Tay nắm kéo trực tiếp

Thêm `handles` vào khai báo để người dùng kéo ngay trên hình thay vì dùng thanh trượt:

```ts
handles: [{
  tip: 'Kéo ngang để bo tròn góc',
  pos: (w, h, p) => [p.r * w, 0],                // vị trí tay nắm (tọa độ riêng 0..w × 0..h)
  drag: (w, h, p, x, y, snap) => ({ r: x / w }), // điểm đang kéo → thông số mới (tự kẹp min..max)
}],
```

Tiện ích có sẵn trong `core/handles.ts`: `angleOf` (góc quanh tâm), `radiusOf` (khoảng cách tới tâm), `snapAngle` (bước 15° khi giữ Shift). Bộ test tự kiểm tra mọi tay nắm: kéo về đúng chỗ thì thông số không đổi.

## 2b. (Nên làm) Cho phép "gõ để thêm" tìm ra hình

Thêm vài từ đồng nghĩa (không dấu) vào `SYNONYMS` trong `src/shapes/search.ts`, ví dụ `'Huy hiệu': ['badge', 'tem', 'nhan']`.

## 3. Chạy kiểm thử

```bash
npm test
```

Bộ kiểm thử tự kiểm tra: loại hình đã đăng ký, không sinh `NaN`, giá trị mặc định nằm trong khoảng cho phép.

## Lưu ý
- Hình nhiều mảnh (như khối 3D) chia thành nhiều `parts` có `shade` khác nhau.
- Hình có lỗ (vành khuyên) dùng `rule: 'evenodd'`.
- Hình dùng chữ: xem `src/shapes/text.ts`.
