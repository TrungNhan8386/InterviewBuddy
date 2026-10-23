# Bàn giao SCRUM-42 cho Khang — tích hợp SCRUM-46

## Tệp cần đọc

1. [API contract v1](CV_JD_ANALYSIS_API_v1.md).
2. [Request mẫu](examples/analyze.request.json).
3. [Response mẫu từ kiểm thử offline](examples/analyze.success.json).
4. Client helper: `src/lib/analysis/client.mjs` và khai báo kiểu `client.d.mts`.

## Luồng tích hợp

```text
PDF CV → /api/extract-cv của Khang → cvText
Ô nhập JD                           → jdText
                     ↓
             POST /api/analyze
                     ↓
      fitScore / matchedSkills / missingSkills
                     ↓
          Màn hình kết quả của Khang
```

### Cách A — thử với backend độc lập

Từ thư mục `src` của nhánh này:

```powershell
Copy-Item .env.example .env.local
# Thêm GEMINI_API_KEY vào .env.local khi nhóm đã có key.
npm start
```

Frontend gọi `http://127.0.0.1:3001/api/analyze`. Với frontend ở port 3000, `.env.example` đã có origin local tương ứng.
Khác port/domain: thêm origin đầy đủ vào `ALLOWED_ORIGINS`, rồi khởi động lại server.
Thiếu key sẽ nhận `503 AI_NOT_CONFIGURED`; dùng response mẫu để thiết kế giao diện trong thời gian chờ, ghi rõ dữ liệu mẫu trong bản demo.

### Cách B — ghép vào Next.js của Khang

Giữ `package.json` và cấu trúc hiện có của app Khang. Chép:

```text
lib/analysis/                 → thư mục lib/analysis của app
app/api/analyze/route.js      → thư mục app/api/analyze của app
```

Hai thư mục `lib` và `app` phải cùng cấp, thường là dưới `src/`.
Adapter dùng Node runtime, không dùng Edge runtime. Không cần thêm thư viện ngoài.
Thêm key vào `.env.local` của app Next.js, khởi động lại, rồi gọi URL tương đối `/api/analyze`.

## Checklist để kiểm tra SCRUM-46 khi tích hợp

- Nút Analyze gửi JSON gồm `cvText`, `jdText`, `language`.
- Hiện trạng thái loading và ngăn gửi lặp trong lúc chờ.
- HTTP 200: hiển thị đúng tỷ lệ và hai danh sách, kể cả danh sách rỗng hoặc điểm 0.
- HTTP lỗi: hiển thị lỗi; không giữ điểm cũ như thể đó là kết quả của lần gửi mới.
- Chưa cấu hình key: xử lý `AI_NOT_CONFIGURED`, không tự đổi sang kết quả mẫu.
- Thử lại luồng upload CV → trích xuất text → Analyze → màn hình kết quả với API thật khi có key.

## Trạng thái bàn giao

- Mã API và contract đã được viết; có 5 cặp dữ liệu giả lập và kiểm thử offline tái chạy được.
- Đã kiểm chứng Gemini thật với `gemini-3.5-flash-lite`: 5/5 cặp giả lập đạt kết quả kỳ vọng. Xem báo cáo trong `docs/test/results/SCRUM-39-live.json`.
- Key được giữ ở cấu hình cục bộ, không đi kèm nhánh hoặc tài liệu. Mỗi môi trường chạy cần tự cấu hình key ở server.
- Chưa xác nhận tích hợp với giao diện Khang vì mã giao diện chưa được đẩy lên repo.
- Tài liệu này là nội dung bàn giao qua repository; chưa có xác nhận Khang đã đọc hoặc tích hợp.
