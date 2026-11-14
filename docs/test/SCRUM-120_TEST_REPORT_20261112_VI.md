# SCRUM-120 — Kết quả kiểm thử Build 1 ngày 12/11/2026

Tôi kiểm thử phần được giao cho LGHung trên commit `0668228` của `origin/main`, nhánh `test/scrum-120-hung`. Đã fetch GitHub trước khi chạy; main chưa có commit mới hơn bản ngày 11/11. Thư mục kiểm thử riêng không ghi đè các thay đổi chưa commit ở checkout `main`.

## Phạm vi và kết luận

Đây là bằng chứng kiểm thử bằng công cụ (Playwright/Edge headless và trình duyệt cho OAuth), không phải xác nhận thao tác thủ công toàn bộ của sinh viên. Ứng dụng chạy production local, dùng Supabase thật và Gemini thật với JD/CV tổng hợp trong ZIP dùng chung. Tôi upload **cv_valid.pdf hai trang**, không thay bằng thao tác dán văn bản.

Năm case Jira nêu: **2 Pass, 2 Fail, 1 Blocked**. Hai dòng bổ sung có tester LGHung: **1 Pass, 1 Fail**. Tổng bảy dòng được ghi: **3 Pass, 3 Fail, 1 Blocked**. SCRUM-120 chưa thể coi là nghiệm thu đầy đủ vì phần tài khoản Google mới còn bị chặn; các chức năng có Fail cần được sửa và retest. Trạng thái task Jira không được dùng làm bằng chứng đạt.

| Dòng trong sheet Test cases | Mã | Kết quả | Quan sát |
|---|---|---|---|
| 5 | UC01-03 | Blocked | OAuth tài khoản Google cũ về Dashboard thành công hai lần; đang đăng nhập mở /login được chuyển Dashboard. Người dùng xác nhận chỉ dùng được tài khoản cũ. Chưa chứng minh tạo account/profile mới, không tạo trùng hoặc hủy trên trang Google thật. |
| 17 | UC04-04 | Pass | Abort request phân tích giữ JD/PDF và có Thử lại. Khôi phục gọi Gemini thật thành công. Abort riêng insert Supabase giữ kết quả, có Lưu lại; khôi phục lưu đúng một dòng và không gọi AI thêm. Pass cho biến thể lỗi mạng được chạy, không phải bằng chứng timeout của provider. |
| 18 | UC04-05 | Pass | Đổi English xóa kết quả cũ nhưng giữ JD/PDF; sinh và lưu kết quả mới bằng tiếng Anh. Logout/login hiện score/date gần nhất; Xem lại tải kết quả Anh đã lưu, không gọi analyze thêm. |
| 26 | UC06-03 | Fail | Hủy xác nhận giữ câu hỏi/draft; phiên không trả lời kết thúc không report nhưng vẫn ở màn Chat thay vì tự về Dashboard. Phiên có một câu trả lời được completed nhưng không có report. |
| 28 | UC06-05 | Fail | Retry lỗi mạng thành công và không trùng câu hỏi. Mẫu B2 thật nhận lỗi kết quả AI chung, ô sửa câu trả lời bị khóa. Hạn mức thật và resume hoạt động. |
| 40 | UC06-06 | Fail | Các thông báo lỗi/khôi phục có hoạt động. Khi inject AI_CONTENT_BLOCKED, UI yêu cầu sửa nhưng không cho sửa câu trả lời đã lưu. Bước lỗi sau feedback chưa chạy theo đúng luồng vì chưa tích hợp feedback. |
| 41 | UC06-07 | Pass | RPC hạn mức thật chặn gọi, phiên còn trên Dashboard, khôi phục hạn mức tiếp tục đúng phiên. Phiên thử hết thời lượng kết thúc và giữ câu trả lời đã gửi. |

File gốc bị trùng mã UC06-03 (dòng 26/37) và UC06-05 (dòng 28/39), nội dung và người được giao khác nhau. Tôi đối chiếu bằng **dòng + tên + tester**, không sửa mã hay nội dung Expected Result. Dòng 40–41 có LGHung dù chưa được nêu riêng trong summary Jira; đã kiểm tra bổ sung và ghi rõ.

## Môi trường và cách tạo lỗi

- Local production `localhost:3000`, Supabase shared/test account A thật; UI mock flags không bật. Trình duyệt Google dùng phiên tài khoản cũ đang có; không lưu thông tin đăng nhập vào báo cáo.
- Analysis: POST `/api/analyze-fit` bị abort ở trình duyệt để kiểm tra lỗi mạng. Lỗi lưu chỉ abort POST `/rest/v1/fit_analyses`; request AI vẫn thật. Không giả lập kết quả thành công bằng mock.
- Chat: một opening request bị abort. Các mã `AI_CONTENT_BLOCKED`, `INVALID_OUTPUT`, `AI_RATE_LIMITED` được inject HTTP error có kiểm soát để kiểm tra nhánh UI; không coi đó là provider thực sự từ chối/quá tải hoặc timeout thật.
- Quota: server phụ cổng 3001 đặt riêng biến môi trường `AI_DAILY_LIMIT=1`; account test đã tiêu nhiều hơn một lượt hôm đó. RPC Supabase thật từ chối. Đây là biến thể dùng account đã hết lượt, không phải bắt đầu từ bộ đếm rỗng và gọi đúng ba lần. Trở về server 3000 với cấu hình bình thường để resume. Không đổi cấu hình hạn mức của staging hay reset bộ đếm dùng chung.
- Hết giờ: chỉ đổi `started_at` của chính phiên tổng hợp vừa tạo về một giờ trước, bằng quyền account test/RLS; backend thật kiểm tra thời lượng. Không sửa session của người khác, không đổi schema/migration.
- Callback OAuth bị hủy: kiểm tra riêng `/auth/callback?error=access_denied` có thông báo thân thiện. Đây là mô phỏng callback, không thay thế bước người dùng bấm Cancel trên Google.

## Lỗi ghi nhận

| ID nội bộ báo cáo | Mức ưu tiên đề xuất | Tái hiện / Actual | Expected theo workbook |
|---|---|---|---|
| S120-01 | P2 | Kết thúc phiên chưa trả lời: đã completed nhưng vẫn ở màn kết thúc Chat. | Tự trở lại Dashboard. Nhóm cần quyết định sửa UI hay đề nghị điều chỉnh use case; hiện ghi Fail theo file. |
| S120-02 | P1 | Tạo phiên, trả lời một câu, kết thúc: câu trả lời lưu được; bảng reports không có dòng cho phiên đó. | Có report chỉ dựa trên câu đã trả lời. |
| S120-03 | P2 | Gửi đúng B2 trong answer_bank: một lần Gemini thật quan sát thấy thông báo “AI trả về kết quả lỗi. Hãy thử lại.”, không có thông báo từ chối phù hợp. | Thông báo nội dung không xử lý được và có thể sửa/gửi lại hoặc kết thúc. Chưa kết luận nguyên nhân đầu ra provider từ một mẫu; không khẳng định mọi lượt B2 đều lỗi. |
| S120-04 | P1 | Sau lưu answer, inject AI_CONTENT_BLOCKED ở request next: thông báo bảo sửa câu trả lời nhưng textarea disabled, nút Gửi disabled. | Người dùng sửa và gửi lại được, hoặc kết thúc. Recovery Thử lại hiện lặp bước next với câu trả lời cũ. |

Các mức ưu tiên trên là đề xuất trong báo cáo, chưa phải issue được tạo trên Jira. Vấn đề S120-04 cũng được thấy ở luồng B2 thật nhưng được tái hiện riêng bằng lỗi inject để xác định nhánh UI. Báo cáo này không sửa code ứng dụng hay tự đổi tài liệu yêu cầu.

## Kiểm tra kỹ thuật và bằng chứng

- `npm run build`: exit 0, bao gồm TypeScript.
- `npm test`: 255/255, 0 fail, 0 skipped. Đây là bộ unit/integration nền, không thay thế test case UI.
- Hai kết quả Analysis mới nhất của account thử là English/Vietnamese, đều có tên `cv_valid.pdf`. Năm session tổng hợp của đợt thử đều completed khi kiểm tra kết thúc; không xóa dữ liệu bằng chứng.
- `core-results.json`: 16 kiểm tra nhỏ, 13 đạt / 3 không đạt.
- `extra-results.json`: 9 kiểm tra nhỏ trước lỗi harness selector, 8 đạt / 1 không đạt. Script bị dừng ở bước callback vì `role=alert` trùng hai phần tử. Chỉ bước callback được chạy lại với selector cụ thể và đạt trong `callback-results.json`; không chạy lại các lời gọi AI để thay kết quả thất bại. Log `status=stopped` của lượt extra được giữ nguyên để thể hiện lịch sử thật.
- Phần văn bản Anh đã được Codex đọc lại toàn bộ trong `english-result.txt`: nhãn, trạng thái, nhận xét và disclaimer đều tiếng Anh. Tên kỹ năng/tên riêng giữ nguyên. Chưa có đánh giá độc lập của thành viên.

Kết quả có cấu trúc: [thư mục kết quả](results/scrum120-20261112/). Bằng chứng hình: [thư mục ảnh](images/scrum120-20261112/).

| Nội dung | Ảnh |
|---|---|
| AI mạng lỗi, giữ input | [analysis-network-error](images/scrum120-20261112/analysis-network-error.png) |
| Gemini thật thành công, chỉ lưu lỗi | [save-failure](images/scrum120-20261112/analysis-real-result-save-failure.png) |
| Kết quả Anh | [analysis-english](images/scrum120-20261112/analysis-english.png) |
| Xem lại không gọi AI | [view-latest](images/scrum120-20261112/analysis-view-latest.png) |
| Cancel giữ draft | [end-cancel](images/scrum120-20261112/end-cancel-preserves-draft.png) |
| Kết thúc có answer, thiếu report | [end-answered](images/scrum120-20261112/end-answered-no-report.png) |
| B2 thực tế | [real-B2](images/scrum120-20261112/chat-real-B2.png) |
| Từ chối có kiểm soát, khóa input | [refusal](images/scrum120-20261112/controlled-refusal-locked-input.png) |
| Hết lượt thật | [quota](images/scrum120-20261112/quota-real-limit.png) |
| Tiếp tục phiên | [resume](images/scrum120-20261112/quota-resumed.png) |
| Hết giờ có kiểm soát | [expiry](images/scrum120-20261112/quota-expired-session.png) |

## File Excel và giới hạn còn lại

[Bản điền kết quả](test_use_cases/InterviewBuddy_Test_Cases_Build1_v1.0.xlsx) — *14/11: kết quả đã được gộp vào file test case chính (lấy bản test lại 13/11 trên Drive); bản sao riêng đã bỏ vì Excel không mở được do ô chữ bị ghi sai kiểu.* Ghi chú gốc: bản điền kết quả là bản sao; file gốc giữ nguyên. Chỉ điền F/G/I/J ở bảy dòng LGHung, giữ H để bảo toàn phân công, đồng thời ghi rõ tool-run trong Remark. Tăng chiều cao đúng bảy dòng để đọc đủ kết quả. Các sheet, mã case, Expected Result, kết quả của thành viên khác và liên kết ngoài có sẵn được giữ nguyên. Vì bộ xuất workbook làm mất external links, đã ghép đúng 28 giá trị do Artifact Tool soạn vào gói XLSX gốc, giữ mọi phần gói khác nguyên byte; không dựng lại toàn workbook hoặc tự sửa các mã trùng.

Chưa kiểm tra staging/deployment, Google account mới, thao tác từ chối thật trên Google, số lượng auth/profile trước–sau tài khoản Google, provider timeout thật và provider quota thật. Không đánh những phần đó Pass. Cần bổ sung Google case, sửa các lỗi ghi nhận rồi retest các bước liên quan; không cần gọi lại toàn bộ Gemini khi chỉ sửa một selector của bộ kiểm thử.
