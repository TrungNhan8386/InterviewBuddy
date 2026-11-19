# InterviewBuddy – Detailed Design (v1.1)

Author: Nguyen Tran Trung Nhan · Jira: SCRUM-83, SCRUM-111 · Sprint 4, week 6 · Status: **matches `main` @ `0668228` (Build 1 candidate) on 13/11/2026**

This document is the detailed design for Build 1. It extends the [architecture overview](architecture.md) (components and connectors) and the [database design](database-design.md) (ERD and RLS).

| Section | Content |
| --- | --- |
| 1 | Component / class diagram of the main modules |
| 2 | Sequence diagrams: analyze CV/JD, one interview turn, resume a session |
| 3 | API table (every endpoint: input, output, errors) |
| 4 | ERD and database changes in weeks 5–6 |

## Version history

| Version | Date | Author | Change |
| --- | --- | --- | --- |
| 1.0 | 05/11/2026 | Nhân | First version for PA3 |
| 1.1 | 13/11/2026 | Nhân | Matches the built Build 1: Setup, Dashboard and Settings pages, streaming `/next` (SSE), Settings API, chat transport, settings migration (SCRUM-111) |
| 1.2 | 19/11/2026 | Nhân | API table: report endpoint (SCRUM-186, Build 2) |

## 1. Component / class diagram

Every server endpoint follows the same layers: **route handler** (HTTP, sign-in) → **service** (rules, validation) → **repository or adapter** (Supabase, Gemini). Services receive their dependencies as parameters, so the tests replace Supabase and Gemini with fakes or an in-memory PostgreSQL.

```mermaid
classDiagram
  direction LR

  namespace Web_Client {
    class AnalysisWorkspace { +analyze() +save() }
    class InterviewSetupPage { +submit() }
    class DashboardPage { +recentSessions() }
    class SettingsPage { +saveLanguage() +deleteData() }
    class ChatPage { +open() +send() +end() }
    class ChatTransport { +loadSession() +saveAnswer() +requestNext() +endSession() }
    class NextStreamClient { +requestInterviewNext(body) }
    class AnalysisClient { +analyzeFit(input) +extractCv(file) }
    class AnalysisStorage { +saveFitAnalysis() +getLatestFitAnalysis() }
    class InterviewErrorMessages { +interviewErrorMessage(code, lang) }
  }

  namespace API_Routes {
    class AnalyzeFitRoute { +POST(request) }
    class ExtractCvRoute { +POST(request) }
    class SessionRoute { +POST(request) }
    class SessionDetailRoute { +GET(request) }
    class AnswersRoute { +POST(request) }
    class EndRoute { +POST(request) }
    class NextRoute { +POST(request) }
    class SettingsRoute { +GET() +PATCH() }
    class SettingsDataRoute { +DELETE() }
  }

  namespace Services {
    class SessionContract { +validateCreateSession() +validateSaveAnswer() +toTurns() +toResumeState() }
    class AnalysisService { +analyze(input) }
    class Scoring { +scoreAnalysis(raw, input) }
    class NextService { +next(body) +stream(body) }
    class InterviewerContract { +validateInterviewerInput() +validateInterviewerOutput() +createEndDecision() }
    class ConversationMemory { +buildConversationMemory(history) }
    class QuestionPlan { +planQuestion(input) }
    class DailyLimit { +createAiCallCounter(supabase) +withAnalysisLimit() +withInterviewerLimit() }
  }

  namespace Adapters {
    class GeminiProvider { +analyze(input) }
    class InterviewerProvider { +next(context) +stream(context) }
    class NextRepository { +claim() +finish() +release() }
    class SupabaseClients { +getSignedInClient(request) +createClient() +createAdminClient() }
  }

  AnalysisWorkspace --> AnalysisClient
  AnalysisWorkspace --> AnalysisStorage
  ChatPage --> ChatTransport
  ChatTransport --> NextStreamClient
  AnalysisClient ..> AnalyzeFitRoute : HTTPS JSON
  AnalysisClient ..> ExtractCvRoute : HTTPS multipart
  InterviewSetupPage ..> SessionRoute : HTTPS JSON
  ChatTransport ..> SessionDetailRoute : HTTPS JSON
  ChatTransport ..> AnswersRoute : HTTPS JSON
  ChatTransport ..> EndRoute : HTTPS JSON
  NextStreamClient ..> NextRoute : HTTPS SSE
  SettingsPage ..> SettingsRoute : HTTPS JSON
  SettingsPage ..> SettingsDataRoute : HTTPS JSON
  AnalysisStorage ..> SupabaseClients : PostgREST, RLS
  DashboardPage ..> SupabaseClients : server client, RLS

  AnalyzeFitRoute --> AnalysisService
  AnalyzeFitRoute --> DailyLimit
  AnalysisService --> GeminiProvider
  AnalysisService --> Scoring
  SessionRoute --> SessionContract
  SessionDetailRoute --> SessionContract
  AnswersRoute --> SessionContract
  NextRoute --> NextService
  NextRoute --> DailyLimit
  NextService --> NextRepository
  NextService --> InterviewerProvider
  NextService --> InterviewerContract
  InterviewerProvider --> ConversationMemory
  InterviewerProvider --> QuestionPlan
  DailyLimit --> SupabaseClients
  NextRepository --> SupabaseClients
  SessionRoute --> SupabaseClients
  SettingsRoute --> SupabaseClients
  SettingsDataRoute --> SupabaseClients
```

| Module | File(s) | Responsibility | Owner |
| --- | --- | --- | --- |
| AnalysisClient, AnalysisStorage | `lib/analysis/client.ts`, `storage.ts` | Call the analysis API; save/read fit analyses with RLS | Khang |
| InterviewErrorMessages | `lib/interview/error-messages.mjs` | Vietnamese/English message for every interview error code | Nhân |
| InterviewSetupPage | `app/(workspace)/interview/new/page.tsx` | Validate the form with `validateCreateSession`, call `POST /api/interview`, open `/interview/{id}` | Tài |
| DashboardPage | `app/(workspace)/dashboard/page.tsx` | Server Component: total and five latest sessions of the user (server Supabase client, RLS) | Tài |
| SettingsPage, Settings routes | `app/(workspace)/settings/page.tsx`, `app/api/settings/**`, `lib/settings/contract.mjs` | Preferred language; delete CV and history after typing `DELETE` | Tài |
| ChatPage, ChatTransport | `components/interview-chat/*`, `lib/interview-chat/transport.mjs` | Chat screen; load/resume, save answer, request next question, end | Khang |
| NextStreamClient | `lib/interview/next-stream-client.mjs`, `stream-protocol.mjs` | Read the SSE stream of `/next` in the browser; 35 s deadline | Hưng |
| Route handlers | `app/api/**/route.*` | Parse HTTP, check sign-in, map errors to status codes | owner of each endpoint |
| SessionContract | `lib/interview/session-contract.mjs` | Validate setup and answers; map DB rows ↔ API; compute resume state | Nhân |
| AnalysisService, Scoring | `lib/analysis/service.mjs`, `scoring.mjs` | Validate input, call Gemini, compute the weighted fit score in code | Hưng |
| NextService, InterviewerContract | `lib/interview/next-service.mjs`, `interviewer-contract.mjs` | Decide follow-up / next topic / end; validate the AI JSON; stream the question text | Hưng |
| ConversationMemory, QuestionPlan | `conversation-memory.mjs`, `question-plan.mjs` | Last four turns + summary; pick the next JD topic and CV evidence | Hưng |
| DailyLimit | `lib/ai/daily-limit.mjs`, `signed-in-analysis-route.mjs` | Count each Gemini call per user per day; block when the limit is reached | Nhân |
| GeminiProvider, InterviewerProvider | `lib/analysis/gemini.mjs`, `lib/interview/interviewer-provider.mjs` | The only code that holds `GEMINI_API_KEY`; timeout and error mapping | Hưng |
| NextRepository | `lib/interview/next-repository.mjs` | Call the claim / finish / release SQL functions | Hưng |
| SupabaseClients | `lib/supabase/*`, `lib/interview/http.ts` | Signed-in client from cookie or Bearer token; service-role client | Nhân |

## 2. Sequence diagrams

### 2.1 Analyze CV against JD (UC-03, UC-04)

```mermaid
sequenceDiagram
  autonumber
  actor U as Candidate
  participant P as Analysis page
  participant X as /api/extract-cv
  participant A as /api/analyze-fit
  participant L as DailyLimit
  participant G as Gemini API
  participant D as Supabase

  U->>P: Paste JD, choose CV (PDF)
  P->>X: POST multipart/form-data (file)
  X->>X: pdf-parse in memory (file is not stored)
  X-->>P: 200 { text, pages, noText, truncated }
  alt noText (scanned PDF)
    P-->>U: Warning: paste the CV text instead
  end
  U->>P: Press Analyze
  P->>A: POST { jd, cv, language } + session cookie
  A->>A: getSignedInClient (401 if signed out)
  A->>A: normalizeFitInput (400 BAD_INPUT)
  A->>L: consume_ai_call(limit)
  L->>D: RPC as the user
  alt limit used up
    D-->>L: allowed = false
    A-->>P: 429 DAILY_LIMIT
    P-->>U: "Bạn đã dùng hết lượt AI hôm nay"
  else allowed
    A->>G: generateContent (responseJsonSchema)
    G-->>A: requirements, summary, coaching (JSON)
    A->>A: validate JSON, compute weighted fitScore in code
    A-->>P: 200 { fitScore, matched, missing, requirements, recommendation, coaching }
    P->>D: insert fit_analyses (browser client, RLS)
    P-->>U: Score, matched/missing skills, advice
  end
```

### 2.2 One interview turn (UC-06)

```mermaid
sequenceDiagram
  autonumber
  actor U as Candidate
  participant C as Chat page
  participant S as /api/interview/{id}/answers
  participant N as /api/interview/next
  participant L as DailyLimit
  participant G as Gemini API
  participant D as Supabase

  U->>C: Type answer, press Send
  C->>S: POST { questionId, content, inputMode }
  S->>D: save_interview_answer() (lock session, RLS)
  alt question is not the last one / session ended
    D-->>S: STALE_TURN / SESSION_CLOSED
    S-->>C: 409 → reload session
  else saved (or already saved)
    D-->>S: answer id
    S-->>C: 201 (200 if already saved) { answer.id }
  end
  C->>N: POST { sessionId, afterAnswerId: answer.id } (Accept: text/event-stream)
  N->>D: claim_interview_next() (lock session, 120 s lease)
  alt turn already generated, or session ended
    D-->>N: ready (saved response)
    N-->>C: 200 SSE: complete { action, question }
  else another request is generating
    D-->>N: busy
    N-->>C: 409 GENERATION_IN_PROGRESS (Retry-After: 2)
  else claimed
    D-->>N: session snapshot + full history + lease token
    N-->>C: 200 SSE: ready
    N->>N: build context: last 4 turns + summary, next JD topic
    alt time or question limit reached
      N->>N: end decision (no Gemini call, not counted)
    else
      N->>L: consume_ai_call(limit)
      alt limit used up
        N->>D: release_interview_next()
        N-->>C: SSE: error AI_DAILY_LIMIT
      else allowed
        N->>G: streamGenerateContent
        loop while Gemini streams
          G-->>N: text chunk
          N-->>C: SSE: delta { text }
        end
        N->>N: validate against contract (follow-up limits, duplicates)
      end
    end
    N->>D: finish_interview_next() (recheck status/time, insert question)
    N-->>C: SSE: complete { action, question }
  end
  C-->>U: Show next question, or "Interview finished"
```

`/next` answers with Server-Sent Events when the request has `Accept: text/event-stream` (the Chat page always sends it); otherwise it returns the same final result as plain JSON. Sign-in, input and claim errors come back as a normal HTTP error before the stream starts. Errors after `ready` (Gemini, validation, daily limit) arrive as an `error` event `{ error: { code, message } }` on an HTTP 200 stream, and the reservation is released. The browser stops waiting after 35 s.

### 2.3 Resume an unfinished session (UC-06, non-functional requirement "no lost session")

```mermaid
sequenceDiagram
  autonumber
  actor U as Candidate
  participant C as Chat page
  participant R as GET /api/interview/{id}
  participant N as /api/interview/next
  participant D as Supabase

  U->>C: Reopen /interview/{id} (new tab, after closing the browser)
  C->>R: GET + session cookie
  R->>D: select session + questions with answers (RLS)
  alt not the user's session
    R-->>C: 404 NOT_FOUND
  end
  R->>R: toTurns(), toProgress(), toResumeState()
  R-->>C: 200 { settings, turns, progress, resume }
  C->>C: Render all saved turns, restart the timer from startedAt
  alt resume.state = not_started
    C->>N: POST { sessionId, afterAnswerId: null }
  else resume.state = awaiting_answer
    C-->>U: Show the last question again, wait for the answer
  else resume.state = awaiting_question
    C->>N: POST { sessionId, afterAnswerId }
    Note over N,D: Same turn key → if the question was already saved,<br/>it is returned without a new Gemini call
  else resume.state = finished
    C-->>U: Show "Interview finished" (report in week 8)
  end
  N-->>C: next question or action end
```

## 3. API table

All endpoints return JSON with `Cache-Control: no-store` (`/next` may stream SSE instead). Errors: `{ "error": { "code", "message", "fields" | "details"? } }`; the Settings routes (#11–13) return only `{ "error": { "message" } }`. "Sign-in" means the Supabase session cookie or `Authorization: Bearer <access_token>`.

| # | Method & path | Owner | Sign-in | Input | Output (success) | Errors | Contract |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `GET /auth/callback?code=` | Tài | – | OAuth code from Google | 302 → `/dashboard` (session cookie set) | 302 → `/login?error=auth_callback` | – |
| 2 | `GET /api/health` (`?ai=1`) | Nhân | optional | – | 200 `{ supabase, gemini }` check results | 503 if a check fails | – |
| 3 | `POST /api/extract-cv` | Khang | – | multipart `file` (PDF ≤ 5 MB) | 200 `{ text, pages, noText, truncated }` | 400 `BAD_FILE` | – |
| 4 | `POST /api/analyze-fit` | Hưng / Khang | **yes** | `{ jd (30–3000), cv, language: vi\|en }` | 200 `{ fitScore, matched[], missing[], requirements[], recommendation, coaching }` | 400 `BAD_INPUT`, 401 `UNAUTHORIZED`, 429 `DAILY_LIMIT` / `RATE_LIMIT`, 502 `INVALID_OUTPUT`, 500/503/504 `SERVER_ERROR` | [CV_JD_ANALYSIS_API_v1](../api/CV_JD_ANALYSIS_API_v1.md), [KHANG_ANALYZE_FIT_COMPAT](../api/KHANG_ANALYZE_FIT_COMPAT.md) |
| 5 | `POST /api/analyze` | Hưng | **yes** | `{ cvText, jdText, language }` | 200 `{ analysisId, fitScore, matchedSkills, missingSkills, summary, coaching, requirements, scoreBreakdown, meta }` | 400 `VALIDATION_ERROR` / `INVALID_JSON`, 401, 403 `ORIGIN_NOT_ALLOWED`, 413, 415, 422 `NO_JOB_REQUIREMENTS` / `AI_CONTENT_BLOCKED`, 429 `AI_DAILY_LIMIT` / `AI_RATE_LIMITED`, 502, 503, 504 | [CV_JD_ANALYSIS_API_v1](../api/CV_JD_ANALYSIS_API_v1.md) |
| 6 | `POST /api/interview` | Nhân | yes | `{ type, difficulty, language, targetPosition, interviewDate?, durationMinutes: 15\|30\|45, inputMode, fitAnalysisId? }` | 201 `{ sessionId, fitAnalysisId }` | 400 `BAD_INPUT` (+ `fields`), 401, 500 | [Session API v1](../api/INTERVIEW_SESSION_API_v1.md) |
| 7 | `GET /api/interview/{id}` | Nhân | yes | – | 200 `{ id, status, startedAt, endedAt, settings, analysis, turns[], progress, resume }` | 401, 404 `NOT_FOUND` (also another user's session), 500 | [Session API v1 §3](../api/INTERVIEW_SESSION_API_v1.md), [Persistence API §3](../api/INTERVIEW_PERSISTENCE_API_v1.md) |
| 8 | `POST /api/interview/{id}/answers` | Nhân | yes | `{ questionId, content (1–12000), inputMode?, durationSeconds? }` | 201 / 200 `{ answer: { id, questionId, createdAt }, alreadySaved }` | 400 `BAD_INPUT`, 401, 404, 409 `STALE_TURN` / `SESSION_CLOSED`, 500 | [Persistence API §4](../api/INTERVIEW_PERSISTENCE_API_v1.md) |
| 9 | `POST /api/interview/{id}/end` | Nhân | yes | – | 200 `{ id, status, endedAt }` | 401, 404, 500 | [Persistence API §5](../api/INTERVIEW_PERSISTENCE_API_v1.md) |
| 10 | `POST /api/interview/next` | Hưng | yes | `{ sessionId, afterAnswerId: uuid\|null }` (≤ 2 KB); `Accept: text/event-stream` to stream | JSON: 200 `{ sessionId, action: next_topic\|follow_up\|end, question: { id, content, topic, kind, position } \| null }`. SSE: `ready` → `delta { text }`… → `complete` (same object) or `error` | 400, 401, 404, 408, 409 `STALE_TURN` / `GENERATION_IN_PROGRESS` / `LEASE_LOST` / `SESSION_CONTEXT_INVALID`, 422, 429 `AI_DAILY_LIMIT` / `AI_RATE_LIMITED`, 502, 503, 504, 500 (after `ready`: as an `error` event) | [Interview Next API v1](../api/INTERVIEW_NEXT_API_v1.md) |
| 11 | `GET /api/settings` | Tài | yes | – | 200 `{ preferredLanguage: vi\|en }` | 401, 404 (no profile), 500, 503 | – |
| 12 | `PATCH /api/settings` | Tài | yes, same origin | `{ preferredLanguage: vi\|en }` (only this field) | 200 `{ preferredLanguage }` | 400, 401, 403 (cross-site), 404, 500, 503 | – |
| 13 | `DELETE /api/settings/data` | Tài | yes, same origin | `{ confirmation: "DELETE" }` | 200 `{ sessionsDeleted, analysesDeleted }`: sessions (with questions, answers, feedback, reports, generations) and saved analyses are deleted; account, profile and AI count are kept | 400, 401, 403, 500, 503 (function missing) | – |
| 14 | `GET /api/report/{sessionId}` (`?retry=summary`) | Nhân | yes | – | 200 `{ sessionId, generatedAt, settings, overview (overallScore, trend…), criteria, structureApplies, speaking, summary, timeline[] }` | 401, 404 `NOT_FOUND`, 409 `SESSION_NOT_COMPLETED` / `NO_SCORED_ANSWERS`, 500 | [Report API v1](../api/REPORT_API_v1.md) |
| – | `POST /api/evaluate-answer` | Hưng | yes | (week 7) | per-answer scores and feedback | – | to be added |

Data the browser reads or writes **directly** through Supabase (RLS checks the owner):

| Table | Operation | Page |
| --- | --- | --- |
| `profiles` | select, update own row | Profile (Tài) |
| `fit_analyses` | insert, select latest | Analysis (Khang) |
| `interview_sessions` | count and five latest (server Supabase client in a Server Component) | Dashboard (Tài) |
| `ai_usage_daily` | select own rows | optional "AI calls left today" (not used by a page yet) |

Settings no longer deletes rows from the browser: it calls `DELETE /api/settings/data`, which runs `delete_own_practice_data()` in one transaction.

## 4. ERD and database changes in weeks 5–6

Two tables were added in week 5; week 6 added functions only. No existing column changed. The full ERD and RLS table are in [database-design.md](database-design.md).

```mermaid
erDiagram
  AUTH_USERS ||--o{ INTERVIEW_SESSIONS : "runs"
  AUTH_USERS ||--o{ AI_USAGE_DAILY : "uses AI"
  INTERVIEW_SESSIONS ||--o{ QUESTIONS : "contains"
  QUESTIONS ||--o| ANSWERS : "answered by"
  INTERVIEW_SESSIONS ||--o{ INTERVIEW_NEXT_GENERATIONS : "turn reservations"
  ANSWERS |o--o{ INTERVIEW_NEXT_GENERATIONS : "after answer"
  QUESTIONS |o--o| INTERVIEW_NEXT_GENERATIONS : "produced"

  INTERVIEW_NEXT_GENERATIONS {
    uuid session_id PK,FK
    text turn_key PK
    uuid after_answer_id FK
    text status
    uuid token
    timestamptz expires_at
    uuid question_id FK
    jsonb response
    jsonb decision
    jsonb metadata
  }
  AI_USAGE_DAILY {
    uuid user_id PK,FK
    date usage_date PK
    integer calls
    timestamptz updated_at
  }
```

| Migration | Owner | Adds |
| --- | --- | --- |
| `20261103000000_interview_next.sql` | Hưng (SCRUM-92) | `interview_next_generations`; `claim_`, `finish_`, `release_interview_next()` |
| `20261105000000_session_resume_ai_limit.sql` | Nhân (SCRUM-80, -81) | `save_interview_answer()`; `ai_usage_daily`; `consume_ai_call()` |
| `20261107000000_settings_data.sql` | Tài / Hưng (SCRUM-88, SCRUM-94) | `delete_own_practice_data()` (Settings); `save_own_interview_answer()` (not called by the current Chat page, which uses `POST /api/interview/{id}/answers`) |
