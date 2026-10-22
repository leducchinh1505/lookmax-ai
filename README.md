# Lookmax AI — phân tích ngoại hình cá nhân, local-first

Ứng dụng web chạy cục bộ (React + TypeScript + Vite + Tailwind + MediaPipe Face Landmarker).
Ảnh được phân tích **ngay trên thiết bị**, không gọi API AI, không cần tài khoản, không cần cloud,
và chạy **offline** sau lần thiết lập đầu tiên.

> Điểm số mô tả **tỷ lệ hình học 2D** so với các khoảng tham chiếu phổ biến. Chúng **không** xác định
> cấu trúc xương hay mức độ hấp dẫn của một người, và không phải lời khuyên y tế/da liễu.

---

## 1. Trạng thái tính năng (trung thực)

| Tính năng | Trạng thái |
|---|---|
| Web app chạy cục bộ trên Windows (Chrome/Edge) | ✅ Hoạt động, đã kiểm thử |
| Webcam (localhost) + tải ảnh từ ổ cứng | ✅ Đã viết; tải ảnh đã kiểm thử tự động. Webcam cần bạn thử với camera thật |
| MediaPipe chạy on-device, mô hình + WASM lưu cục bộ | ✅ Đã kiểm thử (kể cả khi **ngắt mạng**) |
| Kiểm tra chất lượng ảnh (độ sáng, nét, kích thước mặt, góc, mắt, miệng) | ✅ Có unit test |
| Đo đạc + chấm điểm + độ tin cậy + giới hạn | ✅ Có unit test với khuôn mặt tổng hợp |
| Kế hoạch cải thiện (tần suất, thời lượng, trạng thái) | ✅ Có unit test |
| Lịch sử, tiến trình, so sánh, streak, adherence | ✅ |
| Sao lưu / khôi phục JSON (kèm ảnh) | ✅ Có test round-trip |
| PWA + Service Worker, offline | ✅ Đã kiểm thử trong Chromium (offline thật) |
| CSP chặn mọi kết nối ra ngoài (bản production) | ✅ Đã kiểm thử, không có vi phạm |
| Ứng dụng desktop Tauri | ⚠️ Đã cấu hình đầy đủ nhưng **chưa build được trên máy này vì chưa cài Rust**. Xem mục 5 |
| iPhone Safari / PWA | ⚠️ Giao diện responsive + xử lý iOS đã viết, **chưa thử trên iPhone thật**. Xem [docs/IPHONE.md](docs/IPHONE.md) |
| Phân tích trên ảnh khuôn mặt **thật** | ⚠️ Pipeline đã chạy với MediaPipe thật, nhưng chưa thử với ảnh người thật trong phiên này — hãy thử với ảnh/webcam của bạn |
| SQLite cho desktop | ❌ Không dùng: bản desktop dùng IndexedDB trong WebView2 (bền vững, cùng mã với web/iPhone). Lớp `services/storage.ts` tách riêng để có thể thay bằng SQLite sau |

---

## 2. Cài đặt (Windows)

Yêu cầu: **Node.js 20+** (máy bạn đang có Node 24).

```bash
npm install
```

```bash
npm run setup:assets
```

`setup:assets` sao chép runtime WASM của MediaPipe vào `public/mediapipe/wasm` và tải mô hình
`face_landmarker.task` (~3.6 MB) **một lần** từ kho mô hình chính thức của Google vào `public/models`.
Sau bước này không cần Internet nữa.

## 3. Chạy trên Windows

**Cách nhanh:** nhấp đúp `start-lookmax.bat` → tự cài, build và mở `http://localhost:4173`.

Hoặc thủ công:

```bash
npm run build
```

```bash
npm run preview
```

Mở http://localhost:4173 trong Chrome hoặc Edge. Chế độ phát triển (hot reload): `npm run dev` → http://localhost:5173.

### Chia sẻ cho người khác (không cần cài Node.js)

```bash
npm run package:portable
```

Tạo `release/Lookmax-AI-portable.zip` (~9 MB): app đã build + một server nhỏ chạy bằng PowerShell có sẵn
trong Windows (chỉ nghe trên `localhost`). Người nhận giải nén → nhấp đúp `Mo-Lookmax-AI.bat`.
Hướng dẫn cho người nhận nằm trong `HUONG-DAN.txt` bên trong zip. Mỗi người có dữ liệu riêng trên máy họ.

### Đưa lên web để chia sẻ bằng link (cả iPhone)

Xem [docs/WEB.md](docs/WEB.md) — Netlify Drop (kéo thả thư mục `dist`) hoặc GitHub Pages (workflow có sẵn).

## 4. Sử dụng offline

1. Mở ứng dụng **một lần khi đang chạy bản production** (`npm run preview` hoặc bản PWA) — Service Worker
   sẽ lưu toàn bộ giao diện, WASM (~19 MB) và mô hình vào bộ nhớ đệm.
2. Từ đó, ngắt mạng vẫn mở được app, chụp/tải ảnh, phân tích, xem lịch sử.
3. Có thể "Cài đặt" thành app: Chrome/Edge → biểu tượng cài đặt trên thanh địa chỉ.

Chế độ `npm run dev` **không** bật Service Worker (bình thường với Vite).

## 5. Build ứng dụng desktop (Tauri)

1. Cài Rust: https://rustup.rs (chọn toolchain `stable-x86_64-pc-windows-msvc`) và
   "Desktop development with C++" của Visual Studio Build Tools.
2. Chạy:

```bash
npm run tauri build
```

Bộ cài nằm ở `src-tauri/target/release/bundle/nsis/` (`.exe`) và `.../msi/`.
Chạy thử không đóng gói: `npm run tauri dev`.

Ghi chú: trong Tauri, Service Worker không cần thiết (file đã nằm sẵn trong app). Camera dùng WebView2 —
lần đầu Windows sẽ hỏi quyền camera.

## 6. iPhone

Xem hướng dẫn chi tiết: [docs/IPHONE.md](docs/IPHONE.md). Tóm tắt:
- `localhost` trên PC **không** truy cập được từ iPhone.
- Camera trực tiếp và Service Worker trên iOS **bắt buộc HTTPS**. Nút "Upload / take photo" vẫn mở
  camera iPhone ngay cả không có HTTPS.
- Cách an toàn: HTTPS trong mạng Wi-Fi nội bộ bằng `mkcert`, không mở cổng ra Internet.

## 7. Sao lưu & khôi phục

Settings → **Export backup** tạo một file `lookmax-backup-YYYY-MM-DD.json` chứa toàn bộ lịch sử, ảnh
(JPEG, base64), kế hoạch, cài đặt. **Import backup**:
- *merge*: thêm bản ghi chưa có (không ghi đè bản đã có cùng ID);
- *replace all*: xoá dữ liệu hiện tại rồi nạp từ file.

Không có đồng bộ tự động giữa PC và iPhone — chuyển file backup thủ công (AirDrop, cáp, USB…).
Có thể tắt "Keep photos" để chỉ lưu số đo (không lưu ảnh).

## 8. Kiểm thử

```bash
npm test
```

50 test (Vitest) bao gồm: phép đo hình học (bất biến khi xoay/thu phóng ảnh, tilt, đối xứng),
ước lượng góc đầu, cổng chất lượng ảnh, chỉ số da trên ảnh tổng hợp, quy đổi điểm, độ phủ dữ liệu,
tính tất định (không ngẫu nhiên), kế hoạch gợi ý (không hứa tăng điểm, không tuyên bố thay đổi xương),
tiến trình/streak, backup và IndexedDB.

## 9. Cấu trúc thư mục

```
lookmax-ai/
├─ src/
│  ├─ core/                  # Thuần TypeScript, không phụ thuộc UI — tái sử dụng cho iPhone/desktop
│  │  ├─ types.ts
│  │  ├─ geometry.ts
│  │  ├─ landmarks.ts        # FaceLandmarks: chỉ số điểm mốc, góc đầu, phân loại góc chụp
│  │  ├─ imageQuality.ts     # ImageQuality
│  │  ├─ measurements.ts     # FacialMeasurements (số đo thô)
│  │  ├─ skin.ts             # Chỉ số bề mặt da trên ảnh (không chẩn đoán)
│  │  ├─ metrics.ts          # Định nghĩa chỉ số, khoảng tham chiếu, trọng số, độ tin cậy
│  │  ├─ scoring.ts          # ScoringEngine
│  │  ├─ recommendations.ts  # RecommendationEngine
│  │  ├─ progress.ts         # ProgressTracking
│  │  ├─ backup.ts           # Định dạng & kiểm tra file sao lưu
│  │  └─ *.test.ts
│  ├─ services/
│  │  ├─ faceDetection.ts    # FaceDetection (MediaPipe, mô hình cục bộ)
│  │  ├─ imageLoader.ts      # Đọc ảnh (EXIF iPhone), thumbnail
│  │  ├─ analyzer.ts         # Pipeline: ảnh → chất lượng → điểm mốc → số đo → điểm
│  │  └─ storage.ts          # LocalStorage (IndexedDB) + export/import
│  ├─ ui/                    # React: pages/, components/, store, router
│  ├─ App.tsx, main.tsx, index.css
├─ public/                   # icon, manifest; mediapipe/ và models/ do setup:assets tạo
├─ scripts/                  # fetch-assets.mjs, gen-icons.mjs
├─ src-tauri/                # Vỏ desktop Tauri 2
├─ docs/IPHONE.md
└─ start-lookmax.bat
```

## 10. Cách tính điểm (minh bạch)

Ba lớp được tách riêng và hiển thị riêng trên giao diện:

1. **Số đo** (`measurements.ts`): ví dụ *khoảng cách hai khoé mắt trong ÷ chiều rộng mắt = 1.04×*.
   Điểm mốc được xoay theo trục giữa mặt nên không phụ thuộc độ nghiêng đầu hay kích thước ảnh.
2. **Điểm quy đổi** (`scoring.ts`): 100 nếu nằm trong khoảng tham chiếu; giảm tuyến tính còn 40 ở
   khoảng cách bằng 1 "tolerance" ngoài khoảng; 0 ở ~1.67 tolerance.
   Điểm nhóm = trung bình có trọng số của các chỉ số đo được. Nhóm chỉ được chấm khi có ≥50% trọng số dữ liệu.
   Điểm tổng chỉ hiển thị khi ≥3 nhóm được chấm.
3. **Diễn giải** (`interpret`): "trong khoảng / hơi trên / dưới khoảng tham chiếu (mô tả)", không phán xét.

**Độ tin cậy** = độ tin cậy gốc của chỉ số × điểm chất lượng ảnh × mức phù hợp góc chụp
(× phạt nếu miệng mở/mắt nhắm). Tất cả khoảng tham chiếu, trọng số, độ tin cậy nằm trong
`src/core/metrics.ts` và có thể chỉnh. Đây là **heuristic** từ các quy tắc tỷ lệ phổ biến
(tam đình, ngũ nhãn, số liệu nhân trắc học), thay đổi theo dân tộc, giới tính, tuổi.

Góc chụp: ảnh chính diện cho hầu hết số đo; ảnh nghiêng/3/4 hiện chỉ đóng góp *góc hàm ước lượng*
(từ lưới 3D của MediaPipe, độ tin cậy thấp). Nhóm *Hair & Grooming* dựa trên tự đánh giá, không phải thị giác máy tính.
Chỉ số da phản ánh ảnh dưới ánh sáng hiện tại, không phải tình trạng da.

## 11. Quyền riêng tư

- Không có backend, không có analytics, không có request mạng chứa ảnh/dữ liệu.
- Bản production có Content-Security-Policy `connect-src 'self'` — trình duyệt chặn mọi kết nối tới máy chủ khác.
- Dữ liệu nằm trong IndexedDB của trình duyệt/app; xoá được toàn bộ trong Settings → Danger zone.
