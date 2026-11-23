# Vector Studio

Bộ vẽ hình vector chạy trên trình duyệt: khối, mũi tên, hình học, quạt tròn (1/2, 1/3, 1/4…), kim tự tháp, phễu, sơ đồ… Xuất **SVG** để dùng trong Canva, PowerPoint, Illustrator, Figma.

Mục tiêu dài hạn: phát triển thành một web app vector cao cấp dùng được cho nhiều lĩnh vực (slide, sơ đồ, thiết kế, giáo dục…). Mã nguồn được tổ chức để thêm tính năng mà không phải viết lại từ đầu.

## Chạy trên máy (tùy chọn)

```bash
npm install
npm run dev        # mở http://localhost:5173
npm test           # kiểm thử
npm run build      # đóng gói vào dist/
```

> Bạn không bắt buộc chạy trên máy: có thể làm việc hoàn toàn qua GitHub + Cloudflare (xem `docs/DEPLOY-CLOUDFLARE.md`).

## Cấu trúc

```
src/
  core/      Dữ liệu và logic thuần (không đụng giao diện): kiểu dữ liệu, hình học, xuất SVG, store + hoàn tác
  shapes/    Thư viện hình. Mỗi loại hình là một định nghĩa nhỏ; catalog.ts là danh mục hiển thị
  editor/    Giao diện: khung vẽ, cột thư viện, bảng thuộc tính, phím tắt
  platform/  Phần phụ thuộc môi trường (tải file...). Đổi ở đây khi muốn lưu lên đám mây
tests/       Kiểm thử tự động (chạy trong CI mỗi lần đẩy code)
docs/        Tài liệu: kiến trúc, cách thêm hình, lộ trình, hướng dẫn triển khai
```

Đọc tiếp: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/ADDING-A-SHAPE.md`](docs/ADDING-A-SHAPE.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md) · [`docs/DEPLOY-CLOUDFLARE.md`](docs/DEPLOY-CLOUDFLARE.md)
