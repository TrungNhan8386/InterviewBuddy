# History API – draft contract for UC-11 (for Hưng, W9)

Status: **draft from the UI side** (Khang, SCRUM-206). The History page skeleton (`/history`) uses this shape with sample data (`src/lib/history/mock.ts`). Hưng owns the real API (W9, sample due Tue 1/12); change anything here, and the page only needs `src/lib/history/types.ts` + the load function updated.

## Proposed request

```http
GET /api/history            → all sessions of the signed-in user, newest first
```

Filtering by type and date is done on the page for now (UC-11 step 4–5). If the list gets long, add `?type=` and `?from=` later.

## Proposed response

```json
{
  "sessions": [
    {
      "id": "…",
      "targetPosition": "Frontend Developer Intern",
      "type": "behavioral",
      "difficulty": "medium",
      "language": "vi",
      "status": "completed",
      "isPractice": false,
      "startedAt": "2026-11-22T08:00:00.000Z",
      "endedAt": "2026-11-22T08:15:29.000Z",
      "durationSeconds": 929,
      "overallScore": 6.6
    }
  ]
}
```

| Field | Source in the database | Used for |
| --- | --- | --- |
| `type`, `difficulty`, `language`, `targetPosition` | `interview_sessions` | Row text, type filter |
| `status` | `interview_sessions.status` | `in_progress` → "Unfinished" + Resume (UC-11 AF3) |
| `isPractice` | `interview_sessions.source_practice_question_id is not null` (migration 20261124) | "Practice" badge |
| `startedAt`, `endedAt`, `durationSeconds` | `started_at`, `ended_at` | Date column, date filter, duration |
| `overallScore` | `reports.overall_score` (null when no report yet) | Score column, Progress Overview chart |

Errors: `401 UNAUTHORIZED`, `500 SERVER_ERROR` → the page shows "Không tải được lịch sử" + Try again (UC-11 AF5).
