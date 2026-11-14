# SCRUM-122 — Xử lý quota bằng thông báo rõ ràng

Ngày thực hiện: 12/11/2026. Trước khi bắt đầu đã fetch `origin --prune`; main mới nhất là `0668228`. Nhánh riêng `feat/scrum-122-quota-hung` bắt đầu từ commit này, không ghi đè SCRUM-120/121 chưa commit. Quy định cập nhật code trước mỗi task đã ghi ở `AGENTS.md` của workspace và bản có thể đưa vào Git ở root repository; giữ nguyên `src/AGENTS.md` của Next.js.

## Phương án và hành vi

Jira yêu cầu fallback model **hoặc** thông báo rõ ràng. Tôi chọn thông báo rõ ràng; không thêm fallback hoặc đổi model/key/quota. Theo [tài liệu quota Gemini](https://ai.google.dev/gemini-api/docs/rate-limits), rate limit có thể đến từ requests/tokens theo phút hoặc requests theo ngày, áp dụng theo project. Vì vậy không hứa lỗi provider sẽ hết sau vài phút hoặc hết lúc 0 giờ Việt Nam.

- Nhà cung cấp: giữ mã backend `AI_RATE_LIMITED`/HTTP 429; Analysis adapter giữ mã `RATE_LIMIT`. Thông báo Việt/Anh nói rõ nhà cung cấp giới hạn lượt hoặc hết quota; người dùng thử lại sau hoặc liên hệ nhóm kiểm tra hạn mức nếu lỗi tiếp diễn.
- Hạn mức ứng dụng: giữ `AI_DAILY_LIMIT` cho Chat và `DAILY_LIMIT` cho Analysis, giữ thông báo reset lúc 0 giờ Việt Nam theo bộ đếm của ứng dụng. Không dùng reset này để mô tả quota của Google.
- Analysis: nói rõ JD/CV được giữ trên trang để người dùng không phải nhập lại. Đây không phải cam kết giữ dữ liệu sau khi đóng trang chưa lưu.
- Chat: nói rõ các câu hỏi/câu trả lời **đã lưu** vẫn còn, có thể về Dashboard và tiếp tục phiên sau. Điều kiện thời lượng/phiên vẫn áp dụng khi resume; không kéo dài phiên hoặc mở lại phiên đã completed.
- Đồng bộ thông báo cho Chat đang dùng, helper thông báo interview, Analysis UI và API adapter. Dùng chung module browser-safe `lib/ai/provider-limit.mjs`, kèm khai báo TypeScript.
- Áp dụng ở Analysis generateContent, Interview next JSON, streamGenerateContent HTTP 429 và lỗi code 429 bên trong SSE dù HTTP ban đầu là 200.
- Không gửi raw body lỗi của Google ra UI/log. Không suy đoán daily/per-minute từ chuỗi lỗi; không tự đổi key/model, không tự retry potentially billed requests. Người dùng chủ động bấm thử lại.

Đây là lựa chọn sản phẩm có giới hạn retry tự động bằng 0. [Hướng dẫn retry Gemini](https://ai.google.dev/gemini-api/docs/troubleshooting) mô tả backoff cho lỗi tạm thời; task này chưa thêm scheduler/backoff hay cooldown UI. `AI_RATE_LIMITED` vẫn là mã chung cho rate limit/quota provider, chưa phân loại chi tiết từng loại quota.

## Kiểm thử

Áp dụng test-driven-development: test mới thất bại trước thay đổi vì thông báo chưa chỉ rõ provider/quota, sau đó đạt. Một ca harness dùng nhầm `generate` thay vì API `next` đã được sửa; không tính lỗi harness là lỗi ứng dụng.

| Kiểm tra | Kết quả |
|---|---|
| Provider quota ở Analysis | Một upstream request, trả AI_RATE_LIMITED/429, không lộ raw body |
| Interview JSON quota | Một upstream request, trả mã/message đúng, không tự retry |
| Interview SSE HTTP 429 | Không phát ra câu hỏi hợp lệ; lỗi quota rõ ràng |
| Interview SSE HTTP 200 chứa code 429 | Ánh xạ đúng quota, không xuất raw error body |
| Thông báo Việt/Anh | Quota provider khác hạn mức app, không hứa “vài phút” hoặc reset 0 giờ cho provider |
| Persistence/recovery | PGlite local: khi provider lỗi, answer vẫn có; thử lại thủ công tạo một câu tiếp; replay cùng lượt không gọi provider thêm, không trùng question/answer |

Bảy test mới ở `src/tests/provider-quota.test.mjs` dùng upstream có kiểm soát và database local theo migration hiện có. Đây không phải bằng chứng Google thật đã hết quota.

Toàn bộ **262/262 tests đạt**, lint đạt, production build/TypeScript đạt. Không sửa ngưỡng hay xóa test cũ để làm xanh.

Kiểm tra trình duyệt dùng production local, Edge headless, đăng nhập account test Supabase thật. Phản hồi 429 được inject ở ranh giới API của trình duyệt, vì mục tiêu là xác nhận thông báo/input/session UI; không cố làm cạn quota thật. Kết quả chi tiết và ảnh được ghi trong [results/scrum122](results/scrum122/).

## Chạy lại

```powershell
cd src
node --test tests/provider-quota.test.mjs
npm test
npm run lint
npm run build
```

Thử UI trên môi trường test bằng cách inject `RATE_LIMIT` (Analysis) hoặc `AI_RATE_LIMITED` (Chat); đối chiếu `DAILY_LIMIT` / `AI_DAILY_LIMIT` riêng. Khi lỗi, kiểm tra JD/PDF còn trên trang và session vẫn đọc được. Khi kiểm tra recovery backend, phải xác nhận số hàng question/answer chứ không chỉ nhìn toast thành công.

## Giới hạn và bàn giao

Chưa gây quota cạn thật ở Google, chưa triển khai staging, chưa kiểm tra fallback vì không chọn phương án đó. Không tuyên bố toàn hệ thống đã chịu tải hoặc mọi provider error đều được phân loại riêng. Không thay prompt của SCRUM-121, API schema, giao diện bố cục, database schema hoặc hạn mức sử dụng.

Các thay đổi SCRUM-121 vẫn ở nhánh riêng chưa commit, vì chưa được merge vào main. Khi nhóm tích hợp hai nhánh, cần chạy lại hồi quy. Lượt này chưa commit/push hoặc đổi trạng thái/comment Jira.

## Chuẩn bị PR ngày 13/11/2026

PR được đặt sau SCRUM-121 để tích hợp theo thứ tự 121 → 122 → 123 → 124. Giữ nguyên cách xử lý quota; bộ 262 test đã chạy lại trên nhánh kế thừa SCRUM-121 và đạt. Main gốc vẫn là `0668228`; kết quả UI/quota phía trên là bằng chứng đợt triển khai ban đầu, không phải đã chạy lại trên bản kết hợp.
