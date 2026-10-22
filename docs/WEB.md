# Đưa Lookmax AI lên web miễn phí

Lookmax AI là trang web tĩnh, không có máy chủ xử lý. Khi đưa lên Netlify hoặc GitHub Pages:

- Bạn bè mở bằng một **link https**, dùng được trên **PC, Android và iPhone** (camera trực tiếp + offline đều chạy vì có HTTPS).
- **Ảnh vẫn được phân tích trên điện thoại/máy của từng người.** Máy chủ chỉ gửi file app (HTML/JS/mô hình) xuống; app có CSP chặn mọi kết nối gửi dữ liệu ra ngoài.
- Dữ liệu của mỗi người nằm trong trình duyệt của họ; không ai (kể cả bạn) xem được.
- Ai có link đều mở được app. Không đăng link ở nơi công khai nếu bạn không muốn.

---

## Cách 1 — Netlify Drop (dễ nhất, ~3 phút, không cần git)

1. Trong thư mục dự án, build bản mới nhất:

```bash
npm run build
```

2. Mở https://app.netlify.com/drop và đăng ký/đăng nhập tài khoản Netlify miễn phí.
3. Kéo **cả thư mục `dist`** (trong `Downloads\lookmax-ai\dist`) thả vào trang đó.
4. Đợi upload (~23 MB). Netlify cho link dạng `https://ten-ngau-nhien.netlify.app`.
5. (Tuỳ chọn) Site configuration → Change site name → đặt tên dễ nhớ, ví dụ `lookmax-cua-toi`.

**Cập nhật sau này:** build lại, vào site trên Netlify → tab *Deploys* → kéo thả thư mục `dist` mới vào ô "Drag and drop".

File `dist/_headers` (có sẵn) giúp Netlify trả đúng kiểu file `.wasm` và không cache nhầm bản cũ.

---

## Cách 2 — GitHub Pages (tự động cập nhật mỗi lần bạn đẩy code)

Máy bạn đã có `git`. Dự án có sẵn workflow `.github/workflows/deploy-pages.yml`: GitHub sẽ tự cài,
tải mô hình, chạy test, build và đăng.

1. Tạo tài khoản https://github.com (nếu chưa có).
2. Tạo repository mới: https://github.com/new → tên ví dụ `lookmax-ai` → **Public**
   (GitHub Pages miễn phí yêu cầu repo public) → *không* tích "Add a README" → Create.
3. Trong thư mục dự án, chạy lần lượt (thay `TEN-CUA-BAN`):

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Lookmax AI"
```

```bash
git remote add origin https://github.com/TEN-CUA-BAN/lookmax-ai.git
```

```bash
git push -u origin main
```

   Lần đầu push, Windows sẽ mở cửa sổ đăng nhập GitHub.
4. Trên GitHub: repo → **Settings → Pages → Source: GitHub Actions**.
5. Vào tab **Actions**, chờ workflow "Deploy to GitHub Pages" xanh (~2 phút). Nếu nó chạy trước bước 4 và lỗi,
   bấm *Re-run all jobs*.
6. Link: `https://TEN-CUA-BAN.github.io/lookmax-ai/`

**Cập nhật sau này:** `git add .` → `git commit -m "..."` → `git push`. GitHub tự build lại.

Lưu ý: repo public nghĩa là **mã nguồn** ai cũng xem được (không có ảnh hay dữ liệu cá nhân nào trong đó —
`.gitignore` đã loại `dist/`, `release/`, `certs/`, mô hình và `node_modules`).

---

## Bạn bè dùng trên iPhone

1. Mở link bằng **Safari** (không dùng Chrome/Zalo/Messenger trình duyệt trong app — mở bằng Safari).
2. Bấm "I understand", vào **New Analysis** một lần và đợi mô hình tải xong (cần mạng lần đầu, ~23 MB).
3. Bấm **Share (⬆) → Add to Home Screen**. Từ đó mở bằng biểu tượng trên màn hình chính.
4. Lần đầu bấm *Camera*, iOS sẽ hỏi quyền camera → Allow.

Lưu ý iOS: dữ liệu ở bản Home Screen tách biệt với tab Safari; nên vào Settings → Export backup định kỳ.

## Bạn bè dùng trên máy tính

Mở link bằng Chrome/Edge. Có thể bấm biểu tượng "Cài đặt app" trên thanh địa chỉ để có cửa sổ riêng và dùng offline.

## Khi app được cập nhật

App tự tải bản mới ở lần mở kế tiếp khi có mạng. Nếu ai đó vẫn thấy bản cũ: đóng hẳn app rồi mở lại.
