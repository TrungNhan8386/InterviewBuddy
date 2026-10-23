# InterviewBuddy — CV/JD Analysis API (SCRUM-39)

Backend cho SCRUM-40/41, API contract cho SCRUM-42 và kiểm thử cho SCRUM-43.
Module không cần thư viện ngoài; chạy độc lập bằng Node.js hoặc ghép vào Next.js App Router.

## Chạy nhanh

Yêu cầu Node.js **22.9 trở lên**. Mở terminal tại thư mục này:

```powershell
Copy-Item .env.example .env.local
# Điền GEMINI_API_KEY trong .env.local trên máy của bạn.
npm start
```

Endpoint local: `POST http://127.0.0.1:3001/api/analyze`.
Không có key: API trả `503 AI_NOT_CONFIGURED`; không tự trả dữ liệu giả.
Không cần `npm install` vì module chỉ dùng thư viện tích hợp sẵn trong Node.js.

## Tài liệu cho Khang

- [API contract v1 — request, response, mã lỗi và cách nối UI](../docs/api/CV_JD_ANALYSIS_API_v1.md).
- [Hướng dẫn bàn giao SCRUM-42 → SCRUM-46](../docs/api/HANDOFF_TO_KHANG.md).
- [Request mẫu](../docs/api/examples/analyze.request.json) và [response mẫu từ kiểm thử offline](../docs/api/examples/analyze.success.json).
- Client dùng trong trình duyệt: `lib/analysis/client.mjs` (kèm khai báo TypeScript).
- Adapter Next.js: `app/api/analyze/route.js`.

## Kiểm thử

```powershell
npm test
npm run verify:offline
# Chỉ chạy khi đã cấu hình key; gửi 5 cặp dữ liệu giả lập đến Gemini thật:
npm run verify:live
# Kiểm tra không có key trong mã, báo cáo hoặc thay đổi Git:
npm run verify:secrets
```

`verify:offline` chạy qua HTTP nội bộ và thay thế transport Gemini bằng fixture.
`verify:live` không dùng fixture response; nếu thiếu key, ghi báo cáo `blocked` và thoát với mã 2.
Xem [báo cáo kiểm thử](../docs/test/SCRUM-39_TEST_REPORT.md).

## Phạm vi tích hợp

- API nhận **văn bản** CV/JD. Phần tải và trích xuất PDF `/api/extract-cv` thuộc mã của Khang.
- `server.mjs` chỉ mở trên `127.0.0.1` theo mặc định; cho phép frontend local bằng `ALLOWED_ORIGINS` trong `.env.local`.
- Khi ghép cùng Next.js, đặt `lib/analysis/` và `app/api/analyze/` ở cùng cấp gốc mã nguồn. Không thay `package.json` của app đang có bằng package của module này.
- Module không thêm cơ sở dữ liệu, đăng nhập, lưu CV hay sửa giao diện của thành viên khác.
- Đã gọi Gemini thật với `gemini-3.5-flash-lite`: 5/5 cặp CV/JD đạt kết quả kỳ vọng. Chưa ghép với mã giao diện của Khang vì mã đó chưa được đẩy lên repo.
- Key chỉ lưu trong cấu hình cục bộ được Git bỏ qua; người lấy nhánh cần cấu hình key ở môi trường chạy của họ. Không chép key vào frontend hoặc tài liệu bàn giao.
