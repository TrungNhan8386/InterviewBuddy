# Practice Plan API — initial UC-13 / SCRUM-210–211

Implemented against origin/main a9308d02a5276213eb90a253ff89dafee4052897, fetched 25 November 2026. All contracts below describe this branch, not a deployed service.

Use the normal signed-in Supabase cookie or user access token. Never send Gemini credentials from the browser.

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/practice-plan` | `{plan: null}` or `{plan: {id, createdAt, interviewDate, language, targetPosition, dates, remainingDays, weakCriteria, general, sourceSessionId, tasks}}`; read only, no AI call |
| POST | `/api/practice-plan` | 201 `{plan, alreadySaved:false}` or 200 replay `{plan, alreadySaved:true}` |

POST JSON example: `{"interviewDate":"2026-11-27","language":"vi","sourceSessionId":"<owned-completed-session-uuid>"}`. Optional `targetPosition` filters the source session by exact stored position. Without a session ID, scan completed sessions newest first in pages of 20 until a scored source is found; unscored sessions do not hide older usable reports. Every page uses the signed-in RLS client and the same position filter. An explicit session ID is never silently replaced. Backend derives scored criteria; report summary generation is never called.

Without scored reports, return 409 `GENERAL_PLAN_CONFIRMATION`. UI must ask whether the candidate wants a general plan; only then send `acceptGeneralPlan:true` and `targetPosition`. Never invent measured weaknesses. Default language is Vietnamese.

## Initial implementation decisions

- Calendar days use Asia/Ho_Chi_Minh, include today and the interview day. Today is valid; the final task should be a light review. Initial horizon: 1–30 days, explicit `PLAN_HORIZON_EXCEEDED` beyond that, never silently truncate. These are initial product defaults requiring team review against the full UC-13 specification.
- Lowest two scored applicable criteria, stable source order for ties. Report `structure` maps to planner `star`; exclude null scores. General mode may use all four criteria but does not claim they were measured weaknesses.
- Exactly one task/date, chronological dates, valid criterion, nonempty task and rationale, max 1200 characters per field. All task text follows requested language.
- A lease prevents parallel generation; identical input/context replays the saved plan. One bounded repair for invalid output shares a 20s deadline. Each model attempt consumes the existing AI allowance.
- Initial separate plan allowance: 3 generation starts per user per Vietnam day, including failed starts, independent of the existing 100-call default AI limit. Reads, cache replays and busy requests do not consume a plan start. Reset at 00:00 Vietnam time. Purging user content preserves usage counters to prevent quota reset.
- Plan plus tasks is one atomic JSON document in `practice_plans`; this keeps the initial read/save API small. It is not a separate table per task. Replacing a plan only occurs after validated generation succeeds. A lost DB acknowledgement retains the lease; retry reads the saved plan before another generation.

## Errors and UI integration for Tài

Envelope: `{"error":{"code":"...","message":"..."}}`. Localize by code rather than showing raw upstream text.

| Code | UI action |
| --- | --- |
| BAD_INPUT / PLAN_HORIZON_EXCEEDED | Correct input/date; retain current plan |
| GENERAL_PLAN_CONFIRMATION | Offer explicit general-plan consent or start a mock interview |
| NOT_FOUND | Select an accessible completed source session |
| GENERATION_IN_PROGRESS | Disable repeated Generate; wait and read current plan |
| PLAN_DAILY_LIMIT / AI_DAILY_LIMIT | Show reset time, no immediate retry |
| AI_RATE_LIMITED | Wait before retry |
| INVALID_OUTPUT / AI_UNAVAILABLE / AI_TIMEOUT | Retain previous plan, allow deliberate retry |
| DATABASE_NOT_READY | Migration must be applied in the test environment |
| SERVER_ERROR / LEASE_LOST | Read stored plan before attempting generation again |

Tài can render `plan.tasks` in the Practice Plan skeleton (SCRUM-201), using `date` as a stable row key. `completed:false` is initial state only. Checkbox updates, calendar ICS, automatic replanning preserving completed tasks, Dashboard reminders and practice-session navigation are not implemented in this initial backend; do not present those as completed UC-13 features.

### Adapter for the actual SCRUM-201 UI contract

The backend retains its versioned wire format. Import `toPracticePlanView` from `@/lib/planning/ui-adapter.mjs` before passing a successful GET/POST body to `PracticePlanView`. It returns `PracticePlan | null`, compatible with Tài's types on `feat/scrum-201-practice-plan-tai` at commit `8672f34fb2531e03e1c0943966984b0fd286e7eb`.

| Backend | UI |
| --- | --- |
| targetPosition | targetRole |
| tasks[].rationale | tasks[].reason |
| tasks[].completed (initially false) | tasks[].done |
| star | structure (both weakCriteria and task criterion) |
| plan.id + task.date | stable tasks[].id |

```tsx
import { toPracticePlanView } from '@/lib/planning/ui-adapter.mjs';

// After checking response.ok and handling error.code:
const plan = toPracticePlanView(body);
// <PracticePlanView today={today} plan={plan} />
```

The adapter validates the saved calendar, preserves the original response, handles `{plan:null}`, and never invents measured weaknesses. Task IDs remain stable when reopening the same saved plan, and change when a replacement plan receives a new ID. A checked-in type compatibility test uses the actual SCRUM-201 interface. `examples/practice-plan.view.json` is a generated synthetic fixture of this converted shape. This does not merge or modify Tài's feature branch or claim the live page is already connected.

Migration: `src/supabase/migrations/20261125000000_practice_plans.sql`, after all preceding migrations. It also extends Delete my data to remove plan content and leases. Local SQL tests apply it to disposable PGlite only; shared Supabase has not been migrated by this task.

The unpublished migration now checks calendar continuity, date/task count, metadata, criterion, nonblank content and initial completion state in both the finish RPC and a table CHECK constraint. Rejected payloads keep the previous plan and lease intact; a corrected payload can finish the same lease. An evaluated source session must belong to the caller. The immutable validator checks the generation snapshot rather than today's date, so old saved plans remain readable. Do not reapply the CREATE TABLE script to an existing installation; if an earlier local revision was already applied, use a reviewed follow-up migration instead.

Server config: existing Supabase URL/anon key and server-only `GEMINI_API_KEY`; optional `GEMINI_PLANNING_MODEL`, falling back to `GEMINI_MODEL`. No SDK or model migration. Use `examples/practice-plan.response.json` as a synthetic, schema-validated fixture for UI integration, not evidence of a live AI response. Actual sending to teammates is not performed by this code change.
