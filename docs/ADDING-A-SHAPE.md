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

Tiện ích hình học có sẵn trong `core/geometry.ts`: `Pn` (đa giác theo tọa độ 0..1), `rrect`, `ellipseD`, `pieD`, `polar`, `ngonD`, `starD`, `tiers`.

## 2. Đưa vào thư viện hiển thị: `src/shapes/catalog.ts`

```ts
{ n: 'Huy hiệu', t: 'badge', w: 160, h: 160, p: { r: 0.3 } },
```

Mỗi mục là một "mẫu": cùng loại hình nhưng khác kích thước/thông số (ví dụ 1/2, 1/3, 1/4 hình tròn đều là loại `pie`).

## 3. Chạy kiểm thử

```bash
npm test
```

Bộ kiểm thử tự kiểm tra: loại hình đã đăng ký, không sinh `NaN`, giá trị mặc định nằm trong khoảng cho phép.

## Lưu ý
- Hình nhiều mảnh (như khối 3D) chia thành nhiều `parts` có `shade` khác nhau.
- Hình có lỗ (vành khuyên) dùng `rule: 'evenodd'`.
- Hình dùng chữ: xem `src/shapes/text.ts`.
