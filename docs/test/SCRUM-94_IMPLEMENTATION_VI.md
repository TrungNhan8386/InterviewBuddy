# SCRUM-94 — triển khai streaming và kiểm chứng

Cập nhật ngày 06/11/2026: xem [bản cải thiện và kiểm thử bổ sung](SCRUM-94_IMPROVEMENTS_20261106_VI.md) cho xử lý STOP không đợi EOF, thông báo 5/10 giây, browser deadline và timing diagnostics. Kết quả ngày 05/11 bên dưới được giữ làm lịch sử, không ghi đè bằng phép đo mới.

Ngày kiểm tra: 05/11/2026. Nhánh local: `feat/scrum-94-interview-streaming`, dựa trên SCRUM-93 `baa2f8e`. Chưa commit/push hoặc thay đổi Jira trong lần triển khai này.

**Kết luận hiện tại:** đã triển khai luồng streaming và kiểm thử parser/API/database/browser. Tiêu chí chữ đầu trong hai giây **chưa đạt ổn định** khi gọi Gemini thật; chưa nghiệm thu toàn bộ SCRUM-94 hoặc luồng production với Supabase chung.

Đã ghi nhận thêm [các mốc làm việc và cách nghiệm thu v1](SCRUM-94_ACCEPTANCE_TARGETS_VI.md) theo yêu cầu người dùng: 90% request có chữ đầu ≤ 2 giây và kết quả cuối hợp lệ; 95% hoàn tất hợp lệ, lưu thành công ≤ 5 giây. Đây là tiêu chí để nhóm review, giữ nguyên yêu cầu gốc trên Jira; dữ liệu hiện có vẫn chưa đạt.

## 1. Yêu cầu và phần đã làm

Jira yêu cầu truyền chữ dần lên trình duyệt để các từ đầu xuất hiện trong hai giây, đồng thời kiểm tra phần dữ liệu có cấu trúc của mọi phản hồi. Không thêm tiêu chí giả định như “spinner xuất hiện là đạt” hoặc “chỉ tính lần nhanh nhất”.

| Phần | Nội dung triển khai |
| --- | --- |
| Provider | Nhận Gemini SSE thật qua `streamGenerateContent`, ghép UTF-8/frame/JSON; chỉ trích chữ ở trường question cấp đầu. |
| HTTP | Cùng endpoint `/api/interview/next`, opt-in bằng Accept: text/event-stream; giữ chế độ JSON cho caller cũ. |
| Service/database | Giữ claim/replay/ownership; chỉ lưu khi phản hồi cuối hợp lệ; hủy stream giải phóng lượt chưa commit. |
| Browser consumer | Nhận draft dần, kiểm tra các event và kết quả công khai, xóa draft khi lỗi/hủy/end, trả kết quả đã lưu qua Promise. |
| Trang kiểm chứng | Trang cục bộ dùng consumer, HTTP handler, service và provider thật; xác thực giả lập và PGlite cục bộ. Không thay trang Chat của Khang. |

Hợp đồng event, lỗi và ví dụ tích hợp nằm tại [INTERVIEW_STREAM_API_v1.md](../api/INTERVIEW_STREAM_API_v1.md).

## 2. Các skill đã áp dụng

| Skill | Áp dụng cụ thể |
| --- | --- |
| `gemini-api-dev` | Đối chiếu tài liệu Google trước khi viết code; giữ REST/model hiện có, khóa ở server và structured output; không thêm retry trả phí ngầm. |
| `test-driven-development` | Viết test trước, chạy và ghi nhận fail rồi mới thêm implementation. Kỳ vọng được đặt bằng literal/fixture độc lập. |
| `systematic-debugging` | Theo dõi các tầng wire → provider → API → browser. Trace thực tế tìm được lỗi 503 nằm trong stream dù HTTP ban đầu là 200; thêm hồi quy trước khi sửa mapping. |
| `webapp-testing` | Playwright Python + Edge headless; chờ trang sẵn sàng, kiểm tra DOM, chụp ảnh, kiểm tra lỗi và đo chữ thật sau hai khung hình. |
| `verification-before-completion` | Chạy lại toàn bộ test, lint, TypeScript, build và scan trước khi đưa ra kết luận; báo riêng tiêu chí hai giây chưa đạt. |
| `supabase-postgres-best-practices` | Giữ transaction ngắn và cơ chế ownership/claim/finish; không giữ khóa database trong lúc stream và không thêm migration. |

Không dùng `security-best-practices` vì task không yêu cầu một cuộc đánh giá bảo mật riêng. Không thêm AI SDK hay dependency ứng dụng chỉ để làm streaming. Playwright được cài trong môi trường Python kiểm thử riêng.

## 3. Bằng chứng TDD và kiểm thử tự động

Có 32 test mới so với 169 test của SCRUM-93:

| Nhóm | Red đã quan sát | Green sau triển khai |
| --- | --- | --- |
| Provider, 9 ca ban đầu | Chưa có stream API | Trả chữ trước STOP; giữ tiếng Việt/emoji/escape; lọc reason/thought; lỗi schema, safety, hủy, rate limit và end. |
| HTTP/service, 8 ca | Chưa có stream service | Draft trước commit; replay không gọi thêm; lỗi không lưu; auth/busy đúng status; hủy; end; hết giờ; mất acknowledgement sau commit. |
| Browser consumer, 11 ca | Chưa có consumer | Chữ xuất hiện trước complete; tách frame/UTF-8; xóa draft khi lỗi/hủy/truncated/end; kiểm tra session và trường công khai; replay. |
| Hai hồi quy provider | Network bị gắn INVALID_OUTPUT; draft quá dài vẫn được gửi | Phân loại AI_UNAVAILABLE đúng; chặn question vượt 1200 trước khi forward. |
| Hai hồi quy từ Gemini thật | In-band 503/429 bị gắn INVALID_OUTPUT | Nhận đúng AI_UNAVAILABLE/AI_RATE_LIMITED, không chuyển tiếp thông báo riêng của upstream. |

Các transcript red/green được giữ ở thư mục `tmp/scrum94-*` cục bộ. Source test được lưu trong repo. Toàn bộ suite hiện có 201 test; kết quả chạy cuối được ghi tại [scrum94-verification.json](results/scrum94-verification.json).

## 4. Browser test có kiểm soát

[Kết quả đầy đủ](results/scrum94-browser-controlled.json): 8 tình huống đạt trên server mới có instance ID riêng:

1. Slow success: chữ thật xuất hiện khoảng 152 ms; complete khoảng 2558 ms. Khi chụp draft, trạng thái vẫn đang tạo và database có 0 câu hỏi mới; sau complete có đúng 1 câu.
2. Replay: nhận đúng ID đã lưu, không tăng số request upstream và không tạo thêm row.
3. Tiếng Việt, dấu ngoặc kép, emoji được giữ đúng qua các gói byte nhỏ.
4. JSON thêm score không hợp lệ: xóa draft, 0 câu được lưu và reservation chuyển failed.
5. Stream bị cắt: xóa draft, báo lỗi và 0 câu được lưu.
6. Hủy sau khi đã thấy chữ: dừng reader upstream, xóa draft và giải phóng reservation.
7. Phiên đã đóng: complete/end, không gọi upstream.
8. Busy turn: nhận GENERATION_IN_PROGRESS, không gọi upstream.

Đây là phản hồi Gemini mô phỏng có kiểm soát để kiểm tra thứ tự và lỗi, không phải số đo tốc độ model thật. Ảnh được lưu ở `output/interview-stream/controlled-*.png`.

## 5. Browser test với Gemini thật

Nguồn đầu vào là CV/JD/câu trả lời tổng hợp do trợ lý tạo; không có hồ sơ ứng viên thật. Cùng browser consumer, provider và HTTP/service/repository được dùng, nhưng Auth là giả lập và DB là PGlite. Không đưa kết quả này thành bằng chứng đăng nhập/Supabase production đã đạt.

[Lần chạy 5 ca sau sửa lỗi](results/scrum94-browser-live.json):

| Ca | Chữ đầu trên màn hình | Hoàn tất | Kết quả |
| --- | --- | --- | --- |
| Mở đầu tiếng Anh | 3804 ms | 3963 ms | Lưu thành công, replay cùng ID; vượt hai giây. |
| Mở đầu tiếng Việt | 1546 ms | 1683 ms | Lưu thành công, replay không gọi thêm. |
| Hỏi tiếp kỹ thuật tiếng Anh | 1288 ms | 1394 ms | Lưu thành công, replay không gọi thêm. |
| Hỏi tiếp Behavioral tiếng Việt | 1330 ms | 1488 ms | Lưu thành công, replay không gọi thêm. |
| Lịch sử dài | 1767 ms, chỉ là draft | 1807 ms, lỗi | AI_UNAVAILABLE; draft bị xóa, 0 câu mới được lưu. Không tính là ca đạt hai giây. |

Tóm lại: 4/5 request có kết quả hợp lệ và lưu thành công; 3/5 request tạo câu hợp lệ với chữ đầu dưới hai giây (3/4 trong nhóm thành công). Không bỏ ca chậm đầu tiên. Không tính phần text của ca lỗi là kết quả đạt. Chưa có bằng chứng đủ để cam kết SLA hai giây.

Lần đầu gặp INVALID_OUTPUT được giữ ở `scrum94-browser-live-initial.json`. Trace chẩn đoán ở local `tmp/scrum94-traces/` xác nhận Gemini gửi lỗi 503 “UNAVAILABLE” sau HTTP 200. Mã xử lý đã được sửa và test hồi quy đạt; bản thân tình trạng quá tải vẫn là yếu tố bên ngoài ứng dụng.

Tổng cộng có 8 request Gemini thật trong các bước thử hiện tại: 1 ban đầu, 1 ca chẩn đoán vô tình vào server cũ, 1 ca trace trên server mới và 5 ca đo cuối. Không có retry tự động; các request replay không gọi Gemini. Lượt chạy vào server cũ bị loại khỏi benchmark.

## 6. Điều chỉnh môi trường kiểm thử trên Windows

Đã dùng helper `with_server.py` của skill theo dạng black box trước. Kiểm tra PID/cổng sau đó cho thấy helper dùng shell và chỉ dừng shell cha, để Node con còn chạy. Điều này làm một lần thử nối nhầm server cũ; số liệu đó không được dùng làm benchmark cuối.

Đã dừng đúng các tiến trình thử nghiệm và thêm runner cục bộ `tests/browser/run_interview_stream.py`: chạy Node trực tiếp, từ chối cổng đang dùng, cấp instance ID riêng, kiểm tra ID trước khi test và xác nhận cổng đã đóng sau cleanup. Không chỉnh sửa skill cá nhân/toàn máy.

## 7. Chạy lại và bàn giao

Trong `D:/BackUp/HCMUS_Semester_7/introSE/project/main/src`:

```powershell
npm test
npm run typecheck
npm run build
python -m venv ../tmp/scrum94-venv
../tmp/scrum94-venv/Scripts/python.exe -m pip install -r tests/browser/requirements.txt
../tmp/scrum94-venv/Scripts/python.exe -X utf8 tests/browser/run_interview_stream.py --port 4174
```

Đã kiểm thử bằng Python 3.11, Playwright 1.64.1 và Edge headless 156 trên Windows. Nếu `python` trỏ tới Windows Store alias, dùng đường dẫn Python đã cài. Runner dùng profile browser tạm, không mở profile cá nhân.

Lệnh sau dùng quota và yêu cầu GEMINI_API_KEY trong `.env.local`; chỉ gửi fixtures giả lập:

```powershell
../tmp/scrum94-venv/Scripts/python.exe -X utf8 tests/browser/run_interview_stream.py --live --port 4175
```

Có thể dùng `--case live-en-opening` để chọn đúng một ca. `--trace` chỉ phục vụ chẩn đoán cục bộ: không ghi header/khóa và loại thought khỏi trace. Không dùng trace để đo benchmark.

Handoff cho Khang: dùng `requestInterviewNext` và onPreview để cập nhật text; chỉ mở phần trả lời khi Promise trả complete hợp lệ. Handoff cho Nhân: request body và RPC/migration giữ nguyên, cần áp dụng phần SCRUM-92 và kiểm tra Auth/Supabase chung. Tiêu chí first-visible-text phải được đo lại trên luồng Chat và môi trường triển khai thực tế trước nghiệm thu.
