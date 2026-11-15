# SCRUM-94 — Kiểm thử Chat, Supabase và Gemini thật

Ngày chạy: 06/11/2026, giờ Việt Nam. Nhánh `feat/scrum-94-chat-streaming-hung`, commit `444fc08` (PR #22). Người dùng cung cấp cấu hình qua file local; các giá trị được điền vào `.env.local` đã được Git bỏ qua.

## 1. Kết luận

Luồng đăng nhập → phân tích CV/JD → tạo phiên → Chat streaming → lưu câu trả lời/câu hỏi → tải lại → kết thúc đã chạy với **Supabase và Gemini thật**. Bộ API/persistence/RLS đạt **19/19 ca**.

Mẫu tốc độ gồm **20 yêu cầu sinh mới** và **1 lần thử lại thủ công** sau lỗi Gemini. Trong 20 yêu cầu mới, 19 lượt có câu hỏi hợp lệ được lưu, 16 lượt hiện chữ trong hai giây và 19 lượt hoàn tất trong năm giây. **Chưa đạt tiêu chí nhanh 90%; chưa nghiệm thu toàn bộ SCRUM-94.**

Hồ sơ tổng hợp dài **12.526 ký tự** phân tích và phỏng vấn được. Lỗi quan sát trong lần chạy là Gemini giới hạn lượt gọi, không phải bằng chứng CV dài gây lỗi. Chưa xác định giới hạn theo phút, token hay ngày của nhà cung cấp.

## 2. Môi trường và phạm vi

| Thành phần | Cấu hình thực tế |
| --- | --- |
| Ứng dụng | Next.js dev trên Windows, `http://localhost:3000`; chưa đo bản production |
| Trình duyệt | Edge headless qua Python Playwright 1.64.1; 1440 × 1100 |
| Xác thực/database | Supabase dùng chung do Nhân bàn giao; Auth và RLS bật |
| AI | Gemini, model cấu hình `gemini-3.5-flash-lite`; mock tắt |
| Dữ liệu | CV/JD tổng hợp do công cụ tạo, câu trả lời test định trước; không dùng hồ sơ ứng viên thật |
| Mạng | Mạng của máy đang chạy, không giả lập chậm; chưa đo băng thông/loại đường truyền |
| Quyền | Dùng anon key và tài khoản test đã đăng nhập; không dùng service-role, không sửa schema/migration/RLS |

Đăng nhập qua trang `/login` thật. Nút bắt đầu tại trang Setup hiện bị vô hiệu hóa, nên runner tạo phiên bằng API sản phẩm đã xác thực rồi mở trang Chat được bảo vệ `/interview/<id>`. Do đó đây là kiểm thử Chat/persistence thật, **chưa phải toàn bộ luồng thao tác từ Setup**.

CV được dán dưới dạng văn bản vào trang Analysis. Lần chạy này không kiểm tra lại tải/trích xuất PDF, độ đúng của fit score hay toàn bộ vòng feedback UC-08. Bộ kiểm tra không thay HTTP response, không dùng Auth giả/PGlite và không thêm route bỏ qua xác thực.

## 3. Supabase: 19/19 ca đạt

Bộ `npm run test:session-api` đã chạy trước khi tạo các analysis mới:

- Tạo phiên, kiểm tra dữ liệu đầu vào và ownership của analysis.
- Từ chối truy cập khi chưa đăng nhập hoặc tài khoản khác truy cập dữ liệu của A.
- Lưu answer lần đầu trả 201; gửi lại trả 200 với cùng answer ID.
- Resume ở trạng thái chờ trả lời/chờ câu hỏi, giữ đúng answer anchor.
- Chặn tài khoản B đọc answer, generation, AI count của A; chặn người dùng ghi trực tiếp bảng usage.
- Kết thúc phiên, từ chối trả lời sau khi đóng; yêu cầu next ở phiên đã kết thúc không gọi AI.

Log: [kết quả API thật](results/scrum94-real-session-api-20261106.log).

Lưu ý tái chạy: test có assertion “analysis mới nhất là seed analysis”. Sau lần này đã giữ lại ba analysis mới của riêng lượt test, nên cần xử lý fixture có chủ đích trước khi chạy lại. Không reset dữ liệu dùng chung hoặc xóa seed để ép test đạt.

## 4. Phân tích CV/JD qua giao diện thật

| Ca | CV/JD (ký tự) | HTTP | Kết quả |
| --- | --- | --- | --- |
| Tiếng Việt, ngắn | 685 / 415 | 200 | Hiển thị và lưu analysis qua UI |
| Tiếng Anh, ngắn | 685 / 415 | 200 | Hiển thị và lưu analysis qua UI |
| Tiếng Việt, dài | 12.526 / 1.109 | 200 | Hiển thị và lưu analysis qua UI |
| Tiếng Anh, dài | 12.526 / 1.109 | 429 | `RATE_LIMIT`; không ghi nhận là thành công |

Sau thời gian nghỉ, Chat tiếng Anh dùng chính analysis dài đã lưu từ ca tiếng Việt; ngôn ngữ phỏng vấn được đặt độc lập là English. Không ghi nhận rằng ca Analysis tiếng Anh dài đã được chạy lại thành công.

## 5. Đo tốc độ Chat

Mốc làm việc giữ nguyên: ít nhất 20 yêu cầu sinh mới; ≥90% hiện chữ thật trong hai giây **và cuối cùng lưu hợp lệ**; ≥95% hoàn tất hợp lệ và lưu trong năm giây. Đây là tiêu chí nội bộ của nhóm, chưa phải SLA hay xác nhận của giảng viên.

Đồng hồ bắt đầu từ mở trang Chat hoặc ngay trước bấm Send. Đo chữ câu hỏi xuất hiện trong viewport sau hai khung hình, không tính spinner/header/nhãn preview. Hoàn tất khi UI đã nhận complete, bỏ preview và mở lại ô trả lời; sau đó đối soát câu hỏi mới qua GET session API thật.

| Chỉ số | 20 yêu cầu sinh mới | Đánh giá |
| --- | --- | --- |
| Hợp lệ và lưu được | **19/20 = 95%** | Một lượt lỗi Gemini |
| Hiện chữ ≤2 giây và lưu hợp lệ | **16/20 = 80%** | Chưa đạt mục tiêu 90% |
| Hoàn tất và lưu ≤5 giây | **19/20 = 95%** | Đạt tỷ lệ trong mẫu này |
| Chữ đầu p50 / p95 | **1.566 / 2.996 ms** | Chỉ trên 19 lượt thành công có số đo hợp lệ |
| Hoàn tất p50 / p95 | **1.943 / 3.351 ms** | Chỉ trên 19 lượt thành công |
| Phản hồi trạng thái UI ≤200 ms | Chưa đo riêng | Chưa được coi là đạt |

Ba lượt mở đầu thành công vượt hai giây: khoảng **2,996 s**, **2,170 s** và **2,119 s**. Cold load được giữ trong mẫu.

Tổng cộng thực tế có **21 HTTP request next**: 20 yêu cầu mới và một lần thử lại cùng anchor sau lỗi. Nếu tính cả lượt thử lại: 20/21 hợp lệ, 16/21 nhanh và hợp lệ, 20/21 hoàn tất trong năm giây. Lượt lỗi gốc vẫn giữ nguyên là lỗi; không được thay bằng kết quả retry.

Rà soát phép đo phát hiện lượt số 15 (mở lại phiên) nhận nhầm câu hỏi cũ đang được render thành chữ đầu của câu mới. Giá trị gốc được giữ trong JSON với nhãn số đo không hợp lệ và **không được tính là ca nhanh**, không đưa vào p50/p95 chữ đầu. Thời gian hoàn tất của lượt đó được xác nhận độc lập; lượt này là retry nên không nằm trong mẫu 20 yêu cầu mới.

## 6. Lỗi và chất lượng câu hỏi

**Giới hạn Gemini:** lượt Chat số 14 nhận error trong SSE dù HTTP của stream là 200; UI hiển thị thông báo AI quá tải/hết lượt. Backend ghi `AI_RATE_LIMITED`. Lượt Analysis dài tiếng Anh kế tiếp nhận 429. Khi kiểm tra, usage của tài khoản A là **18/100**, nên chưa chạm hạn mức ngày do ứng dụng đặt.

Sau khoảng nghỉ trên 235 giây, retry có chủ đích và các lượt tiếp theo thành công. Không đổi key/model, không tăng quota và không xóa lượt lỗi khỏi mẫu. Lần chạy này không quan sát timeout 30 giây; điều đó không chứng minh timeout đã được loại bỏ.

**Câu trả lời mơ hồ:** bốn ca chính dùng “Dạ có.”/“Yes.” ở câu trả lời đầu đều nhận `follow_up` được lưu (**4/4**). Đây là bốn ví dụ cụ thể, chưa phải bảo đảm cho mọi chủ đề/cách trả lời mơ hồ.

**Câu gần trùng ý vẫn xuất hiện:** en-short lượt 3 và 4 đều hỏi cách triển khai form validation và authentication-aware routing trong React/TypeScript. Hai chuỗi không trùng nguyên văn nhưng gần trùng về nội dung. Cần tiếp tục xử lý/đánh giá trùng ngữ nghĩa trước khi kết luận chất lượng hoàn thiện.

Các ca lỗi chậm có chủ đích, hủy trên cloud, lỗi policy và feedback từng câu UC-08 chưa được nghiệm thu trong lần chạy này. Không suy từ kết quả local/HTTP giả lập trước đó thành xác nhận cloud.

## 7. Đối soát dữ liệu và ảnh

GET lại năm phiên test trả 200, trạng thái `completed`; tổng **20 câu hỏi và 15 câu trả lời**, ID câu hỏi không trùng. Bốn phiên chính đã reload/resume mà không gọi thêm AI và kết thúc qua UI; phiên bổ sung cũng được kết thúc qua UI. Không có lỗi JavaScript được ghi nhận trong bộ chạy chính và continuation; đây không phải đánh giá mọi trang của ứng dụng.

Giữ lại **5 phiên và 3 analysis** mới để nhóm xem; các seed fixtures cũ được giữ nguyên. Bản JSON công khai dùng nhãn thay cho ID database thật. Bản gốc và đối chiếu ID được giữ riêng ở máy người chạy; chỉ dùng bản riêng đó khi cần dọn đúng dữ liệu test, không reset project dùng chung.

Ảnh chụp trực tiếp từ Chat thật đã được kiểm tra bằng mắt và giữ ở máy người chạy. Ảnh có thông tin tài khoản test nên không đưa vào commit/PR; thư mục ảnh riêng đã được Git bỏ qua.

## 8. Bằng chứng và bước còn lại

- [JSON đủ 21 lượt, audit phép đo, analysis và dữ liệu đã lưu](results/scrum94-real-chat-supabase-20261106.json).
- [Log 19/19 API thật](results/scrum94-real-session-api-20261106.log).
- Cấu hình local được Git bỏ qua; không xuất key, password, token, cookie, storage state hoặc ID database thật vào bản công khai.
- Không sửa code ứng dụng, migration hoặc policy để chạy bộ test. Chưa chạy production build trong lần kiểm thử này. Việc commit/PR/comment được thực hiện riêng sau khi kiểm tra bản công khai.

Để nghiệm thu tiếp cần cải thiện tỷ lệ hai giây, xử lý câu hỏi gần trùng ý, đo phản hồi UI 200 ms và chạy các cổng lỗi/hủy/feedback trên luồng thật sau khi nhóm hoàn thiện Setup và chốt UC-08. Khi kiểm tra lại cần giữ các lượt lỗi trong thống kê và ghi rõ quota provider ở thời điểm chạy.
