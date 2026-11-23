# Triển khai lên Cloudflare (không cần chạy trên máy)

Cloudflare sẽ tự build và đưa web lên mỗi khi bạn đẩy code lên nhánh `main` của GitHub.

## Lần đầu
1. Đăng nhập Cloudflare → **Workers & Pages** → **Create** → chọn nhập kho mã từ **GitHub** (Import a repository).
2. Cho phép Cloudflare truy cập kho `vector-studio`, chọn kho đó.
3. Điền cấu hình build:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** để trống (thư mục gốc)
   - Tên dự án: `vector-studio`
4. Bấm **Save and Deploy**. Sau ít phút bạn có địa chỉ dạng `vector-studio.<tên-tài-khoản>.workers.dev`.

File `wrangler.jsonc` trong kho đã khai báo thư mục `dist/` là nội dung web, nên không cần cấu hình thêm.

## Gắn tên miền riêng (sau này)
Dự án trên Cloudflare → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → nhập tên miền (tên miền cần nằm trong tài khoản Cloudflare, hoặc trỏ DNS về Cloudflare).

## Mỗi lần cập nhật
Sửa code → đẩy lên `main` → Cloudflare tự build và cập nhật. Xem tiến trình ở tab **Deployments**.

## Nếu build lỗi
- Mở bản ghi build trong Cloudflare, xem dòng lỗi đỏ đầu tiên.
- Lỗi `tsc` nghĩa là code sai kiểu dữ liệu; chạy `npm run typecheck` để thấy giống hệt.
- Giao giá trị lỗi cho Claude để sửa.
