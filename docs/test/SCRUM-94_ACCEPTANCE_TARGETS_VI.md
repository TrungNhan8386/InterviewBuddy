# SCRUM-94 — mốc tốc độ và cách nghiệm thu v1

Ngày ghi nhận: 05/11/2026. Các mốc làm việc dưới đây được đặt theo yêu cầu người dùng để nhóm có tiêu chí đo rõ ràng. Đây là cách cụ thể hóa để review; chưa phải xác nhận nghiệm thu hoặc chấp thuận của nhóm/giảng viên.

Đã lưu các mốc bằng tiếng Anh vào mô tả [SCRUM-94 trên Jira](https://nhom3-24c01-se.atlassian.net/jira/software/projects/SCRUM/boards/1?selectedIssue=SCRUM-94) ngày 05/11/2026. Tiêu đề và trạng thái task giữ nguyên. Ảnh xác nhận: `output/scrum94-targets/jira-targets-saved.jpg`. Các tài liệu cục bộ chưa được commit/push.

Yêu cầu gốc trên Jira vẫn giữ nguyên: chữ đầu tiên xuất hiện trong hai giây và phần dữ liệu có cấu trúc của mọi phản hồi phải được kiểm tra. Việc bổ sung tỷ lệ đạt không tự thay đổi yêu cầu gốc; nhóm cần thống nhất cách diễn giải trước khi đánh dấu Done.

## 1. Các mốc được đặt

| Chỉ số | Mốc làm việc | Cách hiểu |
| --- | --- | --- |
| Phản hồi giao diện | ≤ 200 ms sau thao tác | Hiển thị trạng thái đang xử lý, ngăn gửi trùng và cho phép hủy. Không tính đây là nội dung câu hỏi. |
| Câu hỏi bắt đầu nhanh | ≥ 90% tổng request đủ điều kiện có chữ đầu ≤ 2000 ms **và cuối cùng trả kết quả hợp lệ, lưu thành công** | Duy trì mục tiêu hai giây; ca có draft nhanh nhưng lỗi cuối vẫn không đạt. |
| Câu hỏi hoàn chỉnh | ≥ 95% tổng request đủ điều kiện hoàn tất hợp lệ và lưu thành công ≤ 5000 ms | Tính cả kiểm tra JSON/policy và lưu database, không dừng đồng hồ ở token cuối của Gemini. |
| Kiểm tra dữ liệu | 100% phản hồi hoàn chỉnh được kiểm tra trước khi lưu/xác nhận | Không nới schema, ownership, action/topic hoặc kiểm tra câu trùng để đạt tốc độ. |
| Cảnh báo phản hồi chậm | Sau 5000 ms mà chưa có kết quả cuối | Thông báo đang chậm và tiếp tục cho phép hủy; đây là hành vi giao diện cần tích hợp, chưa được coi là đã triển khai. |
| Chờ kéo dài | Sau 10000 ms mà chưa có kết quả cuối | Giải thích tình trạng, cho hủy; chỉ thử lại sau khi hủy/đối soát lượt hiện tại. Không tự gọi Gemini thêm. |
| Timeout upstream | 30000 ms mặc định hiện tại | Ngưỡng bảo vệ request, không phải thời gian chờ được xem là tốt. Không ngắt cứng ở 5 hoặc 10 giây chỉ vì đã hiện cảnh báo. |

Hai tỷ lệ 90%/95%, mục tiêu 5 giây và các mốc giao diện là lựa chọn làm việc của dự án, không phải SLA của Google hoặc yêu cầu đã được giảng viên xác nhận. Không dùng chúng để ghi lại rằng tiêu chí gốc hai giây đã đạt trong mọi trường hợp.

## 2. Định nghĩa phép đo

- Bắt đầu đồng hồ tại thao tác yêu cầu câu hỏi trên trang Chat đã đăng nhập và có phiên/answer anchor hợp lệ.
- Chữ đầu là nội dung câu hỏi thật đã hiển thị trên màn hình. Spinner, HTTP header, ready event, nhãn đang xử lý và token thinking không được tính. Browser test hiện đo sau hai requestAnimationFrame.
- Hoàn tất là khi trình duyệt nhận complete hợp lệ, có kết quả lưu được backend xác nhận và hiển thị trạng thái xác nhận.
- Request đủ điều kiện là yêu cầu sinh câu hỏi mới hợp lệ ở phiên đang mở và còn ngân sách/thời gian. Tính cả lần mở đầu, cold start, hồ sơ dài, lỗi/timeout từ Gemini và lỗi hệ thống phát sinh sau khi nhận yêu cầu hợp lệ.
- Không đưa replay/cache hit hoặc end không gọi AI vào mẫu đo tốc độ sinh mới. Request bị từ chối ngay vì chưa đăng nhập, sai body, phiên đóng hoặc busy được test riêng và phải báo riêng.
- Ca hủy thủ công có chủ đích thuộc bộ test hủy, không trộn vào mẫu latency. Nếu hủy vì chờ quá lâu trong một lượt benchmark, vẫn tính lượt đó là không đạt, không loại khỏi mẫu.
- Lỗi 429/503, JSON không hợp lệ, mất stream hoặc không xác nhận được kết quả cuối là ca không đạt cả hai chỉ số nhanh/hoàn tất. Không retry rồi thay kết quả cũ bằng lần nhanh hơn.

## 3. Bộ mẫu trước nghiệm thu

Chạy tối thiểu 20 yêu cầu sinh mới trên Chat UI và Supabase thật, bao gồm hai ngôn ngữ, câu mở đầu/hỏi tiếp, CV/JD ngắn/dài và lượt đầu sau khi khởi động. Ghi môi trường, model, thời điểm, thiết bị/browser và loại mạng. Không đưa API key hoặc hồ sơ thật vào báo cáo.

Ở mức tối thiểu 20 request, mốc làm việc tương ứng là ít nhất **18/20** ca nhanh ≤ 2 giây và **19/20** ca hoàn tất hợp lệ ≤ 5 giây. Đây là bộ kiểm tra tối thiểu để review đồ án, không chứng minh SLA production; cần thêm mẫu ở nhiều thời điểm khi muốn cam kết rộng hơn.

Báo cáo tất cả kết quả, số lỗi, tỷ lệ đúng hạn và p50/p95; nếu thống kê latency chỉ trên nhóm thành công thì phải ghi rõ mẫu số. Kiểm thử lỗi, hủy, replay, ownership và busy vẫn là cổng chức năng độc lập, không được bỏ qua vì đã đạt tỷ lệ tốc độ.

## 4. Đánh giá lại bằng dữ liệu đã có

Tại thời điểm ghi nhận 05/11/2026, chưa gọi Gemini thêm hoặc đo lại sau khi đặt mốc. Bộ năm request khi đó nằm trong [kết quả live ngày 05/11](results/scrum94-browser-live.json):

| Tiêu chí | Kết quả hiện có | Đánh giá |
| --- | --- | --- |
| Nhanh ≤ 2 giây và có kết quả cuối hợp lệ | 3/5 = 60% | Chưa đạt 90%. |
| Hoàn tất hợp lệ và lưu ≤ 5 giây | 4/5 = 80% | Chưa đạt 95%. |
| Cỡ mẫu và môi trường | 5 request; Auth giả lập, DB PGlite, trang kiểm thử | Chưa đủ 20 request và chưa phải Chat + Supabase chung. |
| Yêu cầu gốc: hai giây | Có một ca thành công nhưng chữ đầu khoảng 3,8 giây | Không ghi nhận đã đạt trọn vẹn. |

Phần streaming và kiểm tra cấu trúc đã triển khai cục bộ; các tỷ lệ tốc độ trên vẫn chưa đạt. Cảnh báo 5/10 giây là tiêu chí được ghi nhận để nối vào Chat UI, chưa phải hành vi đã được test thành công trong ứng dụng chính.

Bản máy đọc được: [scrum94-acceptance-targets-v1.json](results/scrum94-acceptance-targets-v1.json). Báo cáo triển khai: [SCRUM-94_IMPLEMENTATION_VI.md](SCRUM-94_IMPLEMENTATION_VI.md).

## 5. Cập nhật thực hiện ngày 06/11/2026

Đã thêm callback trạng thái 5/10 giây và deadline 35 giây vào browser consumer; kiểm tra được trên harness, chưa tích hợp Chat chính. Năm request Gemini mới đạt 4/5 nhanh-và-hợp-lệ (80%) và 5/5 hoàn tất/lưu ≤ 5 giây. Chưa đủ 20 mẫu, chưa đúng môi trường Chat/Supabase chung và chưa đạt tỷ lệ nhanh 90%. Giữ nguyên các mốc ở trên. Xem [bản cải thiện và bằng chứng mới](SCRUM-94_IMPROVEMENTS_20261106_VI.md); JSON v1 giữ vai trò bản ghi tại ngày đặt mốc, không ghi đè lịch sử.
