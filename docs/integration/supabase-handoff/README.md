# Bàn giao Supabase để kiểm thử Chat và AI trên luồng thật

**Người điền/xác nhận:** Nhân hoặc người quản lý project Supabase của nhóm.

**Người nhận:** Hưng và Khang.

**Trạng thái ban đầu:** Chưa được Nhân xác nhận. Các ô bên dưới chưa thể hiện công việc đã hoàn thành.

Cập nhật ngày 06/11/2026: cấu hình và tài khoản đã được bàn giao riêng; kiểm thử Supabase đạt 19/19 ca. Xem [báo cáo Chat/Supabase thật](../../test/SCRUM-94_REAL_CHAT_SUPABASE_20261106_VI.md). Các bảng trống dưới đây là mẫu bàn giao, không ghi thông tin truy cập thật vào tài liệu này.

Mục đích: cung cấp đủ cấu hình, database và tài khoản để nhóm chạy ứng dụng đã đăng nhập, tạo phiên thật, sinh câu hỏi qua Gemini, lưu câu trả lời, reload/resume và kết thúc phiên trên Supabase dùng chung.

Code tích hợp nằm ở nhánh `feat/scrum-94-chat-streaming-hung`, [PR #22](https://github.com/TrungNhan8386/InterviewBuddy/pull/22). Nhánh này đã ghép persistence của Nhân và Chat của Khang; Nhân cần xác nhận trạng thái database cloud tương ứng.

## 1. Nhân cần bàn giao những gì?

| Nội dung | Nhân điền/xác nhận |
| --- | --- |
| Tên project Supabase dùng để test | ______________________________ |
| Loại môi trường: dev/test hoặc project nhóm đang dùng | ______________________________ |
| Project URL (`NEXT_PUBLIC_SUPABASE_URL`) | ______________________________ |
| Anon key đúng project (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Chưa bàn giao / Đã bàn giao riêng: __________ |
| Địa chỉ app dùng khi test, ví dụ `http://localhost:3000` | ______________________________ |
| Cách đăng nhập có thể dùng ngay: email/password hoặc Google | ______________________________ |
| Nhánh/commit backend và migration đang dùng | ______________________________ |
| Hạn mức `AI_DAILY_LIMIT` thống nhất cho môi trường test | ______________________________ |
| Người hỗ trợ khi gặp lỗi database/auth | ______________________________ |
| Ngày xác nhận bàn giao | ______________________________ |

**Không điền giá trị key, mật khẩu hoặc token vào README này.** Anon key được ứng dụng dùng ở browser, nhưng cần bàn giao đúng project bằng file cấu hình local hoặc kênh riêng của nhóm. README chỉ ghi trạng thái đã bàn giao. URL project có thể điền nếu quy ước chia sẻ của nhóm cho phép; không gắn key/token vào URL.

Luồng Chat thông thường không cần bàn giao `service_role`, mật khẩu database, connection string có mật khẩu, access/refresh token hoặc Google client secret. Gemini API key do Hưng cấu hình riêng ở server.

## 2. Cấu hình cần gửi cho người chạy app

Nhân bàn giao riêng hai giá trị sau; đoạn dưới chỉ là mẫu trống:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Người nhận điền vào **`src/.env.local` của đúng checkout đang chạy**, không phải file ở root repository. File mẫu của dự án: [src/.env.example](../../../src/.env.example).

Mỗi thành viên dùng `src/.env.local` trong checkout của mình. Giữ nguyên các giá trị Gemini hiện có, đặt `NEXT_PUBLIC_INTERVIEW_MOCK=0` và restart app sau khi đổi cấu hình.

- [ ] URL và anon key thuộc cùng project Supabase.
- [ ] Đã bàn giao hai giá trị qua kênh riêng; chưa ghi key vào README/commit.
- [ ] Đã thống nhất địa chỉ app để đăng nhập và sử dụng cùng hostname.

## 3. Xác nhận migration trên Supabase thật

Nhân đối chiếu lịch sử migration của project cloud và điền trạng thái thực tế. Chỉ có file SQL trong GitHub chưa chứng minh database đã được cập nhật. Giữ dữ liệu hiện có và RLS; không reset database chung để hoàn thành checklist.

| Thứ tự | Migration | Trạng thái cloud | Ngày áp dụng / ghi chú lỗi |
| --- | --- | --- | --- |
| 1 | [20261021000000_initial_schema.sql](../../../src/supabase/migrations/20261021000000_initial_schema.sql) | Chưa xác nhận | __________________ |
| 2 | [20261030000000_interview_session_settings.sql](../../../src/supabase/migrations/20261030000000_interview_session_settings.sql) | Chưa xác nhận | __________________ |
| 3 | [20261103000000_interview_next.sql](../../../src/supabase/migrations/20261103000000_interview_next.sql) | Chưa xác nhận | __________________ |
| 4 | [20261105000000_session_resume_ai_limit.sql](../../../src/supabase/migrations/20261105000000_session_resume_ai_limit.sql) | Chưa xác nhận | __________________ |

Xác nhận các hàm API gọi có thể được sử dụng dưới quyền tài khoản đã đăng nhập, đồng thời vẫn kiểm tra quyền sở hữu:

| RPC | Chức năng | Kết quả Nhân xác nhận |
| --- | --- | --- |
| `claim_interview_next` | Giữ chỗ một lượt sinh câu hỏi, lấy context từ dữ liệu đã lưu | __________________ |
| `finish_interview_next` | Hoàn tất và lưu câu hỏi sau kiểm tra | __________________ |
| `release_interview_next` | Giải phóng lượt sinh khi thất bại/hủy | __________________ |
| `save_interview_answer` | Lưu câu trả lời và trả answer ID | __________________ |
| `consume_ai_call` | Kiểm tra và tính hạn mức AI trước khi gọi Gemini | __________________ |

- [ ] Schema và các RPC đã được API nhận diện; không còn lỗi thiếu hàm/schema cache.
- [ ] Dữ liệu session/question/answer và lượt dùng AI vẫn được bảo vệ bằng quyền sở hữu/RLS.
- [ ] Tài khoản thường lưu/tải được dữ liệu của chính mình; không cần dùng service-role trong app.

## 4. Tài khoản test

Nhân chuẩn bị **hai tài khoản test riêng A/B**, đã xác nhận email. A chạy luồng chính; B kiểm tra rằng người khác không xem hoặc sửa dữ liệu của A. Nếu mới có A thì có thể bắt đầu luồng chính, nhưng chưa hoàn tất kiểm tra quyền truy cập giữa hai người dùng.

| Điều kiện | Tài khoản A | Tài khoản B |
| --- | --- | --- |
| Đã tạo tài khoản test | [ ] | [ ] |
| Email đã được xác nhận | [ ] | [ ] |
| Đăng nhập được bằng phương thức đã bàn giao | [ ] | [ ] |
| Thông tin đăng nhập đã bàn giao riêng | [ ] | [ ] |
| Người nhận đã xác nhận đăng nhập được | [ ] | [ ] |

Không ghi mật khẩu/email cá nhân/token vào bảng. Nếu dùng đăng nhập Google, Nhân phối hợp Tài xác nhận provider và redirect URL đúng với app test. Nếu dùng email/password đã hoạt động thì nhóm có thể kiểm tra Chat bằng phương thức đó trước.

Nếu muốn chạy script sẵn có `npm run test:session-api`, script yêu cầu đúng hai user seed `candidate.a@interviewbuddy.test`, `candidate.b@interviewbuddy.test` và `SEED_USER_PASSWORD` trong cấu hình local. Mật khẩu chỉ bàn giao riêng. Nhân/admin quản lý việc seed trên môi trường test; người nhận không tự chạy seed vào database chung.

## 5. Dữ liệu và hạn mức để chạy thử

| Nội dung | Nhân xác nhận |
| --- | --- |
| Có thể tạo session với `fitAnalysisId: null` để thử Chat trước | __________________ |
| Có thể lưu fit analysis tổng hợp và liên kết đúng tài khoản khi tạo session | __________________ |
| Tài khoản A còn đủ hạn mức cho ít nhất 20 lượt sinh câu hỏi mới và các lượt phân tích dự kiến | __________________ |
| Hạn mức app và ngày làm mới đã thống nhất | __________________ |
| Dữ liệu nào là dữ liệu test được phép dọn sau kiểm tra; ai chịu trách nhiệm dọn | __________________ |

`AI_DAILY_LIMIT` mặc định của code là 100 lượt/người/ngày, làm mới lúc 00:00 giờ Việt Nam. Đây là hạn mức của app; khả năng gọi Gemini còn phụ thuộc API project/model mà Hưng cấu hình. Nhân không cần tiêu hết quota tài khoản nhóm để chứng minh chức năng chặn hạn mức.

Dùng CV/JD và câu trả lời tổng hợp. Hưng/Khang chuẩn bị nội dung cho các ca vi/en, hồ sơ ngắn/dài và câu trả lời mơ hồ; Nhân chỉ cần xác nhận database nhận/lưu đúng các dữ liệu đó.

## 6. Kiểm tra bàn giao tối thiểu

Đánh dấu sau khi đã kiểm tra thực tế bằng tài khoản thường:

- [ ] Đăng nhập được vào app với tài khoản A.
- [ ] `POST /api/interview` tạo được session và trả `sessionId` thật.
- [ ] `GET /api/interview/{sessionId}` tải được settings, turns và resume của chính tài khoản A.
- [ ] Lưu answer qua `/api/interview/{sessionId}/answers` trả ID thật; đọc lại thấy answer.
- [ ] Reload/tải lại phiên giữ được các lượt đã lưu, không cần tạo session mới.
- [ ] `/api/interview/{sessionId}/end` kết thúc phiên; tải lại giữ đúng trạng thái.
- [ ] Tài khoản B không đọc/sửa được phiên của A; chưa đăng nhập thì API từ chối.
- [ ] RPC hạn mức hoạt động; trường hợp thiếu RPC/hết quota chặn trước Gemini.

Nhân có thể dùng `npm run test:session-api` sau khi app và dữ liệu seed phù hợp đã sẵn sàng. Script có tạo/xóa session test và chèn câu hỏi tổng hợp dưới quyền user; **không gọi Gemini** và không thay thế kiểm thử streaming Chat thật. Ghi kết quả đúng phạm vi đã chạy.

Kết quả kiểm tra / vị trí log đã bỏ thông tin nhạy cảm:

```text
Người thực hiện:
Ngày kiểm tra:
Commit của app:
Môi trường Supabase:
Ca đã chạy / kết quả:
Ca chưa chạy / lý do:
Lỗi còn lại và người phối hợp:
```

## 7. Kết luận bàn giao và bước tiếp theo

- [ ] Cấu hình đã bàn giao riêng.
- [ ] Migration/RPC đã xác nhận.
- [ ] Tài khoản A đăng nhập được; B sẵn sàng cho kiểm tra ownership.
- [ ] Các vấn đề chưa xử lý đã ghi rõ ở phần dưới.
- [ ] Hưng/Khang đã nhận bàn giao.

```text
Kết luận của Nhân: Chưa bàn giao / Có thể bắt đầu test Chat / Còn vướng
Vướng mắc cụ thể:
Người cần phối hợp:
Thời điểm bàn giao dự kiến nếu còn thiếu:
```

Sau bàn giao, **Hưng và Khang** chạy Chat/AI thật, kiểm tra streaming, lưu/resume, lỗi/hủy và đo ít nhất 20 lượt sinh mới theo mốc SCRUM-94. Nhân hỗ trợ các lỗi database/auth/quota. Kết luận Supabase sẵn sàng không đồng nghĩa đã đạt tốc độ AI hoặc đã nghiệm thu SCRUM-94.

Trang Setup hiện vẫn cần Tài nối nút bắt đầu với API tạo session. Trong lúc chờ, có thể tạo session bằng API đã đăng nhập rồi mở `/interview/<sessionId>` để kiểm tra Chat/AI. Cách thực hiện ở [mục 7.1 của hướng dẫn tích hợp](../TEAM_INTEGRATION_GUIDE_VI.md#71-tạo-phiên-từ-form--phần-còn-cần-nối).

Tài liệu đối chiếu:

- [Hướng dẫn tích hợp chung](../TEAM_INTEGRATION_GUIDE_VI.md).
- [Persistence và hạn mức AI](../../api/INTERVIEW_PERSISTENCE_API_v1.md).
- [Báo cáo xuất bản và giới hạn kiểm thử](../../test/SCRUM-94_PUBLICATION_20261106_VI.md).
