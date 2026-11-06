# SCRUM-94 — cải thiện streaming và kiểm thử ngày 06/11/2026

Nhánh: `feat/scrum-94-interview-streaming`, tiếp nối SCRUM-93 `baa2f8e`. Thực hiện/kiểm thử bởi Codex theo yêu cầu người dùng. Chưa commit/push trong lần này; chưa có xác nhận review của thành viên nhóm hoặc nghiệm thu production.

**Kết quả:** hoàn thiện thêm xử lý kết thúc stream, trạng thái chờ và chẩn đoán độ trễ. 212/212 test offline đạt; 13 tình huống trình duyệt có kiểm soát đạt. Năm request Gemini thật đều có kết quả hợp lệ và lưu thành công, bốn request hiện chữ đầu trong hai giây. Mốc 90% và điều kiện Chat/Supabase chung vẫn chưa được đáp ứng.

## 1. Các thay đổi đã thực hiện

| Phần | Thay đổi | File chính |
| --- | --- | --- |
| Hoàn tất upstream | Khi nhận `STOP`, ngừng đọc và giải phóng reader, kiểm tra JSON hoàn chỉnh rồi trả decision; không đợi transport EOF. | `src/lib/interview/interviewer-provider.mjs` |
| Trạng thái chờ | Callback `onStatus`: generating ngay, slow sau 5 giây, extended sau 10 giây; dọn timer trên mọi đường kết thúc. | `src/lib/interview/next-stream-client.mjs` và `.d.mts` |
| Giới hạn chờ trình duyệt | Mặc định 35 giây, tách khỏi timeout Gemini 30 giây. Hủy request và xóa draft khi quá hạn; không tự retry. | Cùng browser consumer |
| Phân biệt lỗi | `RESPONSE_TIMEOUT`, `AI_TIMEOUT`, `REQUEST_CANCELLED`, `NETWORK_ERROR` và lỗi dữ liệu được phân biệt; mất kết nối sau draft không bị gọi là JSON model sai. | Browser consumer/provider |
| Timing server | Các mốc từ Auth/claim/context đến upstream, kiểm tra và persistence; replay/end/error có nhãn riêng. Bật bằng `INTERVIEW_TIMING_LOGS=1`, mặc định tắt. | `timing-trace.mjs`, `next-http.mjs`, `next-service.mjs`, route `/api/interview/next` |
| Timing client | Callback `onMetrics` trả thời gian nhận delta đầu, tổng thời gian, outcome và code; không coi complete-only replay là lượt sinh chữ đầu. | Browser consumer |
| Harness kiểm thử | Thêm STOP không EOF, chờ 12 giây, timeout upstream, deadline trình duyệt và ngắt kết nối. Có report tag để giữ lại các báo cáo cũ. | `src/tests/fixtures/`, `src/tests/browser/` |

Hợp đồng HTTP/SSE và các kiểm tra schema, action/topic, ownership, câu trùng chuẩn hóa, claim/finish/release và replay được giữ nguyên. Không thêm SDK, model, migration hoặc một lượt gọi AI phân loại/nén context. Thay đổi này không sửa toàn bộ bài toán chọn follow-up và trùng nghĩa của SCRUM-93.

## 2. Nguyên nhân đã tái hiện và ranh giới kết luận

Test mới cung cấp JSON hợp lệ với `finishReason: STOP` nhưng giữ kết nối upstream mở. Bản cũ không trả decision trong cửa sổ 200 ms dù toàn bộ kết quả đã có. Bản sửa kết thúc tại STOP, hủy reader và trả decision đã kiểm tra. Test với schema sai và JSON không có STOP vẫn không được lưu như thành công.

Trong trình duyệt với upstream mô phỏng trả phần cuối ở khoảng 850 ms nhưng không đóng kết nối, kết quả hoàn tất khoảng **864 ms**, lưu đúng một câu hỏi. Đây là bằng chứng sửa một tình huống có thể gây chờ thừa sau khi model đã kết thúc, **chưa chứng minh đó là nguyên nhân của mọi lần timeout 30 giây mà người dùng gặp**. Khi model chưa trả STOP hoặc dịch vụ không phản hồi, timeout vẫn có thể xảy ra.

## 3. Skill và phương pháp kiểm thử

| Skill | Áp dụng |
| --- | --- |
| `gemini-api-dev` | Đối chiếu structured streaming và REST finishReason từ tài liệu Google trước khi sửa provider; giữ cách tích hợp REST hiện tại. |
| `systematic-debugging` | Tái hiện việc chờ EOF, phân biệt lỗi transport/model; đọc lỗi build trước khi chọn Webpack kiểm chứng. |
| `test-driven-development` và hướng dẫn writing-good-tests | Test lỗi STOP thất bại trước sửa; bốn ca mới của client thất bại trước bổ sung; ba test timing thất bại trước instrumentation; thêm regression cho hủy trước fetch và log request abort trước khi consumer đóng reader. |
| `webapp-testing` | Python Playwright, Edge headless, provider/service/handler/consumer thật, upstream kiểm soát hoặc Gemini thật, PGlite cục bộ; chụp ảnh và đóng tiến trình theo PID/instance ID. |
| `verification-before-completion` | Chạy toàn bộ npm test, targeted ESLint, typecheck, production build và secret scan; không dùng unit test thay kết quả live/production. |

Đã đọc hướng dẫn Next.js đúng phiên bản trong `node_modules/next/dist/docs`. Không thay bảng/RLS hoặc schema database trong lần này.

## 4. Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `npm test` | **212/212**, tăng 11 test so với bản 201 test trước đó. Log: `tmp/scrum94-tests-improvements-20261106.log`. |
| ESLint các file liên quan | Đạt, exit 0. |
| `npm run typecheck` | Đạt, exit 0. |
| `npm run build` mặc định | Không đạt: lần trong sandbox không tải được Google Fonts; lần ngoài sandbox Turbopack gặp lỗi tiến trình con trong xử lý CSS. Không sửa layout/font của người dùng để che lỗi này. |
| `npm run build -- --webpack` | **Đạt**, compile, TypeScript, prerender và build traces hoàn tất; route `/api/interview/next` được nhận. Chưa xác nhận lại build Turbopack mặc định. |
| `npm run verify:secrets` | Đạt sau khi xóa hai bản tải tài liệu tạm chứa khóa mẫu công khai. Hai bản đó không chứa khóa đang cấu hình của người dùng. `.env.local` vẫn ignored/untracked. |
| Trình duyệt có kiểm soát | **13 tình huống đạt**, gồm một lượt replay. Auth giả lập và PGlite. Không đưa các ca cố ý chậm/lỗi vào tỷ lệ latency live. |
| Trình duyệt + Gemini thật | **5/5** phản hồi hợp lệ/lưu thành công và replay không gọi AI thêm; **4/5** chữ đầu ≤ 2 giây. Không gọi lại request chậm để thay kết quả. |

Trong ca kiểm soát chờ 12 giây, thông báo 5/10 giây đều xuất hiện, nút hủy còn dùng được, chưa có câu nào lưu trước complete và chỉ một request upstream được thực hiện. Ca deadline trình duyệt dùng ngưỡng 1000 ms riêng trong fixture để kiểm tra nhanh; unit test dùng fake clock kiểm tra đúng mặc định 35000 ms. Mặc định sản phẩm không bị đổi thành một giây.

Ảnh đã xem: `output/interview-stream/improvements-20261106/controlled-extended-wait.png` và `controlled-browser-deadline.png`. Đây là trang kiểm thử, không phải ảnh xác nhận Chat chính đã được tích hợp.

## 5. Năm request Gemini thật mới

| Ca | Chữ đầu hiển thị | Complete hợp lệ/lưu xong | Action |
| --- | ---: | ---: | --- |
| Mở đầu tiếng Anh | 1503,1 ms | 1662,2 ms | next_topic |
| Mở đầu tiếng Việt | 1278,3 ms | 1470,0 ms | next_topic |
| Hỏi sâu kỹ thuật tiếng Anh | 1076,8 ms | 1176,0 ms | follow_up |
| Hỏi sâu hành vi tiếng Việt | 2293,3 ms | 2459,7 ms | follow_up |
| Lịch sử dài | 1261,4 ms | 1374,3 ms | follow_up |

Mẫu số là năm request sinh mới; replay không được cộng vào mẫu. Tỷ lệ nhanh-và-hợp-lệ **80%**, hoàn tất-và-lưu ≤ 5 giây **100%**. p50/p95 chữ đầu lần lượt **1278,3 / 2293,3 ms**; p50/p95 complete là **1470,0 / 2459,7 ms**. p95 tính nearest-rank trên năm lượt, cỡ mẫu còn nhỏ.

Timing mới cho thấy thời gian dựng context/prompt trong mẫu khoảng **1,3–7,0 ms**, upstream-start đến chữ câu hỏi đầu khoảng **1038,9–2264,2 ms**, persistence PGlite khoảng **2,9–12,6 ms**. Khoảng chờ upstream gồm mạng, xếp hàng và xử lý bên dịch vụ; không xác định riêng thời gian prefill/GPU. Chiều dài prompt vẫn có thể ảnh hưởng xử lý upstream, nên số đo CPU dựng prompt nhỏ không chứng minh nén context sẽ vô ích.

Không chạy một phép A/B có kiểm soát với bản cũ; không quy mọi khác biệt so với kết quả 05/11 cho riêng sửa STOP. Không thêm nén context bằng model chỉ để công bố tăng tốc khi chưa đo được chi phí nén và mức mất thông tin.

Toàn bộ dữ liệu là hồ sơ/câu trả lời giả lập do trợ lý tạo; đã gọi đúng năm request Gemini mới trong đợt này. Chưa dùng CV thật, chưa có đánh giá chuyên gia về chất lượng câu hỏi và chưa kiểm tra riêng “dạ có/yes” trong đợt streaming này.

## 6. Bằng chứng và cách chạy lại

- [Report controlled](results/scrum94-browser-controlled-improvements-20261106.json).
- [Report Gemini live](results/scrum94-browser-live-improvements-20261106.json).
- [Tổng hợp máy đọc được](results/scrum94-improvements-20261106.json).
- [Hợp đồng API và cách tích hợp callback](../api/INTERVIEW_STREAM_API_v1.md).

Từ thư mục `src`, dùng Python môi trường đã có Playwright (hiện ở `../tmp/scrum94-venv/Scripts/python.exe`):

```powershell
& '../tmp/scrum94-venv/Scripts/python.exe' -X utf8 tests/browser/run_interview_stream.py --port 4174 --tag review-controlled
& '../tmp/scrum94-venv/Scripts/python.exe' -X utf8 tests/browser/run_interview_stream.py --live --port 4175 --tag review-live
```

Lệnh live dùng quota và đọc key từ `.env.local` ở server; chỉ chạy khi cần đo mới. Chọn tag mới để không ghi đè bằng chứng. Harness trả mã lỗi nếu một ca chức năng lỗi hoặc có lượt vượt hai giây; xem riêng `functionalChecks` và các trường latency trong report, không gộp hai kết luận.

## 7. Phần còn chờ nghiệm thu

`NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` chưa được cấu hình trong môi trường kiểm thử hiện tại. Trang Chat chính cũng chưa có trong checkout này. Các callback 5/10 giây đã có trong client dùng chung và được kiểm tra qua harness, nhưng chưa xác nhận tích hợp vào Chat sản phẩm của SCRUM-95.

Cần nối Chat, persistence/answer anchor và Supabase chung rồi chạy ít nhất 20 request đủ điều kiện theo [mốc đã ghi nhận](SCRUM-94_ACCEPTANCE_TARGETS_VI.md). Hiện 4/5 < 90%; cỡ mẫu 5 < 20; môi trường chưa đúng yêu cầu. **Chưa đánh dấu SCRUM-94 đạt nghiệm thu**, dù phần cải thiện local và kiểm thử chức năng đã thực hiện.

Nguồn kỹ thuật: [Google structured output/streaming](https://ai.google.dev/gemini-api/docs/structured-output), [Google REST finishReason/STOP](https://ai.google.dev/api/generate-content). Hướng chọn phép đo tham khảo [DistServe, OSDI 2024](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin); việc tối ưu/nén context cần kiểm chứng riêng theo giới hạn đã tổng hợp trong [báo cáo nghiên cứu](../analysis%20and%20design/INTERVIEW_DIALOGUE_RELIABILITY_RESEARCH_VI.md). Không chuyển số liệu của bài báo thành SLA Gemini.
