# Interview Persistence & AI Limit API – v1

Owner: Nguyen Tran Trung Nhan · Jira: SCRUM-79 (SCRUM-80, SCRUM-81, SCRUM-82) · Status: **ready for review**

Consumers: Khang (chat page `/interview/[id]`, SCRUM-95), Hưng (`/api/interview/next`), Tài (Settings: delete CV and history).

Code: `src/app/api/interview/[id]/route.ts`, `src/app/api/interview/[id]/answers/route.ts`, `src/app/api/interview/[id]/end/route.ts`, `src/lib/interview/session-contract.mjs` (validation, types), `src/lib/ai/daily-limit.mjs` (AI limit), `src/lib/interview/error-messages.mjs` (messages for the UI).

Database: migration `src/supabase/migrations/20261105000000_session_resume_ai_limit.sql` (apply after the three earlier migrations).

Authentication is the same as [Session API v1](INTERVIEW_SESSION_API_v1.md): the session cookie, or `Authorization: Bearer <access_token>`. Errors use the same body: `{ "error": { "code", "message", "fields"? } }`.

## 1. Who saves what

| Data | Saved by | When |
| --- | --- | --- |
| Session settings | `POST /api/interview` (Nhân) | Setup form is sent |
| Question | `POST /api/interview/next` (Hưng) | Right after Gemini returns it, before the response |
| Answer | `POST /api/interview/{id}/answers` (this document) | As soon as the user presses Send |
| End of interview | `/api/interview/next` (time or question limit) or `POST /api/interview/{id}/end` (End Interview button) | – |

The browser never writes questions or answers directly. Every turn is in the database before the next one starts, so closing the tab loses nothing.

## 2. Chat page flow

```text
open /interview/[id]
  └─ GET /api/interview/{id}  → look at resume.state
       not_started        → POST /api/interview/next { sessionId, afterAnswerId: null }
       awaiting_answer    → show the last question, wait for the user
       awaiting_question  → POST /api/interview/next { sessionId, afterAnswerId: resume.afterAnswerId }
       finished           → show "Interview finished"

user presses Send
  1. POST /api/interview/{id}/answers { questionId, content, inputMode, durationSeconds }  → answer.id
  2. POST /api/interview/next { sessionId, afterAnswerId: answer.id }
       action "follow_up" / "next_topic" → show question
       action "end"                      → show "Interview finished"

user presses End Interview (after confirming)
  POST /api/interview/{id}/end
```

Keep one request in flight at a time. On `STALE_TURN` or `LEASE_LOST`, reload `GET /api/interview/{id}` and follow `resume` again. `RELOAD_CODES` and `RETRY_CODES` in `error-messages.mjs` list which codes need a reload and which can show a "Try again" button.

## 3. GET /api/interview/{id} – session with all turns (resume)

The response of [Session API v1 §3](INTERVIEW_SESSION_API_v1.md) now also has `startedAt`, `endedAt`, `turns`, `progress` and `resume`:

```json
200 OK
{
  "id": "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b",
  "status": "in_progress",
  "createdAt": "2026-11-05T10:15:00.000Z",
  "startedAt": "2026-11-05T10:16:02.000Z",
  "endedAt": null,
  "settings": { "type": "technical", "difficulty": "medium", "language": "vi", "targetPosition": "Frontend Intern",
                "interviewDate": null, "durationMinutes": 30, "inputMode": "text", "plannedQuestions": 8 },
  "analysis": null,
  "turns": [
    {
      "question": { "id": "q-1", "position": 1, "kind": "main", "topic": "React", "content": "…", "createdAt": "…" },
      "answer": { "id": "a-1", "content": "…", "inputMode": "text", "durationSeconds": null, "createdAt": "…" }
    },
    {
      "question": { "id": "q-2", "position": 2, "kind": "follow_up", "topic": "React", "content": "…", "createdAt": "…" },
      "answer": null
    }
  ],
  "progress": { "mainQuestionsAsked": 1, "mainQuestionsAnswered": 1, "plannedQuestions": 8 },
  "resume": { "state": "awaiting_answer", "questionId": "q-2" }
}
```

| Field | Meaning |
| --- | --- |
| `startedAt` | When the first question was requested; `null` until then. Timer: `startedAt + durationMinutes`. |
| `turns` | Every question in order, each with its answer or `null`. Only the last question can be unanswered. |
| `progress` | For the header "Question 2 of 8" (follow-ups do not count). |
| `resume.state` | `not_started` · `awaiting_answer` (+ `questionId`) · `awaiting_question` (+ `afterAnswerId`) · `finished` |

`resume` can say `awaiting_question` after the time is up; `/api/interview/next` then answers `action: "end"` without calling Gemini.

## 4. POST /api/interview/{id}/answers – save an answer

```json
{
  "questionId": "q-2",
  "content": "Em sẽ dùng AbortController để huỷ request cũ…",
  "inputMode": "text",
  "durationSeconds": null
}
```

| Field | Rule |
| --- | --- |
| `questionId` | Required. Id of the **last** question of this session. |
| `content` | Required. 1–12000 characters after trimming. |
| `inputMode` | `text` (default) or `voice`. |
| `durationSeconds` | Optional, 0–3600 or `null`. Time spent answering; used for speaking pace in the report (week 8). |

Unknown fields are rejected. The server counts the words (`word_count`) itself.

```json
201 Created    (200 OK if this question was already answered)
{ "answer": { "id": "a-2", "questionId": "q-2", "createdAt": "2026-11-05T10:18:40.000Z" }, "alreadySaved": false }
```

Sending the same question again returns the answer that is already stored (`alreadySaved: true`, status 200) and does not change it. So after a network error the page can simply send again.

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `BAD_INPUT` | Body is not valid (see `fields`) |
| 401 | `UNAUTHORIZED` | Not signed in |
| 404 | `NOT_FOUND` | No such session or question, or it belongs to another user |
| 409 | `STALE_TURN` | The question is not the last one any more. Reload the session. |
| 409 | `SESSION_CLOSED` | The interview has already ended |
| 500 | `SERVER_ERROR` | Database error (details are only in the server log) |

## 5. POST /api/interview/{id}/end – end the interview

No body. Marks an in-progress session `completed` and sets `endedAt`. Calling it again, or on a session that the engine already ended, returns the current status.

```json
200 OK
{ "id": "3f1c2a9e-…", "status": "completed", "endedAt": "2026-11-05T10:40:00.000Z" }
```

Errors: `401 UNAUTHORIZED`, `404 NOT_FOUND`, `500 SERVER_ERROR`. A question that Gemini is writing at that moment is not saved: `/api/interview/next` checks the status again before saving and returns `action: "end"`.

## 6. Daily AI call limit (SCRUM-81)

- Each signed-in user can make **`AI_DAILY_LIMIT` Gemini calls per day** (default **100**; set in `.env.local` / Vercel). The day resets at 00:00 Vietnam time.
- What counts: every real Gemini request from `/api/analyze-fit`, `/api/analyze` and `/api/interview/next`. Not counted: invalid input (rejected first), a turn the engine ends by itself (time or question limit), a question returned again for a repeated request, and the manual check `GET /api/health?ai=1`.
- The count is checked before Gemini is called. If it cannot be checked (database error), Gemini is **not** called.
- `/api/analyze` and `/api/analyze-fit` now need a signed-in user (401 otherwise). The analysis page already sends the session cookie.

Errors when the limit is used up:

| Endpoint | Status | `error.code` |
| --- | --- | --- |
| `/api/analyze-fit` | 429 | `DAILY_LIMIT` (message in Vietnamese, includes the limit) |
| `/api/analyze` | 429 | `AI_DAILY_LIMIT` |
| `/api/interview/next` | 429 | `AI_DAILY_LIMIT` |

`429 RATE_LIMIT` / `AI_RATE_LIMITED` still mean the **Gemini** quota of the whole app, not the user's own limit.

Shared code for any new AI endpoint (for example `/api/evaluate-answer` in week 7):

```ts
import { createAiCallCounter, withInterviewerLimit } from "@/lib/ai/daily-limit.mjs";
const provider = withInterviewerLimit(createInterviewerProvider(), createAiCallCounter(auth.supabase));
```

`withAnalysisLimit` wraps an analysis provider the same way. For another kind of provider, call `await createAiCallCounter(supabase)()` just before the Gemini request and map `AiLimitError` to your endpoint's error.

Users can read their own count (for example to show "còn 12 lượt hôm nay"):

```ts
const { data } = await supabase.from("ai_usage_daily").select("calls").eq("usage_date", todayInVietnam()).maybeSingle();
```

## 7. Messages for the user

`src/lib/interview/error-messages.mjs` has a short Vietnamese and English message for every code of the Session API and `/api/interview/next`:

```ts
import { interviewErrorMessage, RELOAD_CODES, RETRY_CODES } from "@/lib/interview/error-messages.mjs";
const { error } = await res.json();
setError(interviewErrorMessage(error?.code, session.settings.language));
```

The analysis page keeps its own messages (`src/lib/analysis/result-text.ts`), now with `DAILY_LIMIT` and `UNAUTHORIZED`.

## 8. Deleting CV and history (Settings page)

The Settings page (Tài, SCRUM-88) calls `DELETE /api/settings/data` with `{ "confirmation": "DELETE" }`. The route runs `delete_own_practice_data()`, which deletes the caller's sessions (with their questions, answers, feedback, reports and generations) and saved analyses in one transaction, and returns `{ sessionsDeleted, analysesDeleted }`.

The AI count (`ai_usage_daily`) is kept on purpose, so deleting history does not reset the daily limit.

## 9. Database objects

| Object | Kind | Access |
| --- | --- | --- |
| `save_interview_answer(session, question, content, input_mode, duration)` | function, security invoker | authenticated; RLS applies; locks the session row like `claim_interview_next` |
| `ai_usage_daily (user_id, usage_date, calls, updated_at)` | table, RLS on | authenticated: read own rows only; no insert/update/delete |
| `consume_ai_call(limit)` | function, security definer | authenticated; only adds to the caller's own count |

## 10. How to test

```bash
npm test                     # unit tests + database tests on PGlite (session-persistence*.test.mjs)
npm run dev                  # then, in another terminal:
npm run test:session-api     # 18 checks against the real Supabase project, no Gemini call
```

The database tests run every migration on an in-memory PostgreSQL and check: answer saving and replay, stale and closed sessions, the daily limit, and that user B cannot read or write user A's sessions, questions, answers, generations or AI count (SCRUM-82).

## Change log

| Version | Date | Change |
| --- | --- | --- |
| v1 | 05/11/2026 | First version: answers, resume, end, daily AI limit, error messages |
| v1.1 | 13/11/2026 | §8 points to the built Settings endpoint (SCRUM-111) |
