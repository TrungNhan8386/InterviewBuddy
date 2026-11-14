# Quy định làm việc của agent — InterviewBuddy

## Cập nhật code trước mỗi task

Theo yêu cầu của người dùng: trước khi thực hiện một task mới, phải lấy code mới nhất từ GitHub rồi mới phân tích, sửa code hoặc kiểm thử task đó.

1. Kiểm tra checkout, nhánh, remote và thay đổi chưa commit.
2. Chạy `git fetch origin --prune`, xác định commit mới nhất của nhánh đích (mặc định `origin/main`).
3. Cập nhật checkout phù hợp bằng fast-forward nếu an toàn. Nếu checkout có thay đổi chưa commit, thuộc task khác hoặc nhánh của thành viên khác, tạo worktree/nhánh riêng từ nhánh đích mới nhất; không reset, ghi đè hoặc tự stash công việc hiện có.
4. Ghi nhận commit nền và phạm vi nhánh đã lấy trong báo cáo task. Nếu không lấy được remote, nói rõ và không gọi bản đang dùng là mới nhất. Không tự merge mọi nhánh chưa hợp nhất vào main.

Quy định này áp dụng cả khi tiếp tục một task sau thời gian gián đoạn có thể có code mới. Giữ nguyên các hướng dẫn chuyên biệt trong `src/AGENTS.md`.
