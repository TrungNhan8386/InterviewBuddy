# Answer feedback API and integration guide

SCRUM-166 and subtasks SCRUM-167–171 provide server-side UC-08 evaluation. This contract is for Khang's Feedback page and Nhan's Report backend. It does not change the existing Chat page: that integration belongs to the Feedback/Chat work and must follow the sequence below.

## Endpoints and authentication

Use the signed-in user's normal Supabase cookie, or `Authorization: Bearer <user_access_token>`. Never send a Gemini key or service-role key from the browser. All responses use `Cache-Control: no-store`. The API loads the saved answer, question, round type and language from the database; clients cannot supply or override them.

| Method | URL | Body or query | Result |
| --- | --- | --- | --- |
| POST | `/api/evaluate-answer` | `{"answerId":"<saved-answer-uuid>"}` | 201 for a newly saved feedback; 200 for the same stored feedback on replay |
| GET | `/api/evaluate-answer?answerId=<saved-answer-uuid>` | No body | 200 with stored feedback, or `feedback: null` and state `not_evaluated`, `generating` or `failed`. Does not call Gemini or consume AI allowance. |

Only one `answerId` is accepted. Unknown fields, malformed JSON or bodies exceeding 2 KiB are rejected. A foreign answer is indistinguishable from an unknown answer (404). No other user's context is returned.

See [request](examples/evaluate-answer.request.json), [behavioral response](examples/evaluate-answer.behavioral.response.json), [technical response](examples/evaluate-answer.technical.response.json), and [VS Code HTTP requests](examples/evaluate-answer.http). These are synthetic contract examples, not measured AI quality results. Shared TypeScript interfaces are in `src/lib/feedback/types.ts`.

## Connect Chat to Feedback and Continue

1. Save the submitted answer with the existing `POST /api/interview/{sessionId}/answers`. Keep its confirmed `answer.id`. A retry uses the identical saved answer.
2. Show a feedback waiting state. Call `POST /api/evaluate-answer` with `{answerId: answer.id}`. Do not call `/api/interview/next` yet.
3. Render the saved `feedback` on success. Use `feedback.labels`, `feedback.language` and `feedback.disclaimer`. Render generated strings and quotations as plain text; do not use HTML injection. The UI also loads question text, answer text, date and available duration from the existing session API using the returned question/answer IDs.
4. Show criterion score, reason and exact `quotes`. When `scores.star.applicable === false`, display `labels.notApplicable`; do not render `null` as zero. Show the four STAR outline sections for behavioral questions or `key_points` for technical/HR.
5. Preserve `answer.id` while the user reads feedback. Only clicking **Continue Interview** calls the existing next endpoint with `{sessionId, afterAnswerId: answer.id}`. A failed feedback must still offer continuing without a score.
6. On refresh/resume after a saved answer, first GET its feedback. If already saved, display it; if not evaluated or failed, offer evaluation or continuation. If generation is busy, disable duplicate submission and retry after a short wait. Do not poll indefinitely: after a failed or disconnected POST, read stored feedback before retrying POST.
7. Report/History opens use GET only and return to their own origin. Back to Question views the saved answer without editing it. Similar-question practice must keep the original interview anchor and feedback; practice integration belongs to UC-10.

The current main Chat code still advances immediately after saving an answer. This PR supplies the backend contract rather than silently taking over Khang's UI task. End-to-end UC-06 → UC-08 → Continue acceptance remains pending that integration.

## Scoring and response semantics

`src/config/feedback-rubric.json` contains versioned criterion definitions, observable anchors, equal weights, localized labels and the notice. `src/config/prompts/feedback.json` contains versioned generation instructions. Restart/rebuild after changing them.

All applicable criterion scores are integers 0–10. Behavioral uses Content, STAR, Clarity and Confidence. Technical and HR omit STAR. The server computes the weighted mean of applicable scores and rounds to one decimal: `(8+6+7+5)/4 = 6.5`; with STAR inapplicable, `(8+7+5)/3 = 6.7`. Weights currently equal one; they are an implementation default submitted for review with the UC-08 draft, not a recorded team approval. A new rubric revision must also update the migration's accepted rubric version and compatibility checks.

Confidence is explicitly `text_estimated`: only textual specificity, personal ownership and calibrated certainty. It does not infer voice, emotions, personality or actual psychological confidence. Each applicable criterion needs a reason and 1–3 exact substrings of the saved answer. Quotes retain their original language; other generated text is requested in the selected language. Schema and substring checks do not prove the semantic correctness or language of every generated statement; human quality acceptance is still required.

Invalid scores, absent required fields, invented quotes, invalid STAR applicability and unsafe generated commentary are rejected. The provider receives a JSON Schema and the server independently validates the result. Prompt injection in answer/JD/question text is treated as untrusted data. The lexical safety check is defense in depth, not a complete semantic safety classifier.

## Retry and error handling

The generation budget defaults to **10,000 ms**, shared by at most two provider attempts. `GEMINI_FEEDBACK_TIMEOUT_MS` allows 1,000–45,000 ms. This is a time budget, not proof of the staging p95 requirement. Every actual attempt consumes the existing daily AI allowance; replay and GET consume none.

Automatically retry once only for invalid output or a temporary provider failure while time remains. Do not automatically retry daily allowance exhaustion, provider rate limits, safety blocks, configuration errors, cancellation or an expired deadline. An active 60-second database reservation prevents parallel requests from billing two generations. A stale token cannot save over a newer generation. No transaction stays open across Gemini calls.

| HTTP | Error code | UI action |
| --- | --- | --- |
| 400 | `BAD_INPUT` | Fix the request; do not repeat identical invalid input. |
| 401 | `UNAUTHORIZED` | Prompt sign-in and restore the saved interview. |
| 404 | `NOT_FOUND` | Explain the saved answer is unavailable; return to interview/history. |
| 409 | `GENERATION_IN_PROGRESS` | Keep the saved answer and waiting state; read/retry shortly without parallel POSTs. |
| 409 | `LEASE_LOST`, `STALE_ANSWER` | Reload the answer and stored feedback before retry. |
| 409 | `SESSION_CONTEXT_INVALID`, `FEEDBACK_FORMAT_UNSUPPORTED` | Explain that this saved item needs review. Older feedback is preserved, not silently overwritten. |
| 422 | `AI_CONTENT_BLOCKED` | Explain the AI refusal; keep answer and allow continuing without feedback. |
| 429 | `AI_DAILY_LIMIT` | Explain the daily allowance resets at 00:00 Vietnam time; allow continuation without feedback. |
| 429 | `AI_RATE_LIMITED` | Explain provider rate limiting; wait or continue. Distinguish this from app allowance. |
| 502, 504 | `INVALID_OUTPUT`, `AI_UNAVAILABLE`, `AI_TIMEOUT` | Offer manual Try again or Continue without feedback; preserve answer. |
| 503 | `DATABASE_NOT_READY`, `AI_NOT_CONFIGURED`, `AI_CONFIGURATION_ERROR` | Show a configuration message and continuation option; notify the integrator. |
| 408 | `REQUEST_CANCELLED` | Read stored feedback on resumption before another evaluation. |
| 500 | `SERVER_ERROR` | Read saved feedback first: a lost save acknowledgement can hide a committed result. If none appears, retry after the reservation expires; a new AI evaluation can consume allowance. |

The stable error envelope is `{"error":{"code":"INVALID_OUTPUT","message":"..."}}`. UI labels and error messages should be localized by error code; backend diagnostic messages default to English. Never show raw provider/database errors. Never substitute zero for an unavailable feedback or include missing feedback as zero in report averages.

## Migration and server configuration

Apply `src/supabase/migrations/20261122000000_answer_feedback.sql` after existing migrations in a reviewed environment. It makes `feedbacks.structure_score` nullable, adds rubric/prompt versions, and adds claim/read/finish/release functions with fixed search paths and explicit ownership checks. Existing feedback rows are retained; v1 GET returns a compatibility error for older unsupported payloads. No existing rows are backfilled with invented evidence.

The server still uses the signed-in user's Supabase client, never service-role access for evaluation. The `feedbacks.answer_id` unique constraint guarantees one result per answer. The stored validated payload includes individual reasons/quotes and outline; score columns remain available to Report. `next_action` remains null: scoring does not decide the next interview question. Deleting an interview cascades to feedback and reservation rows.

Required existing configuration: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `GEMINI_API_KEY`. Optional: `GEMINI_FEEDBACK_MODEL` (falls back to `GEMINI_MODEL`, then the existing default), `GEMINI_FEEDBACK_TIMEOUT_MS`, `AI_DAILY_LIMIT`, `FEEDBACK_TIMING_LOGS=1`. Timing logs contain stages, attempt number, safe error code and elapsed milliseconds only.

## Verification and handoff

From `src`: `npm test`, `npm run lint`, `npm run build`. Run the synthetic evaluation harness with `node scripts/verify-feedback.mjs`; real Gemini with `node --env-file=.env.local scripts/verify-feedback.mjs --live --out=<report-path>`. The harness applies SQL to local PGlite and tests persistence/replay; it does not authenticate to shared Supabase or exercise the Chat UI.

Before integrated acceptance: apply the migration to the team's test project; Khang connects the waiting/feedback/error/Continue states; Nhan consumes applicable persisted scores in Report; test cross-account access, resume and failure flows in the real app. NFR-PF-02 needs 20 staging requests with p95 ≤10s. NFR-AI-01/02/05 still require repeated scoring and independent human quality/safety reviews. Backend smoke results alone do not establish those acceptance gates.
