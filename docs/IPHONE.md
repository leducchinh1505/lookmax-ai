# Dùng Lookmax AI trên iPhone

Ứng dụng là một PWA: mở bằng Safari rồi "Thêm vào Màn hình chính". Không cần App Store.

## Vì sao cần thêm bước?

- `http://localhost:4173` trên PC nghĩa là "chính máy này" — iPhone mở `localhost` sẽ trỏ về chính iPhone.
- iOS chỉ cho phép **camera trực tiếp (getUserMedia)** và **Service Worker (offline)** trên **HTTPS**.
- Không có HTTPS, app vẫn chạy qua `http://<IP-PC>:4173`, và nút **Upload / take photo** vẫn mở camera
  iPhone (dùng `<input type="file">`), nhưng **không có offline** và **không có camera trực tiếp**.

## Cách A — HTTPS trong mạng Wi-Fi nội bộ (khuyến nghị, không ra Internet)

Mọi thứ chỉ chạy trong mạng nhà bạn. Ảnh vẫn được xử lý trên iPhone, không gửi về PC.

1. Cài mkcert trên Windows (ví dụ `winget install FiloSottile.mkcert`), rồi:

```bash
mkcert -install
```

2. Tìm IP LAN của PC (`ipconfig` → IPv4, ví dụ `192.168.1.20`) và tạo chứng chỉ trong thư mục dự án:

```bash
mkcert -cert-file certs/lan.pem -key-file certs/lan-key.pem 192.168.1.20 localhost
```

3. Build và phục vụ trên mạng LAN (Vite tự dùng `certs/` nếu có):

```bash
npm run build
```

```bash
npm run preview:lan
```

   Windows Firewall có thể hỏi — chỉ cho phép **Private networks**, KHÔNG chọn Public.

4. Cài CA gốc lên iPhone: chạy `mkcert -CAROOT` để biết thư mục, gửi file `rootCA.pem` sang iPhone
   (AirDrop/email cho chính mình) → Settings → *Profile Downloaded* → Install →
   Settings → General → About → **Certificate Trust Settings** → bật tin cậy cho mkcert.
   ⚠️ CA này cho phép máy bạn ký chứng chỉ bất kỳ; giữ kín file `rootCA-key.pem`, và gỡ profile khi không dùng nữa.

5. Trên iPhone mở Safari: `https://192.168.1.20:4173` → đồng ý màn hình giới thiệu → mở trang
   *New Analysis* một lần để mô hình được tải và lưu đệm.

6. Share → **Add to Home Screen**. Mở app từ biểu tượng trên màn hình chính.

Sau bước 6, có thể tắt PC: app trên iPhone chạy offline từ bộ nhớ đệm.

## Cách B — không HTTPS (nhanh, hạn chế)

```bash
npm run build
```

```bash
npm run preview:lan
```

Mở `http://<IP-PC>:4173` trên Safari. Dùng được *Upload / take photo*, nhưng không offline và cần PC đang chạy.

## Giới hạn của iOS cần biết

- **Lưu trữ**: Safari có thể xoá dữ liệu web không dùng trong ~7 ngày nếu **không** thêm vào Màn hình chính.
  Khi chạy từ Màn hình chính, dữ liệu bền vững hơn — nhưng vẫn nên **Export backup định kỳ** (Settings).
- Dữ liệu của app trên Màn hình chính tách biệt với dữ liệu trong tab Safari.
- Bộ nhớ đệm offline ~23 MB (WASM + mô hình). Settings hiển thị dung lượng đã dùng/khả dụng.
- Camera trực tiếp chỉ hoạt động khi app ở foreground; iOS có thể hỏi quyền mỗi lần mở lại.
- Ảnh HEIC: Safari tự chuyển sang JPEG khi chọn qua `<input type="file">`.

## Chuyển dữ liệu PC ↔ iPhone

Không có đồng bộ tự động. Settings → Export backup trên thiết bị nguồn → chuyển file .json →
Settings → Import backup (merge) trên thiết bị đích.

## Trạng thái kiểm thử

Giao diện đã được kiểm tra ở kích thước 390×844 (iPhone) trong Chromium. **Chưa kiểm thử trên iPhone thật**
— đây là Giai đoạn 5 trong kế hoạch. Nếu gặp lỗi trên Safari, hãy ghi lại thông báo hiển thị trong app.
