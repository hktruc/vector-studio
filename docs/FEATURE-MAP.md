# Bản đồ tính năng

Trạng thái: ✅ đã có · ◐ có một phần · ⬜ chưa có.
Đọc `DESIGN-PRINCIPLES.md` trước: mọi tính năng phải giữ được cảm giác "đổ não ra giấy".

## A. Tốc độ đưa ý ra thành hình (ưu tiên cao nhất)
| Tính năng | Ghi chú | TT |
|---|---|---|
| Thêm hình từ thư viện (một cú bấm) | | ✅ |
| Gõ để thêm: bấm đúp lên khung (hoặc phím `/`) mở ô tìm, gõ "tròn", "mũi tên", Enter | tìm theo tên, từ đồng nghĩa, gõ không dấu; không khớp thì thêm chữ | ✅ |
| Kéo hình từ thư viện thả đúng chỗ | | ✅ |
| Vẽ hình bằng kéo trực tiếp trên khung (phím tắt R, O, A… hoặc nhấn giữ hình trong thư viện) | R chữ nhật · O tròn · A mũi tên · T chữ · L đường kẻ; mũi tên/đường kẻ theo hướng kéo | ✅ |
| Gõ chữ ngay trên hình (bấm đúp vào hình) | chữ tự co vừa khung, màu chữ tự tương phản | ✅ |
| Hình tiếp theo từ hình đang chọn (Tab = tạo hình kề bên và nối) | Tab cả khi đang gõ chữ: gõ → Tab → gõ… | ✅ |
| Đường nối thông minh bám vào hình, tự đi theo khi kéo | thẳng, gấp khúc, cong; đầu mút mũi tên/chấm/tròn; xuất dạng hình đặc | ✅ |
| Dán ảnh/SVG/văn bản thẳng vào khung | ảnh tự thu nhỏ; mỗi dòng chữ thành một khối; thả file ảnh vào khung | ✅ |
| Khung vô hạn, thu phóng, kéo khung nhìn | Ctrl+cuộn / chụm hai ngón; cuộn, phím cách+kéo, chuột giữa | ✅ |
| Sơ đồ tự bố trí (cây, vòng, lưới) bằng một nút | theo đường nối | ✅ |

## B. Thao tác nhanh trên nhiều hình
| Tính năng | TT |
|---|---|
| Chọn nhiều (kéo khung, Shift), nhóm / bỏ nhóm | ✅ |
| Căn chỉnh, phân bố đều, đường gióng khi kéo | ✅ |
| Nhân đôi bằng kéo kèm phím, Ctrl+D | ◐ |
| Đổi màu hàng loạt, bộ màu thương hiệu | ✅ |
| Sao chép dán, dán tại chỗ, dán giữ kiểu | ◐ (Ctrl+C/X/V, dán tại con trỏ; chưa có dán giữ kiểu) |
| Panel lớp (ẩn, khóa, đổi tên) | ✅ |
| Hoàn tác / làm lại | ✅ |

## C. Hình sống (thông số + sửa trực tiếp)
| Tính năng | TT |
|---|---|
| Thông số riêng mỗi hình (thanh trượt) | ✅ |
| Tay nắm kéo ngay trên khung (góc quạt, đầu mũi tên, bo góc, số tầng) | ⬜ |
| Chuyển hình thành đường, sửa điểm neo (và quay lại dạng thông số nếu chưa sửa) | ⬜ |
| Kéo cạnh để uốn cong cạnh | ⬜ |
| Đường cong parabol/Bézier với đầu mút tùy chỉnh | ⬜ (đã có bản thử riêng) |
| Biến dạng: uốn, xoắn, kéo theo khung bao | ⬜ |
| Kiểu "nét tay" (đường hơi lệch) cho sơ đồ phác | ⬜ |

## D. Tạo hình phức tạp từ hình đơn giản
| Tính năng | TT |
|---|---|
| Boolean: hợp, trừ, giao, loại trừ | ⬜ |
| Mảng: thẳng hàng, lưới, tròn, theo đường dẫn | ⬜ |
| Đối xứng / gương | ⬜ |
| Offset đường, bo / vát góc | ⬜ |
| Symbol / component dùng lại (sửa mẫu, cả bản sao đổi) | ⬜ |

## E. Chính xác (tùy chọn, bật khi cần)
| Tính năng | TT |
|---|---|
| Bắt lưới (mặc định tắt, Alt tạm tắt mọi bắt điểm) | ✅ |
| Bắt điểm: đầu mút, giữa, tâm, giao điểm, vuông góc | ⬜ |
| Bắt góc cực (15°, 30°, 45°) | ◐ |
| Nhập số: kích thước, góc, tọa độ | ✅ |
| Đơn vị thật (mm, cm, m), tỉ lệ bản vẽ | ⬜ |
| Ghi kích thước, đo khoảng cách, góc, diện tích | ⬜ |
| Ràng buộc: song song, vuông góc, đồng tâm, bằng nhau | ⬜ |
| Lưới đẳng cự, lưới cực | ⬜ |

## F. Màu, nét, hiển thị
| Tính năng | TT |
|---|---|
| Màu tô đặc, viền, độ trong suốt | ✅ |
| Gradient, pattern, hatch | ◐ (có gradient thẳng/tròn) |
| Nét đứt, đầu mút mũi tên, độ dày nét đổi dọc đường | ◐ (đầu mút mũi tên/chấm/tròn cho đường nối) |
| Bóng đổ, làm mờ | ⬜ |

## G. Nhập, xuất, nền tảng
| Tính năng | TT |
|---|---|
| Xuất SVG (cả khung / một hình) | ✅ |
| Xuất PNG, PDF, PPTX, DXF | ◐ (có PNG 1x/2x/4x) |
| Nhập SVG, ảnh nền, vector hóa ảnh | ⬜ |
| Lưu tự động (tạm trong trình duyệt) | ✅ |
| Lưu dự án lên đám mây, nhiều dự án, nhiều trang | ⬜ |
| Chia sẻ liên kết, cộng tác thời gian thực | ⬜ |
| Chạy mượt với ≥ 5.000 hình (chỉ vẽ lại phần đổi) | ⬜ |
| Cảm ứng (pinch, hai ngón), bút stylus | ◐ (chụm/kéo hai ngón) |

## Thứ tự làm đề xuất
1. **A: tốc độ đưa ý ra** (gõ để thêm, kéo thả, Tab nối hình, đường nối thông minh, khung vô hạn + thu phóng).
2. **B: chọn nhiều, nhóm, căn chỉnh, panel lớp.**
3. **C: tay nắm kéo trực tiếp; chuyển hình thành đường, sửa điểm neo.**
4. **D: boolean, mảng, đối xứng.**
5. **E: bắt điểm, đơn vị thật, ghi kích thước** (nâng từ "phác" lên "bản vẽ").
6. **G: xuất PNG/PDF, lưu đám mây, cộng tác.**
7. **F, ràng buộc CAD, hiệu năng lớn** xen kẽ khi cần.

Mỗi giai đoạn xong phải qua phép thử trong `DESIGN-PRINCIPLES.md` (3 giây ra hình, không chế độ, không hộp thoại chặn).
