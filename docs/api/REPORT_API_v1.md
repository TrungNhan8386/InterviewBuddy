# Report API – v1 (UC-09 View interview report)

Owner: Nguyen Tran Trung Nhan · Jira: SCRUM-186 (SCRUM-187, -189, -190, -191) · Status: **ready for review**

Consumers: Tài (Report page, W7 skeleton → W8 connected), Khang (`/api/practice/generate` reads the lowest criteria), Nhân (PDF and share link, W8–W9).

Code: `src/app/api/report/[sessionId]/route.ts`, `src/lib/report/report-builder.mjs` (scores, speaking indicators, timeline), `src/lib/report/report-summary.mjs` (Gemini summary), `src/lib/report/report-service.mjs`, types in `report-service.d.mts`, prompt in `src/config/prompts/report.json`. No database migration: the `reports` table from the initial schema is used.

Full sample response: [examples/report.response.json](examples/report.response.json). It comes from a real run of `npm run test:report-api` against Supabase and Gemini, with ids replaced. The script creates the questions a few seconds apart, so `durationSeconds` and `offsetSeconds` are tiny in the sample; a real session shows minutes.

## 1. Request

```http
GET /api/report/{sessionId}
GET /api/report/{sessionId}?retry=summary     ← "Try again" for the AI summary only
```

Sign-in as in the [Session API](INTERVIEW_SESSION_API_v1.md): the session cookie, or `Authorization: Bearer <access_token>`. Only the owner of the session can read it.

## 2. What the server does

1. Loads the session, its questions, answers and the per-answer scores in `feedbacks`, all through RLS.
2. Computes the scores, the speaking indicators and the timeline **in code** on every request, so the report is never out of date.
3. On the first request it asks Gemini once for the summary, strengths and areas to improve of the whole session. This counts as 1 call of the daily AI limit.
4. Saves the result in `reports` (one row per session). Later requests reuse the saved summary and make no AI call.
5. If the summary fails (AI busy, timeout, daily limit), the report is still returned with `summary.status = "unavailable"` (UC-09 alternative flow 2). Gemini is tried again only with `?retry=summary`, so opening the report never uses the AI limit by itself.

## 3. Response (200)

```json
{
  "sessionId": "00000000-0000-4000-8000-000000000001",
  "generatedAt": "2026-11-19T10:53:12.000Z",
  "settings": { "type": "technical", "difficulty": "medium", "language": "vi", "targetPosition": "Frontend Developer Intern", "durationMinutes": 15 },
  "overview": {
    "overallScore": 6.6, "scale": 10,
    "mainQuestions": 3, "followUps": 1, "answeredQuestions": 3, "scoredAnswers": 3,
    "startedAt": "…", "endedAt": "…", "durationSeconds": 742,
    "trend": { "previousSessionId": "…", "previousOverallScore": 6.1, "change": 0.5 }
  },
  "criteria": { "content": 7, "structure": null, "clarity": 7, "confidence": 6 },
  "structureApplies": false,
  "speaking": {
    "answeredQuestions": 3, "totalWords": 50, "avgAnswerWords": 17,
    "fillerWords": { "total": 2, "per100Words": 4, "top": [{ "word": "kiểu như", "count": 1 }, { "word": "ừm", "count": 1 }] },
    "paceAvailable": true, "timedAnswers": 1, "wordsPerMinute": 75
  },
  "summary": {
    "status": "ready",
    "text": "Buổi phỏng vấn cho thấy bạn có kiến thức nền tảng tốt về React …",
    "strengths": ["Biết sử dụng công cụ React DevTools …"],
    "improvements": ["Cung cấp các con số đo lường cụ thể …"]
  },
  "timeline": [
    { "position": 1, "kind": "main", "topic": "React rendering", "question": "Bạn xử lý component render chậm như thế nào?",
      "askedAt": "…", "offsetSeconds": 0, "answered": true, "answerWords": 20, "durationSeconds": null,
      "score": 7.5, "scores": { "content": 8, "structure": null, "clarity": 7, "confidence": 7 } }
  ]
}
```

| Field | Meaning, and how the page shows it |
| --- | --- |
| `overview.overallScore` | Average of the per-answer overall scores, 0–10 with one decimal (score ring). |
| `overview.trend` | Change from the previous completed session that has a report. `null` for the first session → show "—" (UC-09 AF3). |
| `criteria` | Average per criterion, 0–10 (bar chart). `structure` is `null` and `structureApplies` is `false` when the interview is not behavioral, because STAR applies only to behavioral questions: hide that bar. |
| `speaking.fillerWords` | Spoken fillers counted in all answers (vi: "à, ừ, ừm, kiểu như, nói chung…"; en: "um, uh, like, you know…"). `top` lists up to 5. |
| `speaking.avgAnswerWords` | Average words per answered question. |
| `speaking.wordsPerMinute` | Speaking pace, only from answers that have a duration (voice answers, Tài's UC-07). `paceAvailable = false` and `null` when every answer was typed → show "not available for typed answers" (UC-09 AF4). |
| `summary` | `status: "ready"` with `text`, 1–3 `strengths` and 1–3 `improvements`, in the session language. `status: "unavailable"` with `errorCode` → show the scores anyway and a "Try again" button that calls `?retry=summary`. |
| `timeline` | Every question in order, including follow-ups and an unanswered last question (`answered: false`, `score: null`). `offsetSeconds` is the time after the interview started (timeline axis). |

`summary.errorCode` values: `AI_DAILY_LIMIT`, `AI_RATE_LIMITED`, `AI_UNAVAILABLE`, `AI_TIMEOUT`, `AI_CONTENT_BLOCKED`, `INVALID_OUTPUT`, `AI_NOT_CONFIGURED`, `AI_CONFIGURATION_ERROR`, and `SUMMARY_NOT_GENERATED` (an earlier attempt failed and no retry was requested).

## 4. Errors

Body: `{ "error": { "code", "message" } }`.

| Status | `error.code` | When | Page |
| --- | --- | --- | --- |
| 401 | `UNAUTHORIZED` | Not signed in | Go to login |
| 404 | `NOT_FOUND` | No such session, **or it belongs to another user**, or the id is not a UUID | "Report not found" (UC-09 AF6) |
| 409 | `SESSION_NOT_COMPLETED` | The interview has not ended | Link back to the interview |
| 409 | `NO_SCORED_ANSWERS` | No answer has been scored yet (no `feedbacks` row) | "Report not ready", Try again (UC-09 AF1) |
| 500 | `SERVER_ERROR` | Database error (details only in the server log) | Try again |

## 5. Dependencies

- **Per-answer scores:** the report reads `feedbacks` (`content_score`, `structure_score`, `clarity_score`, `confidence_score`, `overall_score`, `strengths`, `improvements`), written by Hưng's `/api/evaluate-answer` (UC-08). Until that API is merged, test with rows inserted as in `scripts/test-report-api.mjs`. If `structure_score` becomes nullable for non-behavioral questions, nothing changes here: STAR is already left out for those interviews.
- **Answer duration:** speaking pace uses `answers.duration_seconds`. The Chat page sends it as `durationSeconds` in `POST /api/interview/{id}/answers` ([Persistence API §4](INTERVIEW_PERSISTENCE_API_v1.md)); Tài's voice input must fill it.
- **Practice questions (Khang):** read the two lowest values of `criteria` (ignore `null`), or the saved `reports.criteria_scores`.

## 6. How to test

```bash
npm test                    # tests/report.test.mjs: scores, fillers, pace, timeline, summary, service (no network)
npm run dev                 # then, in another terminal:
npm run test:report-api     # 10 checks against Supabase; makes 1 Gemini call
```

## Change log

| Version | Date | Change |
| --- | --- | --- |
| v1 | 19/11/2026 | First version |
