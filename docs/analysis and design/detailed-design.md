# InterviewBuddy – Detailed Design (PA3, v1.0)

Author: Nguyen Tran Trung Nhan · Jira: SCRUM-83 · Sprint 3, week 5 · Status: **draft for review by Hưng and Khang** · Matches `main` + branch `feat/scrum-79-session-persistence` on 05/11/2026

This document is the detailed design for Build 1. It extends the [architecture overview](architecture.md) (components and connectors) and the [database design](database-design.md) (ERD and RLS).

| Section | Content |
| --- | --- |
| 1 | Component / class diagram of the main modules |
| 2 | Sequence diagrams: analyze CV/JD, one interview turn, resume a session |
| 3 | API table (every endpoint: input, output, errors) |
| 4 | ERD changes in week 5 |

## Version history

| Version | Date | Author | Change |
| --- | --- | --- | --- |
| 1.0 | 05/11/2026 | Nhân | First version for PA3 |

## 1. Component / class diagram

Every server endpoint follows the same layers: **route handler** (HTTP, sign-in) → **service** (rules, validation) → **repository or adapter** (Supabase, Gemini). Services receive their dependencies as parameters, so the tests replace Supabase and Gemini with fakes or an in-memory PostgreSQL.

```mermaid
classDiagram
  direction LR

  namespace Web_Client {
    class AnalysisWorkspace { +analyze() +save() }
    class InterviewSetupPage { +submit() }
    class ChatPage { +open() +send() +end() }
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
  }

  namespace Services {
    class SessionContract { +validateCreateSession() +validateSaveAnswer() +toTurns() +toResumeState() }
    class AnalysisService { +analyze(input) }
    class Scoring { +scoreAnalysis(raw, input) }
    class NextService { +next(body) }
    class InterviewerContract { +validateInterviewerInput() +validateInterviewerOutput() +createEndDecision() }
    class ConversationMemory { +buildConversationMemory(history) }
    class QuestionPlan { +planQuestion(input) }
    class DailyLimit { +createAiCallCounter(supabase) +withAnalysisLimit() +withInterviewerLimit() }
  }

  namespace Adapters {
    class GeminiProvider { +analyze(input) }
    class InterviewerProvider { +next(context) }
    class NextRepository { +claim() +finish() +release() }
    class SupabaseClients { +getSignedInClient(request) +createClient() +createAdminClient() }
  }

  AnalysisWorkspace --> AnalysisClient
  AnalysisWorkspace --> AnalysisStorage
  ChatPage --> InterviewErrorMessages
  AnalysisClient ..> AnalyzeFitRoute : HTTPS JSON
  AnalysisClient ..> ExtractCvRoute : HTTPS multipart
  InterviewSetupPage ..> SessionRoute : HTTPS JSON
  ChatPage ..> SessionDetailRoute : HTTPS JSON
  ChatPage ..> AnswersRoute : HTTPS JSON
  ChatPage ..> NextRoute : HTTPS JSON
  ChatPage ..> EndRoute : HTTPS JSON
  AnalysisStorage ..> SupabaseClients : PostgREST, RLS

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
```

| Module | File(s) | Responsibility | Owner |
| --- | --- | --- | --- |
| AnalysisClient, AnalysisStorage | `lib/analysis/client.ts`, `storage.ts` | Call the analysis API; save/read fit analyses with RLS | Khang |
| InterviewErrorMessages | `lib/interview/error-messages.mjs` | Vietnamese/English message for every interview error code | Nhân |
| Route handlers | `app/api/**/route.*` | Parse HTTP, check sign-in, map errors to status codes | owner of each endpoint |
| SessionContract | `lib/interview/session-contract.mjs` | Validate setup and answers; map DB rows ↔ API; compute resume state | Nhân |
| AnalysisService, Scoring | `lib/analysis/service.mjs`, `scoring.mjs` | Validate input, call Gemini, compute the weighted fit score in code | Hưng |
| NextService, InterviewerContract | `lib/interview/next-service.mjs`, `interviewer-contract.mjs` | Decide follow-up / next topic / end; validate the AI JSON | Hưng |
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
  C->>N: POST { sessionId, afterAnswerId: answer.id }
  N->>D: claim_interview_next() (lock session, 120 s lease)
  alt turn already generated, or session ended
    D-->>N: ready (saved response)
    N-->>C: 200 saved question / action end
  else another request is generating
    D-->>N: busy
    N-->>C: 409 GENERATION_IN_PROGRESS (Retry-After: 2)
  else claimed
    D-->>N: session snapshot + full history + lease token
    N->>N: build context: last 4 turns + summary, next JD topic
    alt time or question limit reached
      N->>N: end decision (no Gemini call, not counted)
    else
      N->>L: consume_ai_call(limit)
      alt limit used up
        N->>D: release_interview_next()
        N-->>C: 429 AI_DAILY_LIMIT
      else allowed
        N->>G: generateContent
        G-->>N: { action, question, topic, reason }
        N->>N: validate against contract (follow-up limits, duplicates)
      end
    end
    N->>D: finish_interview_next() (recheck status/time, insert question)
    N-->>C: 200 { action, question }
  end
  C-->>U: Show next question, or "Interview finished"
```

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

All endpoints return JSON with `Cache-Control: no-store`. Errors: `{ "error": { "code", "message", "fields" | "details"? } }`. "Sign-in" means the Supabase session cookie or `Authorization: Bearer <access_token>`.

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
| 10 | `POST /api/interview/next` | Hưng | yes | `{ sessionId, afterAnswerId: uuid\|null }` (≤ 2 KB) | 200 `{ sessionId, action: next_topic\|follow_up\|end, question: { id, content, topic, kind, position } \| null }` | 400, 401, 404, 408, 409 `STALE_TURN` / `GENERATION_IN_PROGRESS` / `LEASE_LOST` / `SESSION_CONTEXT_INVALID`, 422, 429 `AI_DAILY_LIMIT` / `AI_RATE_LIMITED`, 502, 503, 504, 500 | [Interview Next API v1](../api/INTERVIEW_NEXT_API_v1.md) |
| – | `POST /api/evaluate-answer` | Hưng | yes | (week 7) | per-answer scores and feedback | – | to be added |

Data the browser reads or writes **directly** through Supabase (RLS checks the owner):

| Table | Operation | Page |
| --- | --- | --- |
| `profiles` | select, update own row | Profile (Tài) |
| `fit_analyses` | insert, select latest | Analysis (Khang) |
| `interview_sessions`, `fit_analyses` | delete own rows | Settings – delete CV and history (Tài) |
| `ai_usage_daily` | select own rows | optional "AI calls left today" |

## 4. ERD changes in week 5

Two tables were added; no existing column changed. The full ERD and RLS table are in [database-design.md](database-design.md).

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
