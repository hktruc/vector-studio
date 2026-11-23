/** Vẽ một chuỗi SVG thành ảnh PNG bằng trình duyệt (chỉ chạy trên trình duyệt). */
export function svgToPng(svg: string, width: number, height: number, background?: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        const g = c.getContext('2d');
        if (!g) throw new Error('Trình duyệt không hỗ trợ vẽ ảnh.');
        if (background) { g.fillStyle = background; g.fillRect(0, 0, width, height); }
        g.drawImage(img, 0, 0, width, height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh PNG.'))), 'image/png');
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được hình SVG.')); };
    img.src = url;
  });
}
