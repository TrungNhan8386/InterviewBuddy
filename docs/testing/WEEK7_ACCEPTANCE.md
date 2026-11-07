# Week 7 acceptance / installation guide

## Cài bản sửa

Đây là ZIP chỉ chứa các file thay đổi so với `InterviewBuddy-main (3).zip`, không phải toàn bộ repository. Sao lưu thay đổi hiện có hoặc commit trước, rồi giải nén vào thư mục gốc InterviewBuddy (nơi chứa `src` và `docs`). Kiểm tra diff nếu bạn đã sửa các file trùng tên. Không thay `.env.local`; không có key, node_modules, .next hoặc .git trong ZIP.

1. Nhờ người quản lý Supabase kiểm tra migration đã chạy. Áp dụng migration còn thiếu theo đúng thứ tự 20261021 → 20261030 → 20261103 → **20261107000000_settings_data.sql**. Không chạy lại initial schema trên database đã có bảng. Migration mới không xóa dữ liệu khi được áp dụng; chỉ tạo hai hàm. Review SQL trước khi áp dụng lên staging.
2. Giữ cấu hình Supabase và GEMINI_API_KEY hiện có; API key Gemini chỉ nằm server. Không đưa env/key vào commit.
3. Trong PowerShell:

```powershell
cd E:\HCMUS\N3\HK1\NMSE\InterviewBuddy\src
npm.cmd ci
npx.cmd next typegen
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Dừng server đang chiếm cổng bằng Ctrl+C ở terminal cũ trước khi chạy server khác. `next typegen` cần cho Next global route types trên checkout sạch. Chạy lệnh từng dòng; nếu lệnh trước báo lỗi thì xử lý trước.

## SCRUM-86 — Setup và chat

- Đăng nhập, mở New Interview. Thử bỏ trống vị trí/ngày, ngày quá khứ: phải báo lỗi, giữ lựa chọn. Ngày dùng giờ Việt Nam.
- Nhập hợp lệ, double-click Bắt đầu: chỉ tạo một request trong lúc đang xử lý. Network: POST /api/interview → 201, URL chuyển `/interview/<sessionId>`.
- Kiểm tra row lưu đúng loại, độ khó, ngôn ngữ, thời lượng dạng số, input_mode, ngày và tài khoản. Nếu có phân tích gần nhất, fit_analysis_id liên kết đúng của người dùng.
- Trang chat hiển thị thông báo AI. Bấm lấy câu hỏi đầu tiên → POST /api/interview/next. Gemini thật có thể tính quota; chỉ bấm khi cần test.
- Nhập câu trả lời, gửi: answer được lưu rồi mới gọi /next. Reload trang: các câu hỏi/trả lời còn nguyên. Khi next thất bại, câu đã lưu vẫn hiện và nút thử lại dùng ID đó, không tạo answer trùng.
- Tắt mạng hoặc hết hạn phiên: có thông báo, không báo thành công giả. Khôi phục đăng nhập/mạng rồi tải lại phiên. Nếu tạo phiên gặp lỗi mạng không rõ kết quả, xem Dashboard trước khi tạo lại.
- Copy URL phiên tài khoản A sang tài khoản B: không đọc được nội dung. UUID sai/missing: 404.
- Voice hiện ghi nhận lựa chọn, có văn bản dự phòng; chưa triển khai ghi âm/streaming/chấm điểm trong bản tuần này.

## SCRUM-87 — Dashboard

- Tài khoản mới: Total Sessions = 0 và empty state.
- Tạo phiên: Dashboard tăng đúng 1, có link đến phiên thật. Tạo hơn 5 phiên: vẫn chỉ liệt kê 5 phiên mới nhất. Không cần tạo nhiều bằng Gemini: tạo session không gọi AI.
- Account B không thấy phiên của A. Refresh vẫn đúng. Score cards vẫn là dấu —.
- Lỗi query/database phải hiện lỗi hoặc dấu —; không giả thành 0.

## SCRUM-88 — Settings (dùng dữ liệu thử, thao tác xóa không thể khôi phục)

- Chọn English → Lưu → refresh: vẫn English. Mở setup mới: English mặc định; Profile sau refresh cùng giá trị. Chọn lại tiếng Việt cũng tương tự.
- Chưa nhập đúng DELETE thì nút xóa bị khóa. Không gửi request nếu chưa xác nhận.
- Chuẩn bị dữ liệu thử A và B; đóng các tab luyện tập khác. Với A nhập DELETE → xóa. Dashboard A về 0; phân tích CV/JD, session snapshots, questions, answers, feedbacks, reports và generation records của A hết. Account/profile/language của A vẫn còn, login vẫn dùng được.
- Dữ liệu B phải còn nguyên. Không dùng tài khoản thật có CV cần giữ để thử xóa.
- Xóa lần nữa trả 0/0; không lỗi. Thiếu migration trả thông báo chưa sẵn sàng; không xóa nửa chừng.
- Logout rồi gọi Settings API: 401. PATCH với language khác vi/en hoặc thêm userId: 400. DELETE thiếu confirmation: 400.

## Responsive và handoff

Kiểm tra Setup/preview, Dashboard, Settings và chat ở 360 px, tablet và desktop: không scroll ngang, text dài xuống dòng, dùng bàn phím được, nút trạng thái chờ không gửi lặp.

Chạy trên staging sau khi merge/deploy và lưu bằng chứng cho Jira. Review contract với Nhân và người phụ trách chat/AI, đặc biệt nếu họ đã thêm chat page vào main sau bản ZIP này. SCRUM-85 owner sign-off và hosted acceptance chưa được thực hiện thay bạn.

## Commit và push

Từ gốc repository, chỉ stage các file trong danh sách `PATCH_FILES.txt` sau khi xem `git diff`. Không dùng git add . nếu có file env/log riêng.

```powershell
git status --short
git diff --stat
git add -- "src/app/(workspace)/interview/new/page.tsx" "src/app/(workspace)/interview/[id]/page.tsx" "src/components/interview"
git add -- "src/app/(workspace)/dashboard/page.tsx" "src/app/(workspace)/settings/page.tsx" "src/components/layout/AppShell.tsx"
git add -- "src/app/api/settings" "src/lib/settings" "src/supabase/migrations/20261107000000_settings_data.sql" "src/tests/week7-settings.test.mjs"
git add -- "docs/api/WEEK7_API_TABLE.md" "docs/analysis and design/database-design.md" "docs/testing/WEEK7_ACCEPTANCE.md"
git diff --cached --stat
git commit -m "feat: wire interview setup, live dashboard and user settings"
git push -u origin HEAD
```

Tạo PR vào nhánh nhóm quy định, gắn SCRUM-85/86/87/88, nhờ leader review migration và chat bridge. Không cần commit PATCH_FILES.txt hoặc hướng dẫn ở gốc ZIP. Comment Jira với link PR và kết quả test thật; chưa đánh dấu staging Done nếu chưa chạy staging.

## Kết quả chạy trong môi trường sửa code — 2026-11-07

- `next typegen`: đạt (tạo global Next route types cho checkout sạch).
- `npm run lint`: đạt, không warning/error ESLint.
- `npm run typecheck`: đạt.
- `npm test`: **171/171 đạt**, không skip. Gồm kiểm tra RLS/ownership đã có và test mới cho Settings, purge rollback/cascade, tài khoản B không bị xóa, giữ profile/ngôn ngữ, answer retry/stale turn và từ chối anonymous.
- `npm run build`: đạt với Supabase URL/key placeholder chỉ để build offline; không phải xác nhận kết nối database thật. Không lưu placeholder vào source hoặc env của bạn. Build không cấu hình Supabase sẽ dừng ở prerender theo kiểm tra env hiện có.
- Chưa kiểm thử trình duyệt đăng nhập thật, Gemini thật, migration staging hoặc responsive bằng thao tác trên bản chạy có tài khoản. Các bước acceptance phía trên cần bạn thực hiện với cấu hình thật.
