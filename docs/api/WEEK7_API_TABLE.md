# SCRUM-85 — API integration register

Source: uploaded main snapshot; reviewed 2026-11-07. This is a code/contract inventory, not evidence of hosted deployment or owner approval. Ask the listed feature owners to confirm their current endpoints and migration state before merging. No messages have been sent on behalf of the user.

| Method / endpoint | Input | Success | Main errors | Source / owner review |
|---|---|---|---|---|
| POST `/api/interview` | type hr/technical/behavioral; difficulty easy/medium/hard; language vi/en; targetPosition 1–120 chars; durationMinutes 15/30/45; inputMode text/voice; optional interviewDate YYYY-MM-DD and fitAnalysisId | 201 `{sessionId,fitAnalysisId}` | 400 BAD_INPUT with fields; 401; 500 | Nhân: `INTERVIEW_SESSION_API_v1.md`; review pending |
| GET `/api/interview/{id}` | UUID path, authenticated cookie or bearer | session settings, status, optional analysis | 401; 404 invalid/missing/foreign UUID; 500 | Nhân: same contract |
| POST `/api/interview/next` | `{sessionId,afterAnswerId}`; null for opening, otherwise persisted answer UUID | `{sessionId,action,question}`; action next_topic/follow_up/end | 400; 401; 404; 409 busy/stale; 422 blocked; 429 quota; 502 provider; 503 configuration/database; 504 timeout | Interview AI owner: `INTERVIEW_NEXT_API_v1.md`; confirm with Hưng/Nhân |
| POST `/api/analyze` | `{cvText,jdText,language?}` text JSON | Fit score, skills, coaching and breakdown | See `CV_JD_ANALYSIS_API_v1.md`; includes input/size/provider errors | Analysis owner: confirm with Hưng |
| POST `/api/analyze-fit` | `{jd,cv,language?}`; jd 30–3000 chars, cv 30–50000 chars | `{fitScore,matched,missing,requirements,recommendation,coaching}` | 400 BAD_INPUT; 429 RATE_LIMIT; 502 INVALID_OUTPUT; 503 configuration; 504 timeout; 500 SERVER_ERROR | Analysis backend + Khang UI; confirm contract |
| POST `/api/extract-cv` | multipart PDF `file`, max 5 MB | `{text,pages,noText,truncated,originalChars}` | 400 BAD_FILE invalid, large, encrypted or unreadable PDF | Analysis owner; extraction is in memory, no original PDF stored |
| GET `/api/health` | no body; optional `?ai=1` performs actual AI request | Health report | 503 if unhealthy | Backend owner; do not run AI health as an offline check |
| GET `/api/settings` | authentication | `{preferredLanguage:"vi"|"en"}` | 401; 404 profile absent; 500; 503 unconfigured | Tài: added in this patch |
| PATCH `/api/settings` | JSON exactly `{preferredLanguage:"vi"|"en"}` | saved preferredLanguage | 400 invalid/extra fields; 401; 403 origin; 404; 500; 503 | Tài |
| DELETE `/api/settings/data` | JSON exactly `{confirmation:"DELETE"}` | `{sessionsDeleted,analysesDeleted}` | 400 confirmation; 401; 403 origin; 500 transaction failure; 503 missing migration | Tài |
| Supabase RPC `save_own_interview_answer` | p_session_id UUID, p_question_id UUID, p_content 1–12000 chars | answer UUID; identical retry returns existing ID | 42501 authentication/ownership; 22023 inactive/stale/changed answer | Tài: minimal text-chat bridge; coordinate with chat owner before merge |
| Supabase RPC `delete_own_practice_data` | no arguments; caller identity from auth.uid() | deletion counts | 42501 unauthenticated; any SQL failure rolls back all deletes | Tài: only authenticated can execute |

## Wiring decisions

- Setup uses the existing Session API without changing its contract. Dates are checked in Asia/Ho_Chi_Minh; the UI still requires a date, while the API permits null.
- `fitAnalysisId` is omitted: the existing API links the latest analysis belonging to the signed-in user. No browser-supplied user ID.
- Returned `sessionId` opens `/interview/{sessionId}`. The original Week 7 snapshot supplied a minimal text Chat because its main base had no Chat page. After integration with SCRUM-94, this route keeps `components/interview-chat/InterviewChat` and its SSE transport. The minimal component under `components/interview` is retained for provenance and is not mounted by this route.
- Integrated Chat saves answers through `POST /api/interview/{id}/answers` before requesting `/next`, and ends through `POST /api/interview/{id}/end`. It uses `save_interview_answer` from migration 20261105 rather than the compatibility bridge `save_own_interview_answer`. Opening/resuming a session may request its missing next question; failed generations require an explicit user retry. Identical saved answers keep their anchor. Retries may still consume provider quota if an earlier generation failed before persistence.
- Dashboard uses the signed-in Supabase client with RLS, owner filters, an exact count and deterministic latest-five ordering. Errors are distinct from zero/empty results. Score cards remain placeholders.
- Preferred language shares `profiles.preferred_language` with Profile and initializes new setup forms. It does not translate the app or rewrite old sessions. Reload an already-open Profile/Setup tab after changing Settings.
- Deletion removes own sessions first, cascading child records including CV/JD snapshots and generation metadata, then own fit analyses, in one transaction. Account and profile are retained. No original CV PDF exists in this snapshot's storage implementation. Concurrent new writes after purge are new data; close other practice tabs first.
- No service-role key is used by the new APIs. RPC functions have fixed empty search paths and explicit ownership checks. Mutating Settings endpoints reject cross-site origins.

## Owner confirmation checklist (not yet confirmed)

1. Nhân: confirm session API and all migrations on staging, particularly 20261103 and 20261107.
2. Interview AI/chat owner: confirm `/interview/[id]`, `/next` statuses and answer persistence bridge; reconcile with any parallel chat implementation.
3. Analysis owner/Khang: confirm compatibility input/output and whether any new PDF storage bucket needs inclusion in deletion.
4. Tài/leader: run account A/B acceptance checks in the accompanying guide, attach PR and staging evidence to Jira.

Detailed existing contracts remain authoritative for legacy payload limits and error codes. Unsupported methods return 405; listing a handler in source is not evidence that it supports every verb.
