# SCRUM-121 — Đọc 10 phiên mẫu trước khi sửa prompt

Nguồn: bản sao chỉ đọc 10 phiên `completed` đã lưu của tài khoản thử, được tạo bằng dữ liệu tổng hợp trong các lần kiểm tra Chat/Gemini/Supabase trước. Mỗi phiên có 5 câu hỏi và 4 câu trả lời, được kết thúc sớm bằng thao tác test; câu hỏi cuối chưa trả lời vẫn được giữ trong bản chép. Đọc toàn bộ 50 câu hỏi và 40 câu trả lời, không chỉ lấy 10 câu hỏi độc lập. S01–S10 là alias thay ID; không xuất thông tin đăng nhập. Đây là mẫu cùng vị trí Frontend, technical, 5 vi/5 en; không đại diện HR/behavioral hoặc người dùng thật.

Bản chép đầy đủ: [scrum121-reviewed-sessions.json](fixtures/scrum121-reviewed-sessions.json). Việc nhiều câu trả lời dài được lặp lại là cách tạo dữ liệu của test tốc độ trước đây, không phải phát biểu của sinh viên. Khi câu trả lời mẫu không đáp đúng câu hỏi, đó là ca kiểm tra liên quan của follow-up, không được mặc định là trả lời tốt chỉ vì dài.

| Phiên | Quan sát trong toàn chuỗi | Điều prompt cần làm rõ |
|---|---|---|
| S01 en | Sau Yes, câu đào sâu vẫn hỏi nhiều trạng thái và type union. Lượt accessibility nhận câu trả lời về fetch nhưng sau đó hỏi lại modal dưới nhãn main. | Hỏi một trạng thái cụ thể; khi câu trả lời lệch ý, hỏi đúng một chi tiết focus và giữ nhãn follow_up nếu còn lượt. |
| S02 vi | Sau Dạ có yêu cầu giải thích lại cả bốn trạng thái. Sau mô tả AbortController vẫn còn phần cleanup chưa rõ. | Hỏi một bước cụ thể, phân biệt đã nêu tên cơ chế với đã giải thích cách thực hiện. |
| S03 en | Sau Yes ở routing, câu hỏi lại bao quát routing/redirection. Câu trả lời về API dùng cho câu routing nhưng chuỗi chuyển sang AbortController. | Không đuổi theo từ khóa của câu trả lời lệch; quay lại một quyết định kiểm tra quyền truy cập. |
| S04 vi | Sau Dạ có hỏi cùng lúc khởi tạo, truyền signal và cleanup. Hai câu main kế tiếp cùng kiểm tra form validation. | Một chi tiết mỗi lượt; tránh đổi nhãn mà vẫn hỏi cùng năng lực. |
| S05 en | Modal giả định nhưng follow-up hỏi như ứng viên đã từng xây modal trong dự án. Câu trả lời chung không chứng minh trải nghiệm modal. | Giữ cách hỏi giả định; khai thác keyboard focus thay vì giả định thành tích. |
| S06 vi | Có follow-up cụ thể về signal/cleanup. Câu trả lời mẫu vẫn chung chung nhưng cap buộc chuyển chủ đề sau hai follow-up. | Giữ điểm tốt; độ liên quan không được vượt cap của server. |
| S07 en | Follow-up sau Yes gần như lặp câu chính AbortController. Sau câu routing, câu trả lời chỉ về API nhưng chuyển form validation. | Thu hẹp sang thời điểm abort hoặc dấu hiệu request cũ; kiểm tra câu trả lời có giải quyết routing không. |
| S08 vi | Lượt AbortController gắn useEffect cụ thể hơn; lượt routing nhận câu trả lời lệch rồi chuyển testing. | Giữ tính cụ thể, bổ sung kiểm tra alignment trước next_topic. |
| S09 en | Follow-up hỏi cùng nhóm trạng thái như câu đầu. Lượt testing nhận câu trả lời “đã test” nhưng chưa có assertion và kết quả cụ thể. | Hỏi một assertion/ca lỗi chưa rõ, không chuyển chủ đề chỉ vì câu trả lời dài. |
| S10 vi | Sau Dạ có hỏi code hủy request; các lượt testing/routing nhận cùng đoạn trả lời nhưng chuỗi tiếp tục chuyển chủ đề. | Tìm đúng phần còn thiếu trong câu hỏi vừa hỏi; tránh yêu cầu trình bày lại toàn bộ quy trình. |

Đánh giá trên do Codex đọc và phân tích, chưa có reviewer độc lập. Không gán điểm tuyển dụng hoặc coi heuristic đọc nội dung là kết quả khách quan tuyệt đối.

## Kế hoạch kiểm tra trước/sau đã chốt trước khi xem candidate

Replay sau câu trả lời thứ 1 và thứ 3 của mỗi phiên: tổng 20 đầu vào cố định. Dùng cùng JD/CV/settings/lịch sử, model, temperature và schema. Baseline 0.10 được chạy trước, candidate sau; không đảo thứ tự nên có giới hạn do biến động provider theo thời gian. Không retry để thay mẫu lỗi.

Đọc từng đầu ra theo ba điểm: (1) action/topic hợp lệ và cap được tôn trọng; (2) hỏi đúng một phần còn thiếu của câu vừa hỏi, bám câu trả lời; (3) không lặp toàn câu chính, không giả định trải nghiệm chưa có. Nếu lịch sử đã hết cap thì next_topic là đúng về chính sách dù câu trả lời trước chưa đủ. JSON hợp lệ không tự chứng minh chất lượng ngữ nghĩa. Chỉ kết luận cải thiện ở những điểm có câu hỏi trước/sau minh họa, giữ lại ca chưa đạt.
