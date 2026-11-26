# Practice API – v1 (UC-10 Practice targeted questions)

Owner: Nguyễn Đặng Hoàng Khang · Jira: SCRUM-178 (backend), SCRUM-203 / SCRUM-204 (Report page section) · Status: **ready for review**

Consumers: Report page (`components/practice/PracticeQuestions.tsx`, inside Tài's `ReportView`), History (W9, UC-11: practice sessions are marked), Hưng (planning agent, UC-13, can read the weak criteria).

Code: `src/app/api/practice/generate/route.ts`, `src/app/api/practice/start/route.ts`, `src/lib/practice/practice-builder.mjs` (weak criteria, prompt input, output validation), `src/lib/practice/practice-provider.mjs` (Gemini), `src/lib/practice/practice-service.mjs` (Supabase + flow), prompt in `src/config/prompts/practice.json`.

Database: **new migration** `src/supabase/migrations/20261124000000_practice_questions.sql` (apply after `20261122000000_answer_feedback.sql`). Until it is applied both routes answer `503 DATABASE_NOT_READY` and the page shows "not set up in the database yet".

Sign-in as in the [Session API](INTERVIEW_SESSION_API_v1.md): the session cookie, or `Authorization: Bearer <access_token>`. Only the owner of the session can read or start anything (RLS).

## 1. POST /api/practice/generate – get or create the practice set

```http
POST /api/practice/generate
Content-Type: application/json

{ "sessionId": "00000000-0000-4000-8000-000000000001" }
```

What the server does (UC-10 basic flow):

1. Loads the session; it must be `completed`.
2. If questions were already generated for this session, returns them (`alreadySaved: true`, status 200) **without an AI call** (UC-10 AF1).
3. Otherwise computes the criterion averages with the same code as the report (`buildReport`), picks the **two lowest** criteria (STAR is `null` outside behavioral interviews and is skipped; ties keep the order content → structure → clarity → confidence).
4. Counts 1 call of the daily AI limit, asks Gemini for 3–5 questions per criterion in the session language, validates them (length, no duplicates of each other or of questions already asked, guardrails).
5. Saves them in `practice_questions` (one statement, so either the whole set or nothing is saved) and returns them (status 201).

The prompt receives only the settings, the two criteria with their scores, the questions already asked and the per-answer "areas to improve". No CV, JD or answers.

`GET /api/practice/generate?sessionId=…` returns the saved set, or `{ "sessionId", "state": "not_generated", "groups": [] }`. It never calls the AI.

## 2. Response (200 / 201)

```json
{
  "sessionId": "00000000-0000-4000-8000-000000000001",
  "state": "ready",
  "language": "vi",
  "generatedAt": "2026-11-24T08:00:00.000Z",
  "noMajorWeakness": false,
  "alreadySaved": false,
  "groups": [
    {
      "criterion": "clarity",
      "score": 5.2,
      "questions": [
        { "id": "…", "position": 1, "question": "Giải thích ngắn gọn cho người không chuyên: React re-render khi nào?",
          "tip": "Trả lời ý chính trong câu đầu, sau đó mới thêm ví dụ.", "practiceSessionId": null }
      ]
    },
    { "criterion": "confidence", "score": 6, "questions": [ "… 3 to 5 items …" ] }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `groups` | Exactly 2, weakest first. `criterion` is one of `content`, `structure`, `clarity`, `confidence` (same names as UC-08 and `reports.criteria_scores`). |
| `score` | Average of that criterion in the report when the set was generated (0–10). |
| `noMajorWeakness` | `true` when both scores are 7.5 or more → the page shows "no major weakness, these questions help you improve further" (UC-10 AF3). |
| `questions[].practiceSessionId` | Latest practice session started from the question, or `null`. The page shows "Continue practice" when set. |

## 3. POST /api/practice/start – start a practice session from a question

```json
{ "practiceQuestionId": "…" }
→ 201 { "sessionId": "…", "resumed": false }
→ 200 { "sessionId": "…", "resumed": true }   (that practice is still running: open it again)
```

The database function `start_practice_session()` creates a new `interview_sessions` row with the same type, difficulty, language, target position, JD, CV and answer mode as the reported interview, `duration_minutes = 15`, `planned_questions = 3`, and `source_practice_question_id` set. The chosen question is saved as question 1 (`kind = 'main'`, topic "Luyện tập: …" / "Practice: …"). The page then opens `/interview/{sessionId}`: the chat page sees `resume.state = awaiting_answer`, shows the question, and the normal flow continues (save answer → feedback (UC-08) → `/api/interview/next`). No AI call happens in this route.

## 4. Errors

Body: `{ "error": { "code", "message", "resetAt"? } }`.

| Status | `error.code` | When | Page |
| --- | --- | --- | --- |
| 400 | `BAD_INPUT` | Body is not `{ sessionId }` / `{ practiceQuestionId }` | – |
| 401 | `UNAUTHORIZED` | Not signed in | Sign in again |
| 404 | `NOT_FOUND` | No such session/question, **or it belongs to another user**, or not a UUID | Message |
| 409 | `SESSION_NOT_COMPLETED` | Interview not ended | Message, no retry |
| 409 | `NOT_ENOUGH_SCORES` | No scored answer, or fewer than 2 criteria with a score | Message, no retry |
| 429 | `AI_DAILY_LIMIT` | Daily AI limit used up (`resetAt` when known) | Message without "Try again" (UC-10 AF4) |
| 503 | `AI_RATE_LIMITED`, `AI_UNAVAILABLE`, `AI_TIMEOUT` | Temporary AI problem | "Try again" |
| 502 | `AI_CONTENT_BLOCKED`, `INVALID_OUTPUT` | AI output blocked or unusable | "Try again" |
| 500 | `AI_NOT_CONFIGURED`, `AI_CONFIGURATION_ERROR` | `GEMINI_API_KEY` / model missing or wrong on the server | Tell the team |
| 503 | `DATABASE_NOT_READY` | Migration not applied | Tell the team |
| 500 | `SERVER_ERROR` | Database error | "Try again" |

On every error nothing is saved and the rest of the report stays usable (UC-10 post-condition Failure).

## 5. Testing

```bash
npm test                         # tests/practice.test.mjs: 9 tests, includes the SQL on PGlite (RLS, start, resume)
NEXT_PUBLIC_PRACTICE_MODE=mock   # in .env.local: sample questions on /reports/{id}, no Gemini, no database
# sample states: /reports/{id}?practice=strong | error | limit | few
```

Environment: optional `GEMINI_PRACTICE_MODEL` (empty = `GEMINI_MODEL`). No new secret.

## Change log

| Version | Date | Change |
| --- | --- | --- |
| v1 | 24/11/2026 | First version (SCRUM-178, SCRUM-203, SCRUM-204) |
