# Kiểm tra thật đầy đủ các ca còn thiếu — 07/11/2026

## Kết luận

Đã đối chiếu `New-Text-Document.txt`: file cung cấp URL Supabase, anon key và mật khẩu test, đều trùng cấu hình local đang dùng. Không cần thay key hoặc cấu hình. File không cung cấp quyền quản trị database để triển khai migration.

Đã tiếp tục các ca tiếng Anh/hồ sơ dài trên cùng bản ghép **`53a955c`**, cộng với dữ liệu đợt đầu thành **20 yêu cầu sinh mới và 1 retry thủ công**. Cả 4 analysis lưu thành công; 4 phiên đã kết thúc, Supabase giữ **19 câu hỏi và 16 câu trả lời**. Kiểm tra chức năng ghi nhận **22/22 đạt**.

**SCRUM-94 chưa đạt nghiệm thu tốc độ:** 18/20 yêu cầu mới hợp lệ/lưu được, chỉ 1/20 hiện chữ trong hai giây và 13/20 hoàn tất/lưu trong năm giây. Hai lỗi `AI_UNAVAILABLE` của đợt đầu được giữ nguyên; không thay chúng bằng retry hoặc bỏ khỏi mẫu.

## 1. Nguồn và phạm vi kiểm tra

- Repo/nhánh: `TrungNhan8386/InterviewBuddy`, `feat/scrum-94-chat-streaming-hung`, commit `53a955c`.
- Next.js dev trên Windows, Edge headless; app dùng Supabase Auth/database/RLS và Gemini thật. Model cấu hình: `gemini-3.5-flash-lite`.
- Mock Analysis/Chat đều tắt. Observer chỉ ghi thời gian và DOM, không thay HTTP response.
- CV/JD và câu trả lời đều là dữ liệu tổng hợp, không phải hồ sơ cá nhân của thành viên/ứng viên.
- Đợt đầu có 6 request Chat (5 mới + 1 retry). Sau khi người dùng gửi lại file cấu hình, chạy tiếp 15 request mới của ba ca còn thiếu; không retry thêm. Các đợt dùng cùng code/model/config nhưng không phải một thử nghiệm tải liên tục.
- Giãn nhịp tối thiểu 8 giây giữa thời điểm bắt đầu gọi AI; thời gian giãn nhịp nằm trước thao tác đo. Không đổi model/key để tránh lỗi hoặc vượt quota.

## 2. Các ca đã chạy

| Ca | CV/JD (ký tự) | Analysis | Chat mới hợp lệ | Retry thêm | Question thực lưu |
| --- | --- | --- | --- | --- | --- |
| vi-short | 685 / 415 | 200, lưu được | 3/5 | 1 thành công | 4 |
| en-short | 685 / 415 | 200, lưu được | 5/5 | 0 | 5 |
| vi-long | 12.526 / 1.109 | 200, lưu được | 5/5 | 0 | 5 |
| en-long | 12.526 / 1.109 | 200, lưu được | 5/5 | 0 | 5 |

Ba ca chạy tiếp đều đi từ trang Analysis → form Setup → trang Chat thật, gửi câu trả lời, tải lại phiên khi đang chờ trả lời, rồi kết thúc qua UI. Phiên vi-short đã được kết thúc qua API sau lỗi, sau đó UI xác nhận trạng thái kết thúc mà không gọi thêm AI.

Đọc lại trực tiếp bằng tài khoản A xác nhận cả bốn session đều `completed`, không trùng question ID, mỗi phiên có 4 answer. Không xóa dữ liệu seed hoặc dữ liệu của người khác; giữ các dữ liệu mới để nhóm đối soát. Ngôn ngữ profile đã khôi phục về `vi`.

## 3. Kiểm tra chức năng

- Tài khoản A đăng nhập được; Settings lưu English, Setup nhận đúng ngôn ngữ mặc định và khôi phục được về giá trị ban đầu.
- Setup tạo đúng phiên thật, gắn analysis của user và mở Chat streaming.
- Answer được lưu trước khi dùng ID của nó xin câu hỏi tiếp theo. Sau lỗi provider, answer đã lưu vẫn được giữ.
- Các câu trả lời “Dạ có.”/“Yes.” của bốn ca đều được lưu đúng dữ liệu tổng hợp; câu tiếp theo là `follow_up` trong cả 4 ca.
- Reload khi đang chờ trả lời giữ nguyên câu hỏi, không phát thêm generation trong ba ca chạy tiếp.
- Dashboard có link phiên thật. Kết thúc được lưu, UI mở lại phiên đã kết thúc không gọi AI.
- Tài khoản B không đọc được cả bốn session của A qua API (404); màn hình phiên không thuộc tài khoản hiển thị thông báo NOT_FOUND dễ hiểu. Đã kiểm tra ảnh của thông báo.

22 check được ghi nhận đạt, nhưng đây không phải đánh giá mọi nhánh lỗi/voice/feedback hoặc kết luận chuyên môn về chất lượng câu hỏi. Không có câu trùng nguyên văn trong các phiên được đối soát; chưa thực hiện đánh giá trùng ngữ nghĩa đầy đủ.

Điểm fit của cùng mẫu ngắn là 87,5 (vi) và 90 (en); mẫu dài là 94,74 (vi) và 83,33 (en). Các request đều hợp lệ và lưu được, nhưng độ nhất quán điểm giữa các ngôn ngữ cần được đánh giá riêng. Không dùng trạng thái HTTP 200 làm bằng chứng điểm AI luôn chính xác.

## 4. Tốc độ: đủ mẫu tối thiểu nhưng chưa đạt mục tiêu

Mở đầu đo từ bấm Start, gồm tạo phiên và chuyển trang. Các lượt sau đo từ Send, gồm lưu answer. Chữ đầu là nội dung câu hỏi thấy được sau hai khung hình; spinner/nhãn busy không được tính. Hoàn tất cần kết quả được kiểm tra và lưu, được UI xác nhận và đối soát qua API.

| Chỉ số trên 20 yêu cầu mới | Kết quả | Mốc làm việc | Đánh giá |
| --- | --- | --- | --- |
| Hợp lệ/lưu thành công | 18/20 = 90% | Ghi nhận cả lỗi | 2 lỗi provider |
| Hiện chữ ≤2 giây và cuối cùng hợp lệ/lưu | **1/20 = 5%** | ≥90% | Chưa đạt |
| Hoàn tất hợp lệ/lưu ≤5 giây | **13/20 = 65%** | ≥95% | Chưa đạt |
| UI có phản hồi busy/khóa input ≤200 ms | 20/20 quan sát đạt | ≤200 ms | Đạt trong mẫu |
| Chữ đầu p50 / p95 | 3.882 / 10.116 ms | Chỉ 18 ca thành công có số đo | Không bao gồm lỗi không có chữ đầu |
| Hoàn tất p50 / p95 | 4.182 / 10.477 ms | Chỉ 18 ca thành công | Không phải SLA production |

Tính cả retry có 21 HTTP next, 19 câu hỏi được lưu, 2 lỗi, 1 lượt nhanh/hợp lệ và 14 lượt hoàn tất/lưu trong năm giây. Các tỷ lệ nghiệm thu phía trên dùng đúng 20 yêu cầu mới; retry không thay lượt lỗi gốc.

Backend trace ghi nhận trung vị chuẩn bị context khoảng **130 ms**, lưu kết quả khoảng **113 ms** và chờ provider tới chữ đầu khoảng **3.039 ms** trong các nhóm tương ứng. Điều này cho thấy giai đoạn chờ sinh nội dung AI cần được ưu tiên kiểm tra. Các trung vị từng mốc không được cộng trực tiếp thành một tổng thời gian hoặc dùng để khẳng định nguyên nhân mọi request chậm.

Hai lỗi `AI_UNAVAILABLE` xảy ra sau khi xác thực/claim/context đã chạy. Không kết luận chính xác điều kiện dịch vụ hoặc transport phía Gemini từ mã lỗi chung này. Các lượt sau chạy thành công không xóa bằng chứng lỗi trước đó.

Hạn mức của tài khoản test là **25/100** sau toàn bộ đợt: 4 analysis + 21 next. Chưa chạm hạn mức ngày của app; hạn mức app và quota/provider availability là hai cơ chế riêng.

## 5. Migration và quyền truy cập

Không áp dụng migration `20261107000000_settings_data.sql` trong đợt này, không gọi purge/xóa CV hoặc lịch sử. File người dùng gửi chỉ đủ cho đăng nhập và API của app; không chứa kết nối quản trị SQL. Cấu hình local tiếp tục được Git bỏ qua.

Probe answer bridge bằng input rỗng trả 404/PGRST202; schema discovery trả 401 nên chưa xác nhận definition/lịch sử migration cloud. Chat hiện dùng persistence API/migration 20261105, vì vậy các ca Chat thật vẫn chạy được. Nhân/admin cần đối chiếu đúng project và migration history trước khi triển khai phần Settings còn thiếu.

## 6. Bằng chứng và giới hạn

- [JSON đầy đủ hai đợt, 21 attempt, trace và đối soát dữ liệu](results/scrum94-live-recheck-20261107.json).
- [Báo cáo đợt đầu 6 request](SCRUM-94_MERGED_LIVE_CHECK_20261107_VI.md) giữ nguyên kết quả lịch sử.
- Bản công khai dùng nhãn thay ID database thật. Key, password, token, cookie, storage state, ảnh tài khoản và đối chiếu ID giữ riêng ở máy chạy.
- Không thay đổi runtime/config/model, không chạy production build, không kiểm tra lại PDF extraction hoặc thao tác xóa dữ liệu thật trong đợt này.
- Không commit/push hoặc cập nhật Jira trong bước nhận thông tin và kiểm thử tiếp. SCRUM-94 chưa được coi là Done.
