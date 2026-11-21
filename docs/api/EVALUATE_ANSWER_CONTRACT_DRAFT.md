# POST /api/evaluate-answer — consumer draft (UC-08)

Status: **DRAFT written by the consumer (Khang, SCRUM-172)** because the provider sample (Hưng, SCRUM-168, due Thu 19 Nov) was not in the repository on 21 Nov. The Answer Feedback screen is built against this shape with mock data. Hưng: please confirm or change it; the UI only needs `src/lib/answer-feedback/types.ts` and `client.ts#parseFeedback` updated.

## Request

```http
POST /api/evaluate-answer
Content-Type: application/json
Cookie: (Supabase session)

{ "sessionId": "<uuid>", "answerId": "<uuid>" }
```

The server loads the question, the answer and the session context (type, language, JD/CV skills) itself, so the browser never sends text that could differ from the saved answer.

**Idempotent:** if a feedback row already exists for `answerId` (table `feedbacks`, `answer_id` is unique), return it with 200 and do not call Gemini again. The chat page calls this again on resume (UC-06 AF8) and on "Try again".

## Response 200

```json
{
  "feedbackId": "7d4c…",
  "answerId": "a1b2…",
  "questionType": "behavioral",
  "scores": { "content": 8, "structure": 7, "clarity": 8, "confidence": 5 },
  "overall": 7.0,
  "evidence": [
    {
      "criterion": "content",
      "quote": "Tôi đề xuất họp 30 phút, mỗi người trình bày ưu nhược điểm rồi cả nhóm bỏ phiếu.",
      "comment": "Hành động cụ thể, có cách làm rõ ràng.",
      "effect": "positive"
    },
    {
      "criterion": "clarity",
      "quote": "Có lẽ lần sau tôi sẽ thống nhất quy ước từ đầu.",
      "comment": "Bài học còn chung chung.",
      "effect": "negative"
    }
  ],
  "strengths": ["…"],
  "improvements": ["…"],
  "outline": {
    "format": "star",
    "situation": "…",
    "task": "…",
    "action": "…",
    "result": "…"
  },
  "createdAt": "2026-11-21T07:36:00.000Z"
}
```

| Field | Rule |
|---|---|
| `questionType` | `hr` \| `technical` \| `behavioral` (the session type) |
| `scores.*` | integer 0–10, same as `feedbacks.*_score` |
| `scores.structure` | `null` when the question is not behavioural (UC-08 AF1). Note: `structure_score` is `not null` in the schema, so the provider decides (for example store 0 and return `null`, or change the column) — please tell Nhân |
| `overall` | 0–10, one decimal; average of the criteria that apply |
| `evidence[].quote` | copied **word for word** from the answer, so the UI can highlight it. Quotes not found in the answer are listed but not highlighted |
| `evidence[].criterion` | `content` \| `structure` \| `clarity` \| `confidence` |
| `evidence[].effect` | `positive` \| `negative` |
| `outline` | `{ "format": "star", situation, task, action, result }` for behavioural, otherwise `{ "format": "key_points", "points": ["…"] }` |

## Errors

Same envelope and codes as `/api/interview/next`: `{ "error": { "code": "…", "message": "…" } }`.

| Status | code | UI |
|---|---|---|
| 400 | BAD_INPUT | message, Continue without feedback |
| 401 | UNAUTHORIZED | message |
| 404 | NOT_FOUND (answer missing or not the user's) | message, Continue without feedback |
| 422 | AI_CONTENT_BLOCKED | message, Try again / Continue |
| 429 | AI_DAILY_LIMIT / AI_RATE_LIMITED | message, Try again / Continue |
| 502 | INVALID_OUTPUT (after the 1 server retry, SCRUM-170) / AI_UNAVAILABLE | message, Try again / Continue |
| 504 | AI_TIMEOUT | message, Try again / Continue |

A 404/405 without an error body (route not deployed yet) is shown as "scoring is not available yet" with Continue.
