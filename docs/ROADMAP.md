# Lộ trình

> Bản đồ tính năng đầy đủ và thứ tự ưu tiên: [`FEATURE-MAP.md`](FEATURE-MAP.md). Mọi tính năng phải qua phép thử trong [`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md).

Phiên bản hiện tại (0.9): 42 mẫu hình, kéo/đổi cỡ/xoay, màu, thông số riêng từng hình, hoàn tác, xuất SVG, chọn nhiều + nhóm, căn chỉnh + đường gióng, panel lớp, bộ màu thương hiệu + gradient, xuất PNG, nhóm A "đưa ý ra thành hình" (gõ để thêm, kéo thả, vẽ bằng kéo, chữ trên hình, Tab + đường nối, dán, khung vô hạn, tự bố trí).

Bản chạy thật: https://vector-studio.hktruc.workers.dev

## Giai đoạn 1 – Hoàn thiện bộ vẽ
- [x] Chọn nhiều hình, nhóm / bỏ nhóm (Shift+bấm, quét chọn, Ctrl+G / Ctrl+Shift+G; phóng đều và xoay cả nhóm)
- [x] Căn chỉnh, phân bố đều, đường gióng thông minh (6 kiểu căn, phân bố ngang/dọc, đường gióng hồng khi kéo; giữ Alt để tạm tắt)
- [x] Panel lớp (đổi tên, ẩn, khóa) — thẻ **Lớp** ở cột trái; Ctrl+Shift+H ẩn, Ctrl+Shift+L khóa
- [x] Màu theo bộ màu thương hiệu, lưu bộ màu (tự lưu trong trình duyệt, dán được danh sách mã màu, hình mới lấy màu từ bộ)
- [x] Gradient cho màu tô (thẳng có chỉnh góc, tròn)
- [ ] Bóng đổ (cần cách làm không dùng filter để Canva vẫn đọc được)
- [x] Xuất PNG (1x / 2x / 4x, nền trong suốt hoặc trắng, cả khung hoặc vùng chọn)
- [ ] Xuất PDF
- [ ] Thêm thư viện hình: biểu đồ tròn/cột đơn giản, hình sơ đồ tổ chức, biểu tượng

## Giai đoạn 2 – Vẽ đường tự do
- [x] Sửa điểm neo (chuyển hình thành đường, thêm/xóa điểm, nhọn/trơn, uốn cạnh)
- [x] Tay nắm kéo trực tiếp trên hình (góc quạt, đầu mũi tên, bo góc, số tầng…)
- [ ] Công cụ bút: vẽ đường tự do từng điểm
- [ ] Nhập file SVG, tách thành hình sửa được
- [ ] Phép toán hình (hợp, trừ, giao)
- [x] Đường parabol/đường cong có đầu mút tùy chỉnh (Bézier chỉnh hai đầu độc lập, parabol một đỉnh, đầu mút tròn/bằng/mũi tên/chấm/nhọn, xuất hình đặc)

## Giai đoạn 3 – Web app hoàn chỉnh
- [ ] Nhiều trang trong một tài liệu
- [ ] Đăng nhập, lưu dự án lên Cloudflare (D1 + R2)
- [ ] Thư viện hình dùng chung, mẫu theo lĩnh vực (giáo dục, kinh doanh…)
- [ ] Chia sẻ liên kết, cộng tác
- [ ] Tên miền riêng
