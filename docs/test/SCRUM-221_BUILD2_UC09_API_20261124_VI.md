# Build 2 – Kết quả chạy test case UC-09 (View interview report)

Người chạy: Nguyễn Trần Trung Nhân · Jira: SCRUM-221 · Ngày: 24/11/2026
Test case: `InterviewBuddy_Test_Cases_Build_2.xlsx` (Drive, thư mục Build 2), dòng UC09-01 … UC09-07.

## Cách chạy

```bash
# server thứ hai, cùng Supabase, AI bị chặn (UC09-05)
GEMINI_TIMEOUT_MS=1 npx next dev -p 3005
API_BASE_URL=https://interviewbuddy-main.vercel.app AI_DOWN_BASE_URL=http://localhost:3005 npm run test:uc09-build2
```

- Chạy trên staging `https://interviewbuddy-main.vercel.app` (main `a9308d0`).
- Dùng 2 tài khoản seed `candidate.a@interviewbuddy.test` và `candidate.b@interviewbuddy.test`, vì các tài khoản `candidate_*@test.com` trong bộ dữ liệu test chưa được tạo và `seed_data.sql` chưa chạy.
- Script tự tạo dữ liệu S0, S1, S2, S4, S5, S7, R-B đúng như mô tả trong sheet "Test data", rồi xóa sau khi chạy.
- UC09-04: `candidate.b` đóng vai `candidate_first`; S4 được đặt thời gian trước các phiên khác của B nên không có báo cáo trước đó.

## Kết quả

| Case | API | Giao diện | Trạng thái ghi vào sheet |
| --- | --- | --- | --- |
| UC09-01 | Đạt (lần 2, 8,8 s). Lần 1 lỗi: tóm tắt AI hết giờ sau 33,9 s | Chưa kiểm | Blocked |
| UC09-02 | Đạt: STAR = null, tốc độ nói không có | Chưa kiểm | Blocked |
| UC09-03 | Đạt: tóm tắt giống hệt, bộ đếm AI không đổi | Chưa kiểm | Blocked |
| UC09-04 | Đạt: trend = null, câu cuối không có điểm | Chưa kiểm | Blocked |
| UC09-05 | Đạt: báo cáo vẫn trả về, Try again tạo lại tóm tắt | Chưa kiểm | Blocked |
| UC09-06 | Đạt: 404 giống hệt cho báo cáo người khác và id ngẫu nhiên | Chưa kiểm | Blocked |
| UC09-07 | Đạt: 409 NO_SCORED_ANSWERS, không lưu báo cáo, không gọi AI | Chưa kiểm | Blocked |

Chi tiết: [SCRUM-221_BUILD2_UC09_results_20261124.json](results/SCRUM-221_BUILD2_UC09_results_20261124.json).

**Vì sao Blocked:** trang `/reports/[sessionId]` vẫn hiển thị dữ liệu mẫu (chưa nối `GET /api/report`, subtask 1 tuần 8 của Tài). Các kết quả mong đợi về giao diện (biểu đồ, thẻ tổng quan, nút, thông báo) chưa kiểm được. Khi trang được nối, chạy lại script và kiểm phần giao diện trên trình duyệt.

## Lỗi tìm thấy

- **UC09-01, lần chạy 1:** Gemini chậm, tóm tắt hết giờ sau 30 s, cả báo cáo mất 33,9 s, vượt yêu cầu "trong 30 giây". Đã sửa (SCRUM-222): tóm tắt chỉ được chờ tối đa 20 s; quá thời gian thì báo cáo vẫn trả về với tóm tắt "unavailable" và nút Try again.
- **Ghi chú cho sheet:** `GEMINI_TIMEOUT_MS=1` không gây time-out mà gây lỗi cấu hình (`AI_CONFIGURATION_ERROR`, giá trị dưới 1000 ms bị từ chối). Kết quả vẫn đúng cho UC09-05 (tóm tắt "unavailable"), chỉ khác mã lỗi.
