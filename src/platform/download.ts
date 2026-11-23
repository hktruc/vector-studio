/**
 * Lưu file về máy. Tách riêng để sau này đổi cách lưu (ví dụ lưu lên Cloudflare R2) mà không đụng vào phần còn lại.
 */
export function saveBlob(filename: string, blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

/** Lưu một file chữ về máy. Trả về true nếu trình duyệt cho phép tải. */
export function saveTextFile(filename: string, text: string, mime = 'image/svg+xml'): boolean {
  return saveBlob(filename, new Blob([text], { type: mime }));
}
