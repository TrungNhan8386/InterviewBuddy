# InterviewBuddy – Kịch bản demo Build 1 (Release 1.0)

Jira: SCRUM-117 · Người viết: Trần Phước Tài · Thời lượng: 5 phút · Phạm vi: F1–F4 (đăng nhập, phân tích CV/JD, cấu hình phỏng vấn, phỏng vấn chat có follow-up)

Lưu ý: Build 1 chưa có voice, chấm điểm theo tiêu chí, báo cáo và luyện tập mục tiêu. Không demo các phần này. Nếu hỏi, nói rõ là sẽ có ở Build 2 (29/11).

## Chuẩn bị trước demo (làm trước 15 phút)

- Mở staging, đăng nhập bằng tài khoản demo đã có hồ sơ và đã phân tích CV/JD. Nếu chưa có, chạy phân tích trước để không phải chờ AI trong lúc demo.
- Chuẩn bị sẵn file `cv_valid.pdf` và đoạn JD trong `docs/test/test_use_cases/InterviewBuddy_Test_Data.zip` (thư mục `jd/`, `cv/`).
- Chuẩn bị sẵn 2–3 câu trả lời trong `interview/answer_bank.txt` để dán nhanh khi cần.
- Đóng các tab và thông báo không liên quan. Kiểm tra mạng và micro (không cần dùng micro ở Build 1).
- Dự phòng: nếu AI chậm hoặc lỗi, chuyển sang tài khoản đã có sẵn một phiên phỏng vấn để cho xem màn chat.

## Kịch bản

| Thời gian | Màn hình | Người nói | Hành động | Điểm cần nhấn mạnh |
|---|---|---|---|---|
| 0:00–0:20 | Trang chủ / đăng nhập | Tài | Giới thiệu InterviewBuddy trong một câu. Đăng nhập bằng email hoặc Google. | Đăng nhập xong vào được Dashboard, phiên được giữ sau khi tải lại trang (F1). |
| 0:20–1:20 | Dashboard, sidebar | Tài | Chỉ sidebar và topbar. Mở trang hồ sơ, cho xem ngành học, vị trí mục tiêu, cấp độ kinh nghiệm, ngôn ngữ. | Hồ sơ là giá trị mặc định cho các bước sau (UC03). |
| 1:20–2:20 | Phân tích CV/JD | Khang hoặc Tài | Dán JD, tải `cv_valid.pdf`, bấm Analyze. Khi có kết quả, chỉ điểm phù hợp, kỹ năng còn thiếu và bảng yêu cầu. | CV chỉ được đọc để lấy chữ, không lưu lại file. Kết quả dùng cho phỏng vấn sắp tới (F2). |
| 2:20–3:00 | Thiết lập phỏng vấn | Tài | Mở "New Interview", chọn loại (kỹ thuật), độ khó, thời lượng, chế độ nhập chữ. Chỉ phần Session Preview cập nhật theo lựa chọn. Bấm bắt đầu. | Cấu hình ảnh hưởng đến phiên thật, không chỉ là giao diện (F3). |
| 3:00–4:20 | Màn chat phỏng vấn | Tài | Trả lời một câu bằng chữ. Cho xem AI hỏi câu follow-up dựa trên câu trả lời trước. Chỉ thanh tiến độ "Câu n / N" và đồng hồ. | AI hỏi một câu một lần và có thể hỏi sâu thêm, không lặp lại câu cũ (F4). |
| 4:20–4:50 | Kết thúc phiên | Tài | Bấm End Interview, xác nhận. | Có hộp xác nhận, không mất câu trả lời đã gửi. |
| 4:50–5:00 | Tổng kết | Nguyên hoặc Tài | Nêu những gì đã làm được và nói Build 2 sẽ có chấm điểm, voice và báo cáo. | Không hứa các tính năng chưa có. |

## Nếu gặp sự cố

- **AI chậm hoặc lỗi:** nói "AI đang bận, đây là lý do hệ thống có nút Thử lại" rồi bấm Thử lại. Nếu vẫn lỗi, chuyển sang phiên đã có sẵn.
- **Không tìm thấy nút hoặc màn hình khác với kịch bản:** bỏ qua bước đó, không sửa giữa demo. Ghi lại để báo nhóm.
- **Câu hỏi về điểm số, voice, báo cáo:** trả lời là chưa có ở Build 1, sẽ có ở Build 2.

## Việc sau demo

- Ghi lại mọi chỗ khác với kịch bản vào Jira, gắn với SCRUM-113 hoặc SCRUM-115.
- Kiểm tra lại kịch bản khi nhóm tập tối nay và cập nhật thời gian từng phần.

Ghi chú: tên nút và nhãn màn hình trong kịch bản lấy từ tài liệu test case. Trước khi tập, cần đối chiếu với giao diện staging thật.
