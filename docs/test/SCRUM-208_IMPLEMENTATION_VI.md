# SCRUM-208 — phần triển khai và giới hạn kiểm chứng

Ngày thực hiện: 25/11/2026. Nền: origin/main a9308d02a5276213eb90a253ff89dafee4052897. Checkout riêng `scrum208-task-plans`, giữ nguyên checkout cũ.

**Cập nhật mới nhất:** ba thiếu sót trong lần rà soát đã được sửa trong code local; xem mục “Sửa các thiếu sót sau rà soát” cuối báo cáo. Giữ nguyên các kết quả trước để phân biệt lịch sử kiểm tra với trạng thái mới.

## SCRUM-209

- Sửa frontend gửi chỉ answerId, đọc wrapper feedback của backend; ánh xạ điểm, lý do, quote và outline sang UI. Bằng chứng được đánh dấu trung tính vì backend không cung cấp nhãn positive/negative; không tự bịa nhãn tác động.
- GET kết quả đã lưu trước POST, phục hồi refresh/retry không gọi AI lại khi có dữ liệu, xử lý trạng thái đang chấm.
- Quota/safety/config không hiện retry ngay; lỗi lạ có thông báo dự phòng. Hiển thị nhận xét cụ thể của từng tiêu chí.
- Truyền thời lượng voice đã lưu trong Chat vào feedback, ẩn đối với typed. Phần ngày đang hiển thị là thời điểm chấm, chưa phải thay thế mọi metadata theo toàn bộ test case.
- Bản sửa diversity/follow-up SCRUM-133 đã merge trên main; giữ nguyên engine và chạy regression hiện có, không tuyên bố model luôn trả câu hỏi đúng.

## SCRUM-210/211

API GET/POST, chọn điểm yếu từ dữ liệu đã lưu, ngày Việt Nam, consent kế hoạch tổng quát, JSON schema và runtime validation, shared quota, lease/replay, RLS, lưu nguyên tử, xóa dữ liệu liên quan. Xem contract và mẫu tại `docs/api/PRACTICE_PLAN_API_v1.md`.

Các mặc định mới cần review: tính cả hôm nay/ngày phỏng vấn, tối đa 30 ngày, 3 lần bắt đầu sinh plan/ngày. Chưa áp migration lên Supabase chung, chưa gửi tin nhắn hay comment thay người dùng, chưa triển khai checkbox/ICS/replanning/Dashboard.

## SCRUM-217 — đối chiếu case gốc, không giả kết quả thủ công

| Case | Bằng chứng tự động trong nhánh | Nghiệm thu UI thật |
| --- | --- | --- |
| UC08-01 | Adapter nhận backend thật về shape, giữ reason/quotes/overall | Chưa chạy |
| UC08-02 | Adapter giữ STAR null, loại khỏi trung bình; UI có duration voice | Chưa chạy microphone thật |
| UC08-03 | Regression backend câu ngắn/quote và language hiện có | Chưa review chất lượng Gemini thật |
| UC08-04 | GET-first/replay, không POST khi có kết quả | Report entry và refresh UI chưa nghiệm thu |
| UC08-05 | Callback Practice Similar còn phụ thuộc Khang | Chưa chạy, không đánh dấu Pass |
| UC08-06 | Backend bounded repair và transport error tests | Chưa mô phỏng lỗi trong browser |
| UC08-07 | canRetry loại AI_DAILY_LIMIT; SQL quota tests hiện có | Chưa chạy quota trên Supabase chung |

Không sửa kết quả F/G của workbook Build 2 thành Pass. Test tự động không thay thế thao tác voice, review chuyên môn, UI và kiểm chứng dịch vụ thật.

Chạy tại src: `npm test`, `npm run lint`, `npx next typegen`, `npm run typecheck`, `npm run build`. Test HTTP localhost cần quyền chạy ngoài sandbox nếu bị EACCES. Phân biệt lỗi môi trường build và lỗi source. Không commit .env, dữ liệu đăng nhập hay key.

## Kết quả kiểm chứng cuối

- Toàn bộ test: **357 pass, 0 fail, 0 skip**, gồm contract transport → HTTP backend, planner success/failure/cancellation, RLS và quota SQL local.
- Lint: pass, không warning. TypeScript: pass sau `next typegen`.
- Build Webpack (`next build --webpack`): pass với URL/key Supabase giả chỉ ở environment của process build; không phải kiểm tra Supabase. Turbopack mặc định gặp lỗi process PostCSS của môi trường. Next.js phát khuyến nghị nâng cấp bảo mật cho phiên bản hiện tại; dependencies không đổi trong task này.
- Gemini thật: `verify-planning.mjs --live` tạo và validate một task bằng dữ liệu tổng hợp trong **1473 ms**. Đây là một smoke request trực tiếp provider, không phải số liệu p95 hay kiểm thử Chat/Supabase thật. Không in hoặc lưu API key.
- `git diff --check`: pass. Chưa commit/push, chưa đăng Jira hoặc gửi thông điệp cho thành viên khác.

## Rà soát lại theo yêu cầu người dùng — 25/11/2026

Fetch lại GitHub: origin/main vẫn là a9308d02a5276213eb90a253ff89dafee4052897. Giữ nguyên các thay đổi chưa commit của task. Đọc thêm nhánh Tài `origin/feat/scrum-201-practice-plan-tai` tại 8672f34fb2531e03e1c0943966984b0fd286e7eb; không merge nhánh này.

Chạy lại toàn bộ: 357/357 test pass, không skip; lint và TypeScript pass. Không chạy lại build hoặc Gemini vì không có thay đổi source trong lần rà soát này. Các kết quả đó không chứng minh đủ mọi luồng nghiệp vụ.

### Thiếu sót mới xác nhận

1. **Nguồn điểm yếu có thể bỏ qua report đã có điểm.** `src/lib/planning/repository.mjs:9` chỉ lấy một session completed mới nhất. Nếu session đó không có feedback, hàm trả null mà không tìm report cũ có điểm. Probe bằng repository và dữ liệu giả xác nhận report trước có Content 8, Clarity 4, Confidence 6 nhưng context vẫn null. Phải tìm nguồn đã có điểm hợp lệ, đồng thời giữ lọc chủ sở hữu/vị trí và quy tắc session được chỉ định.
2. **Lưu RPC chưa bảo vệ đầy đủ bất biến của lịch.** `20261125000000_practice_plans.sql:49` chỉ kiểm tra tasks là array có 1–30 phần tử. Trên PGlite với vai trò authenticated của chính tài khoản test, runtime validator từ chối lịch cần hai ngày nhưng chỉ có một task rỗng/criterion lạ; RPC finish lại lưu thành công. Không có truy cập chéo tài khoản trong probe. Cần kiểm tra số ngày, thứ tự/ngày duy nhất, nội dung, criterion và metadata ở tầng lưu trước nghiệm thu.
3. **Contract bàn giao chưa khớp skeleton mới của Tài.** UI dùng targetRole, tasks[].id/reason/done và criterion structure; backend dùng targetPosition, không có task ID, rationale/completed và star. Cần adapter có test hoặc thống nhất contract trước khi nối. UI hiện vẫn dùng mock. Chưa bàn giao thực tế.

Bằng chứng bổ sung được lưu ngoài checkout trong `output/scrum208-planning/recheck-findings.json` của thư mục project. Probe chỉ dùng dữ liệu tổng hợp, PGlite local và query stub; không truy cập Supabase chung/Gemini hay gửi dữ liệu cho thành viên khác.

### Kết luận từng task sau rà soát

| Task | Trạng thái kiểm chứng |
| --- | --- |
| SCRUM-209 | Đã sửa contract/error handling và có regression tự động; Chat thật và các bug đã raise chưa retest đầy đủ |
| SCRUM-210 | Có backend cơ bản; còn hai lỗi nguồn report/lưu RPC nêu trên và thiếu kiểm chứng Supabase thật |
| SCRUM-211 | Có tài liệu/mẫu nhưng cần khớp UI mới của Tài, bàn giao và xác nhận tích hợp |
| SCRUM-217 | Chưa chạy trọn bảy case UC-08 trên UI; Practice Similar callback chưa nối, không đánh dấu Pass |

Chưa đủ điều kiện báo cả bốn task Done. Lần kiểm tra này chỉ cập nhật bằng chứng và kết luận; chưa sửa source của các thiếu sót mới.

## Sửa các thiếu sót sau rà soát — 25/11/2026

Fetch lại origin trước sửa; main vẫn a9308d02a5276213eb90a253ff89dafee4052897. Không merge nhánh của thành viên khác và không reset/stash thay đổi hiện có. Tiếp tục trên `feat/scrum-208-ai-planning-hung`.

1. **Nguồn report:** repository đọc từng trang 20 phiên completed theo thời gian rồi ID để thứ tự ổn định, bỏ phiên chưa có điểm và tìm nguồn được chấm trước đó. Mọi trang giữ RLS và bộ lọc vị trí; session chỉ định không bị thay thế. Không lấy snapshot CV/JD. Regression đã tái hiện lỗi với 45 phiên chưa chấm đứng trước một report có điểm và xác nhận kết quả sau sửa.
2. **Bất biến tại SQL:** thêm validator immutable cho toàn bộ snapshot và CHECK ở bảng. RPC finish từ chối thiếu/trùng/đảo ngày, sai số ngày, ngày không tồn tại, task/rationale rỗng hoặc chỉ có whitespace, nội dung quá dài, criterion lạ, metadata sai và trạng thái hoàn thành không hợp lệ khi sinh mới. Nguồn report phải thuộc người gọi. Lịch bị từ chối giữ nguyên plan cũ và lease; payload sửa đúng có thể lưu bằng lease đó. Test trực tiếp constraint cũng chặn payload sai kể cả khi dùng quyền chủ database.
3. **Khớp UI của Tài:** thêm `src/lib/planning/ui-adapter.mjs` và declaration TypeScript. Chuyển targetPosition → targetRole, rationale → reason, completed → done, star → structure, và tạo task ID ổn định từ plan ID + ngày. Adapter kiểm tra snapshot, không sửa dữ liệu gốc và xử lý plan null. Typecheck đối chiếu với fixture interface nguyên bản từ nhánh Tài tại commit 8672f34fb2531e03e1c0943966984b0fd286e7eb. Đã cập nhật tài liệu tích hợp và sinh fixture view từ response đã validate.

### Kiểm chứng sau sửa

- Regression được chạy thất bại trước khi sửa và đạt sau sửa. Toàn bộ suite cuối: **364 pass, 0 fail, 0 skip**.
- Lint: pass, không warning. TypeScript: pass, gồm kiểm tra tương thích interface của Tài.
- Production build Webpack: pass với cấu hình Supabase giả chỉ trong process build. Next.js vẫn phát khuyến nghị nâng cấp bảo mật; dependencies không đổi.
- SQL dùng PGlite disposable, không áp migration lên Supabase chung. Đã kiểm tra đọc chéo tài khoản sau khi plan thật sự được lưu, claim/replay/quota/purge, lịch sai không ghi đè và constraint trực tiếp.
- Query repository được kiểm tra bằng transport PostgREST giả, vẫn chạy logic chọn nguồn và buildReport thật. Chưa kiểm chứng pagination trên Supabase thật.
- Không chạy lại Gemini vì provider không đổi. Số 1473 ms ở phần trước là kết quả smoke lịch sử, không phải latency mới đo ở lần sửa này.
- Việc thêm adapter không đồng nghĩa đã nối live page trên nhánh Tài. Chưa bàn giao bằng tin nhắn, chưa chạy đủ bảy case UI UC-08, chưa commit/push. Không chuyển bốn task thành Done chỉ dựa vào các kiểm tra local.

## Kiểm chứng trước công bố PR — 26/11/2026

Đã fetch origin/main, vẫn tại a9308d02a5276213eb90a253ff89dafee4052897. Chạy lại đủ 364 test: pass toàn bộ, không skip; lint và TypeScript pass. Kiểm tra secret với khóa local qua environment: 480 file được quét, 0 leak, .env.local bị ignore và không được track. Không đưa các script/bản log công bố ngoài checkout vào commit.

Phạm vi công bố tách thành commit sửa feedback (SCRUM-209) và commit Planning API/migration/adapter/handoff/regression (SCRUM-210/211, hỗ trợ tự động cho SCRUM-217). Các dòng chưa commit/push ở phần trước phản ánh thời điểm kiểm tra lịch sử. Trạng thái công bố sau cùng được xác minh trực tiếp bằng Git và PR; không tự đánh dấu Jira Done, không coi PR là bằng chứng đã áp migration hay nghiệm thu UI thật.
