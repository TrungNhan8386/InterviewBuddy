# Nghiên cứu xử lý câu trả lời mơ hồ, hỏi lặp và độ trễ của InterviewBuddy

Ngày đối chiếu nguồn: **05/11/2026**, múi giờ Asia/Bangkok.

Đây là kết quả tìm tài liệu và đề xuất áp dụng cho SCRUM-93/SCRUM-94. Chưa thay đổi code, model, schema hoặc tiêu chí nghiệm thu; chưa chạy thêm Gemini, tải bộ dữ liệu hay tái lập thí nghiệm. Các nhận định về bài báo được phân biệt với phương án do dự án đề xuất.

## 1. Bài toán đang còn thiếu

| Vấn đề trong dự án | Điều đã có | Khoảng trống cần xử lý |
| --- | --- | --- |
| “Dạ có”, “yes” bị chuyển chủ đề dù câu chính yêu cầu giải thích | Prompt v0.8 hướng dẫn hỏi sâu câu trả lời mơ hồ | Chưa có bộ ca chính xác cho các câu xác nhận ngắn; phân loại vẫn do model quyết định khi server cho phép cả hai action. |
| Câu hỏi mới khác chữ nhưng lặp ý câu chính | Chặn trùng sau chuẩn hóa; gửi bốn lượt gần nhất và summary; prompt tránh lặp | Chưa có kiểm tra trùng nghĩa độc lập; chưa biểu diễn rõ khía cạnh đã hỏi và phần thông tin còn thiếu. |
| Phản hồi 2–3 giây, đôi lúc chờ đến timeout 30 giây | Streaming được triển khai cục bộ; provider có timeout và hủy | Chưa tích hợp vào Chat chính, chưa đo toàn luồng Chat/Supabase chung; thiếu phép đo để phân biệt chờ upstream, đọc stream, kiểm tra và lưu. |

Đối chiếu tại nhánh local `feat/scrum-94-interview-streaming`: `interviewer-prompt.mjs`, `interviewer-contract.mjs`, `conversation-memory.mjs`, `interviewer-provider.mjs` và các báo cáo SCRUM-93/94. Mọi dòng file bên dưới tính từ gốc repository, không phải xác nhận bản đang triển khai trên máy của thành viên khác.

## 2. Tám bài được chọn

### R1. CLAM — phát hiện nhu cầu làm rõ trước khi trả lời

Lorenz Kuhn, Yarin Gal, Sebastian Farquhar. **CLAM: Selective Clarification for Ambiguous Questions with Generative Language Models**. arXiv:2212.07769, 2022; bản v2 năm 2023. Ghi nhận theo bản arXiv, không tự gán một hội nghị đã phản biện.

- [Trang bài](https://arxiv.org/abs/2212.07769) · [Toàn văn HTML, mục 3](https://arxiv.org/html/2212.07769v2#S3) · DOI: `10.48550/arXiv.2212.07769`.
- Nội dung liên quan: CLAM phân loại đầu vào có cần làm rõ, rồi mới đặt câu hỏi làm rõ; dùng ví dụ trong prompt cho bước phân loại.
- Giới hạn: bài nghiên cứu câu hỏi của người dùng trong QA. Việc chuyển sang đánh giá **câu trả lời của ứng viên** là đề xuất điều chỉnh của InterviewBuddy, chưa được bài chứng minh cho tiếng Việt/Gemini.

### R2. followQG — hỏi phần chưa được trả lời

Pooja Rao S B, Manish Agnihotri, Dinesh Babu Jayagopi. **Improving Asynchronous Interview Interaction with Follow-up Question Generation**. IJIMAI, 2021, 6(5), 79–89.

- [Nguồn lưu trữ của trường](https://reunir.unir.net/items/561e2266-63c3-4f36-b340-e06e82af83cf) · [Toàn văn PDF](https://reunir.unir.net/server/api/core/bitstreams/b8d26765-504a-40df-829b-babff81f9248/content) · [Repo tác giả](https://github.com/poorao/followQG) · DOI: `10.9781/ijimai.2021.02.010`.
- Nội dung liên quan: sinh follow-up dựa trên cặp câu hỏi–câu trả lời; follow-up cần tìm thêm thông tin, thay vì hỏi điều đã được trả lời trong đầu vào. Phần phương pháp dùng các bộ ba question/response/follow-up.
- Giới hạn: mô hình và corpus riêng, dữ liệu nhỏ, bối cảnh tiếng Anh. Không chuyển số liệu relevance trong bài thành độ chính xác của InterviewBuddy. Chưa nhập dữ liệu từ repo vào dự án.

### R3. Conversate — tách câu chính và câu hỏi sâu

Taufiq Daryanto, Xiaohan Ding, Lance T. Wilhelm, Sophia Stil, Kirk McInnis Knutsen, Eugenia H. Rho. **Conversate: Supporting Reflective Learning in Interview Practice Through Interactive Simulation and Dialogic Feedback**. Bản arXiv năm 2024; toàn văn gắn DOI ACM.

- [Toàn văn HTML](https://arxiv.org/html/2410.05570) · DOI ACM: `10.1145/3701188` · arXiv: `2410.05570`.
- Nội dung liên quan: mục 3.2 dùng câu chính và follow-up thích ứng; phụ lục B.1.2 yêu cầu follow-up khác các câu đã hỏi. Nghiên cứu giới hạn một follow-up mỗi câu chính.
- Giới hạn: nghiên cứu định tính với 19 người; không phải bằng chứng đạt tỷ lệ phân loại hay độ trễ cho hệ thống này. Giới hạn một follow-up là thiết kế thí nghiệm của tác giả, không thay trần follow-up easy/medium/hard hiện tại.

### R4. Sentence-BERT — so sánh ý nghĩa câu hỏi

Nils Reimers, Iryna Gurevych. **Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks**. EMNLP-IJCNLP 2019, 3982–3992.

- [Trang ACL và toàn văn](https://aclanthology.org/D19-1410/) · DOI: `10.18653/v1/D19-1410`.
- Nội dung liên quan: biểu diễn câu bằng vector và so sánh độ gần nghĩa qua cosine similarity.
- Giới hạn: độ giống ngữ nghĩa không đồng nghĩa hai câu hỏi đo đúng cùng một khía cạnh. Không lấy một ngưỡng cosine tùy ý làm tiêu chuẩn chặn; cần dữ liệu gán nhãn trong miền phỏng vấn.

### R5. Multilingual sentence embeddings — bổ sung cho tiếng Việt/Anh

Nils Reimers, Iryna Gurevych. **Making Monolingual Sentence Embeddings Multilingual using Knowledge Distillation**. EMNLP 2020, 4512–4525.

- [Trang ACL và toàn văn](https://aclanthology.org/2020.emnlp-main.365/) · DOI: `10.18653/v1/2020.emnlp-main.365`.
- Nội dung liên quan: đưa các câu tương đương ở nhiều ngôn ngữ vào không gian embedding được căn chỉnh.
- Giới hạn: bài báo không tự bảo đảm mọi checkpoint đều phù hợp tiếng Việt kỹ thuật của nhóm. Phải xác minh model cụ thể, tài nguyên chạy và độ chính xác trên vi/en trước khi thêm dependency hay dịch vụ embedding.

### R6. MMR — chọn nội dung mới nhưng vẫn liên quan JD

Jade Goldstein, Jaime Carbonell. **Summarization: (1) Using MMR for Diversity-Based Reranking and (2) Evaluating Summaries**. TIPSTER 1998, 181–195.

- [Trang ACL](https://aclanthology.org/X98-1025/) · [PDF](https://aclanthology.org/X98-1025.pdf) · DOI: `10.3115/1119089.1119120`.
- Nội dung liên quan: kết hợp độ liên quan và độ mới để giảm thông tin dư thừa khi xếp hạng.
- Giới hạn: bài nghiên cứu truy hồi/tóm tắt. Áp dụng cách xếp hạng này vào kế hoạch câu hỏi là thiết kế của dự án; không có ngưỡng hay trọng số chuẩn cho InterviewBuddy trong bài.

### R7. LongLLMLingua — giảm context theo thông tin liên quan

Huiqiang Jiang, Qianhui Wu, Xufang Luo, Dongsheng Li, Chin-Yew Lin, Yuqing Yang, Lili Qiu. **LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios via Prompt Compression**. ACL 2024, 1658–1677.

- [Trang ACL](https://aclanthology.org/2024.acl-long.91/) · [PDF, gồm phần Limitation](https://aclanthology.org/2024.acl-long.91.pdf) · DOI: `10.18653/v1/2024.acl-long.91`.
- Nội dung liên quan: nén context có xét câu hỏi và vị trí thông tin để giảm chi phí/độ trễ trong các thí nghiệm long-context.
- Giới hạn: bước nén cũng tốn tính toán; bản nén phụ thuộc câu hỏi có thể phải tính lại. Chưa có benchmark cho Gemini của nhóm, không suy ra một mức tăng tốc cụ thể. Không cắt mất phủ định hay câu trả lời mới nhất để đạt tốc độ.

### R8. DistServe — tách phép đo thời gian chờ chữ đầu và sinh tiếp

Yinmin Zhong, Shengyu Liu, Junda Chen, Jianbo Hu, Yibo Zhu, Xuanzhe Liu, Xin Jin, Hao Zhang. **DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving**. OSDI 2024.

- [Nguồn USENIX](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin) · [PDF](https://www.usenix.org/system/files/osdi24-zhong-yinmin.pdf).
- Nội dung liên quan: phân biệt time-to-first-token và time-per-output-token; hệ thống tối ưu hai giai đoạn prefill/decoding trên hạ tầng phục vụ model.
- Giới hạn: nhóm gọi hosted Gemini và không điều khiển GPU/scheduler bên trong. Phần áp dụng ngay là tư duy đo đạc và xác định nút thắt, không phải triển khai DistServe vào Next.js hoặc cam kết hết timeout. Chữ đầu hiển thị ở browser còn bao gồm mạng, parser và render, khác TTFT của model.

## 3. Phương án đề xuất cho SCRUM-93

Phần này là thiết kế của InterviewBuddy suy ra từ R1–R6, chưa phải tính năng đã triển khai.

### 3.1. Ra quyết định theo câu hỏi đang hỏi

Thêm tầng phân loại có xét **câu hỏi + câu trả lời + thông tin còn thiếu + giới hạn server**. Không dựa riêng số từ và không xem mọi “yes” là câu trả lời mơ hồ.

| Câu hỏi và câu trả lời mẫu do dự án tạo | Diễn giải | Hành động dự kiến khi còn ngân sách |
| --- | --- | --- |
| “Bạn xử lý hai request mua món hàng cuối cùng thế nào?” → “Dạ có” | Không cung cấp cơ chế được hỏi | `follow_up` hỏi một cơ chế bảo vệ cập nhật đồng thời; không hỏi lại toàn bộ câu chính. |
| “How would you prevent overselling?” → “Yes” | Xác nhận không trả lời yêu cầu giải thích | `follow_up` làm rõ phương án kiểm soát đồng thời. |
| “Have you used PostgreSQL?” → “Yes” | Đã trả lời đúng câu hỏi đóng, nhưng chưa cung cấp ví dụ nếu mục tiêu phỏng vấn cần đánh giá kinh nghiệm | Không gán sai thành né tránh; có thể hỏi một ví dụ cụ thể, hoặc chuyển theo kế hoạch. |
| Câu hỏi kỹ thuật → “I do not know; please move on” | Không biết và muốn bỏ qua | `next_topic`; không ép hỏi sâu. |
| Câu trả lời có cơ chế và cách kiểm thử rõ | Đủ thông tin cho khía cạnh hiện tại | `next_topic`, trừ khi có một chi tiết thực sự chưa làm rõ và đáng khai thác. |
| Câu trả lời mơ hồ nhưng đã hết trần follow-up | Bị giới hạn bởi server | `next_topic`; không đánh dấu đây là lỗi phân loại. |

Nhãn nội bộ đề xuất: `acknowledgement_only`, `insufficient_detail`, `explicit_decline`, `developed`, kèm `missingAspect`. Model không được cung cấp bộ đếm hoặc tự sửa giới hạn server. Với các ca xác nhận thuần túy rõ ràng và câu hỏi mở đã được hệ thống đánh dấu, server có thể giới hạn `allowedActions` về `follow_up`; các ca nhập nhằng cần đánh giá theo ngữ cảnh. Không thêm lượt gọi classifier Gemini nối tiếp mặc định vì tăng độ trễ/chi phí; thử kết hợp phân loại và sinh câu trong một lần gọi, hoặc dùng quy tắc hẹp trước khi gọi.

Nếu thay schema nội bộ, phải cập nhật validator, khai báo kiểu, metadata, parser streaming và test cùng nhau. Không tự đưa nhãn phân loại hoặc reason lên UI.

### 3.2. Phân biệt cùng chủ đề với lặp câu hỏi

Biểu diễn mục tiêu câu hỏi dưới dạng **năng lực + khía cạnh + phần thông tin muốn biết**. Ví dụ cùng chủ đề transaction nhưng hỏi “cơ chế cập nhật nguyên tử” và hỏi “cách kiểm thử hai giao dịch chạy đồng thời” có thể là hai khía cạnh khác nhau. Chỉ đổi từ “xử lý overselling” sang “tránh bán quá tồn kho” vẫn là hỏi lặp.

Giữ kiểm tra trùng sau chuẩn hóa hiện tại; bổ sung embedding đa ngôn ngữ để tìm các cặp đáng nghi trong **toàn bộ lịch sử**, rồi xem cả khía cạnh đã hỏi/đã trả lời. `follow_up` được giữ chủ đề, nhưng cần thêm thông tin. `next_topic` ưu tiên năng lực/khía cạnh JD chưa được khai thác. Không loại một follow-up hợp lệ chỉ vì cosine similarity cao.

Áp dụng ý tưởng MMR ở bước chọn trọng tâm mới trong `question-plan.mjs`: cân bằng liên quan JD với mức thông tin mới so với các câu trước. Chọn trọng tâm trước khi sinh để giảm phải gọi model tạo lại. Giới hạn schema/hard policy vẫn do code thực thi.

Phát hiện trùng nghĩa chỉ sau khi câu hỏi đã sinh đầy đủ có thể xung đột với mục tiêu streaming sớm. Nếu yêu cầu không cho hiện bất kỳ câu trùng nào, cần giữ draft trong buffer đến khi qua kiểm tra, rồi đo lại thời gian chữ đầu. Nếu cho hiện draft tạm, phải có trạng thái chưa xác nhận và xóa khi lỗi; không được báo là câu đã lưu. Không tự retry Gemini nhiều lần để đạt một câu không trùng.

## 4. Phương án đề xuất cho SCRUM-94

R7 gợi ý thử giảm context theo trọng tâm; R8 gợi ý tách phép đo. Các bước cụ thể dưới đây là kế hoạch kỹ thuật, chưa phải kết quả tối ưu.

1. Nối `requestInterviewNext` vào Chat chính và đo thao tác người dùng → chữ câu hỏi thật hiển thị → complete đã kiểm tra/lưu. Không dùng spinner, ready event hoặc replay thay cho request sinh mới.
2. Ghi các khoảng thời gian: Auth/đọc phiên; xây context; bắt đầu gọi upstream; nhận frame đầu; nhận chữ câu hỏi đầu; kết thúc upstream; kiểm tra; lưu; browser render/complete. Không ghi API key, CV hoặc câu trả lời thô vào telemetry. Thời gian từ gọi upstream đến frame đầu vẫn gồm mạng và chờ dịch vụ, không được tự gọi là thời gian GPU prefill.
3. So sánh baseline hiện tại với context ngắn hơn trên cùng bộ mẫu. Giữ nguyên câu hỏi/câu trả lời mới nhất, chi tiết phủ định và giới hạn server; giảm JD/CV/lịch sử cũ có kiểm soát. Nếu thêm model nén hoặc embedding, phải tính cả thời gian của bước đó vào kết quả cuối.
4. Giữ phân biệt lỗi `AI_TIMEOUT`, `AI_UNAVAILABLE`, `AI_RATE_LIMITED`, mất stream và lỗi lưu. Dữ liệu chưa có để quy mọi lần 30 giây về độ dài CV hoặc model. Hủy và retry có chủ đích phải giữ chống sinh/lưu trùng hiện có.
5. Tích hợp thông báo chậm 5 giây và chờ kéo dài 10 giây theo tài liệu mục tiêu; giữ timeout upstream 30 giây hiện tại cho tới khi có số liệu hỗ trợ thay đổi. Giảm timeout chỉ làm lỗi đến sớm hơn, không tự làm model chạy nhanh hơn.

Đánh giá theo [mốc làm việc SCRUM-94](../test/SCRUM-94_ACCEPTANCE_TARGETS_VI.md): ít nhất 20 lượt sinh mới trên Chat đã đăng nhập và Supabase chung; báo tỷ lệ nhanh-và-hợp-lệ, hoàn tất-và-lưu, lỗi và p50/p95. Các mốc này do dự án đặt, không lấy từ DistServe hoặc SLA Google. Chưa có đo mới trong lần nghiên cứu này.

## 5. Files dự kiến khi triển khai

| Khu vực | Thay đổi đề xuất |
| --- | --- |
| `src/lib/interview/interviewer-contract.mjs` | Giữ giới hạn cứng; kiểm tra hợp đồng nếu thêm nhãn nội bộ, không nhận bộ đếm từ client. |
| `src/lib/interview/interviewer-prompt.mjs` | Ví dụ đối lập yes/no theo loại câu hỏi; mục tiêu follow-up là phần thông tin còn thiếu. |
| `src/lib/interview/question-plan.mjs` | Theo dõi khía cạnh đã khai thác, chọn trọng tâm mới có xét tính mới. |
| Module mới về answer policy / question similarity | Quy tắc hẹp cho xác nhận ngắn; đánh giá embedding đa ngôn ngữ và kiểm tra trùng ý. Chưa chọn package/model/ngưỡng. |
| `src/lib/interview/next-service.mjs` và `interviewer-provider.mjs` | Nối policy/validation, ghi các khoảng thời gian và phân biệt lỗi; giữ claim/finish/release và chống retry tự động. |
| `src/lib/interview/stream-protocol.mjs`, `next-stream-client.mjs`, Chat UI | Đồng bộ schema nếu đổi; giữ draft và complete tách biệt; kiểm tra ảnh hưởng của quality gate lên latency. |
| Fixtures và tests về flow/stream/browser | Thêm ca mơ hồ chính xác, cặp trùng ý, follow-up hợp lệ và benchmark toàn luồng. |

Không mặc định cần migration. Nếu muốn lưu trường mới trong Postgres, phải review schema/ownership/migration riêng; không sửa database chung trong task tìm nguồn này.

## 6. Cách kiểm chứng đề xuất trước khi nhận là đã sửa

Các cỡ mẫu sau là lựa chọn thử nghiệm của dự án, không phải yêu cầu của bài báo:

- Tạo tối thiểu 40 ca câu hỏi–câu trả lời, cân bằng vi/en, câu xác nhận ngắn, thiếu chi tiết, đủ chi tiết, xin bỏ qua và hết trần follow-up. Gán nhãn trước khi chạy; tách ví dụ dùng trong prompt khỏi tập đánh giá.
- Tạo tối thiểu 30 cặp câu hỏi: khác chữ cùng ý, cùng chủ đề khác khía cạnh, trùng vi/en, và không liên quan. Dùng tập phát triển chọn ngưỡng; giữ riêng tập kiểm tra. Báo cả lỗi bỏ sót trùng và lỗi chặn nhầm follow-up.
- Đánh giá riêng action đúng, câu hỏi bám phần thiếu, không hỏi điều đã trả lời và không gán kinh nghiệm không có. Một câu đúng action vẫn có thể sai nội dung.
- Với các ca quan trọng, có ít nhất hai thành viên review độc lập rồi đối chiếu bất đồng; ghi nhận ai thực sự đã review. LLM judge chỉ là hỗ trợ, không tự thay xác nhận của nhóm.
- Benchmark độ trễ tối thiểu theo SCRUM-94, tính cả ca chậm/lỗi; không retry rồi thay thế kết quả không đạt. Không cộng lượt replay vào mẫu sinh mới.

Ưu tiên triển khai: **policy cho câu xác nhận ngắn + bộ test** → **phân biệt khía cạnh và trùng nghĩa** → **Chat thật + telemetry** → **tối ưu context nếu số đo cho thấy cần**. Chưa có cơ sở yêu cầu fine-tune Gemini, thêm hệ nhiều agent hoặc chuyển sang tự phục vụ model.

## 7. Phạm vi kiểm tra nguồn

Đã mở nguồn gốc tại arXiv, ACL Anthology, USENIX và kho học thuật của UNIR; đối chiếu metadata và phần phương pháp liên quan. PDF toàn văn của followQG, SBERT, multilingual embeddings, MMR, LongLLMLingua và DistServe đọc được qua công cụ web; CLAM/Conversate có HTML toàn văn. Chưa tải tám PDF vào repository, chưa chạy code của tác giả và chưa kiểm tra chuyên gia.

Một kết quả Scientific Reports về AI interviewer không được chọn làm bằng chứng vì trang toàn văn chuyển sang cổng xác thực khi kiểm tra. Tài liệu tham khảo cũ của nhóm vẫn được giữ nguyên; bộ nguồn này tập trung vào lỗi hiện tại.
