# Interview streaming API v1 — SCRUM-94

Status: implementation prepared for publication on `feat/scrum-94-chat-streaming-hung`, including the Chat adapter and streaming quota checks. The first-visible-text target has **not** passed consistently with real Gemini; authenticated Chat/shared-Supabase acceptance remains pending. Based on SCRUM-93 commit `baa2f8e`; JSON requests/responses remain compatible with [Interview Next API v1](INTERVIEW_NEXT_API_v1.md). See the [publication report](../test/SCRUM-94_PUBLICATION_20261106_VI.md) for the integration provenance and current verification boundary.

## Request and negotiation

Use the existing authenticated endpoint and body:

```http
POST /api/interview/next
Content-Type: application/json
Accept: text/event-stream
```

```json
{"sessionId":"00000000-0000-4000-8000-000000000010","afterAnswerId":null}
```

Without an accepted `text/event-stream` media type, the endpoint returns its existing final JSON response. The body still accepts exactly `sessionId` and `afterAnswerId`; browser-supplied CV/JD, summaries and counters remain prohibited. Existing cookie/Bearer authentication and the 2048-byte request limit are unchanged.

## SSE protocol

Each frame contains an `event:` line, one JSON `data:` value and a blank line. Response headers are `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-store, no-transform` and `X-Accel-Buffering: no`.

| Event | Data | Meaning |
| --- | --- | --- |
| `ready` | `{"sessionId":"..."}` | Ownership and turn reservation succeeded. This is not question text and does not count toward the two-second target. |
| `delta` | `{"text":"Bạn sẽ..."}` | Append this provisional question text. No topic/reason, raw JSON, thought parts or credential is forwarded here. |
| `complete` | The existing public `{sessionId, action, question}` result | Full AI output passed validation and SQL finalization completed, or a saved/terminal result was replayed. Replace the draft with the final question. `end` has `question: null`. |
| `error` | `{"error":{"code":"...","message":"..."}}` | The turn did not deliver a confirmed result. Clear provisional text and allow an explicit same-turn retry. |

Terminal and replay responses may contain only `complete`, with no `ready` or `delta`. A draft can end with `complete` carrying `end` if time expires while generating; the draft must be cleared. Only a completed result enables the next answer/turn.

Authentication, malformed body, ownership and busy-turn errors occur before stream headers and preserve HTTP statuses such as 400/401/404/409. After `ready`, errors are SSE `error` events under the already-open HTTP 200 response; checking `response.ok` alone is insufficient. In particular, Gemini can return an in-band 503/429 error after an upstream HTTP 200. These are mapped to safe `AI_UNAVAILABLE`/`AI_RATE_LIMITED` events, without copying upstream diagnostic text.

## Provider, validation and persistence

The server uses the existing model/configuration and REST `:streamGenerateContent?alt=sse` endpoint, retaining the API key only in the server header. It incrementally decodes UTF-8/SSE frames and extracts only a top-level JSON `question` string. Escaped quotes, split Unicode/surrogate pairs, CRLF and fragmented frame boundaries are supported. A regex search for the word `question` is not used because it could match text inside `reason`.

The combined raw generation is capped at 12000 UTF-16 units; provisional question text at 1200; incoming SSE bytes at 262144. A final STOP and valid complete JSON are required. Full schema, action-policy, topic and normalized duplicate checks still use the canonical history from SCRUM-93. No extra summarizer call, SDK migration or model upgrade is introduced.

As of 6 November 2026, `STOP` ends provider consumption immediately. The reader is cancelled and the complete JSON is validated before returning a decision; transport EOF is not required after this terminal signal. A stalled partial response without `STOP` still fails with `AI_TIMEOUT`, and a malformed/schema-invalid `STOP` result is still rejected. This removes avoidable post-generation waiting; it does not guarantee a fast first token from the provider.

Preview is deliberately provisional: structural or policy failure after a preview produces an error, clears the draft and saves no question. SQL is called only after validation. The full-history four-turn/summary projection, ownership checks, atomic claim/finish/release and replay contract are preserved. No database transaction remains open while Gemini streams.

Cancelling the browser stream or request aborts upstream consumption and releases an uncommitted reservation. An uncertain acknowledgement after SQL commit retains the reservation so an explicit retry can recover the saved question without another model call. There is no automatic billable retry or canned fallback question.

## Browser integration

The reusable browser-safe consumer is `src/lib/interview/next-stream-client.mjs` with TypeScript declarations. It validates public event shapes, rejects another session's result, handles split frames, and clears the draft on error, truncation or cancellation.

```javascript
import { requestInterviewNext } from '@/lib/interview/next-stream-client.mjs';

const cancellation = new AbortController();
const saved = await requestInterviewNext(
  { sessionId, afterAnswerId },
  {
    signal: cancellation.signal,
    onPreview: (text) => updateDraftText(text),
    onStatus: (status) => updateLocalizedStatus(status),
    onMetrics: (metrics) => recordTimingOnly(metrics),
  }
);
// Only here is saved.question confirmed. Render text as text, not HTML.
// Cancellation: cancellation.abort(). Errors require an explicit same-turn retry.
```

`onPreview` receives the accumulated draft, not a JSON envelope. Callers should catch `InterviewStreamError`, keep answer submission disabled while pending, and use the resolved public result to enable the next interaction. Chat-page wiring remains with SCRUM-95; this change adds a local verification page, not a replacement Chat product page.

`onStatus` immediately emits `generating`, then `slow` after 5 seconds and `extended` after 10 seconds while still pending. These are notices, not automatic retries or hard cutoffs. It ends with `complete`, `error`, or `cancelled`. The caller maps these identifiers to the selected UI language. Notice timers are removed on every exit. Errors in status/timing observers do not change a valid result.

The browser has a separate **35-second default deadline** spanning the request, with optional `timeoutMs` (1000–60000 ms). It aborts the request and clears draft text with `RESPONSE_TIMEOUT`; the provider's existing 30-second upstream deadline remains unchanged. `AI_TIMEOUT` means the server reported the upstream timeout, `NETWORK_ERROR` means transport failed, and `REQUEST_CANCELLED` means caller cancellation. A timeout can occur after SQL committed but before the browser received confirmation: retry **the same** `{sessionId, afterAnswerId}` explicitly to recover the saved question. Do not advance the anchor or automatically generate another turn.

`onMetrics` emits exactly one `{firstDeltaMs, elapsedMs, outcome, code}` record per completed/failed attempt. `firstDeltaMs` measures receipt of the first letter/number in a delta, not browser paint, and is null on complete-only replay/end responses. A quick draft followed by failure has an error/timeout outcome and must not count as a fast valid generation. Actual first-visible latency still requires browser frame measurement.

## Optional server timing diagnostics

Set `INTERVIEW_TIMING_LOGS=1` on the server to enable numeric span logs; default is off. Records contain only `{requestId, stage, elapsedMs, code}` with a new random request ID, fixed stage names and a sanitized error code. They exclude session/user IDs, API keys, CV/JD/answers, generated question/reason and raw provider bodies. No database table or telemetry service is added.

Stages distinguish authentication/body parsing, turn claim, context construction, upstream start/headers/first frame/first question text/validated decision, application validation, persistence start/success and completion. Replay/end are labelled separately; failed/cancelled streams have a terminal record. Times are elapsed from the HTTP handler entry. Subtract adjacent relevant timestamps to inspect spans; the upstream wait includes network and service scheduling and must not be described as a measured GPU prefill time. Observer exceptions are isolated; callbacks run synchronously and must stay lightweight.

## Latency measurement and current limit

Working targets recorded at user request are documented in [acceptance targets v1](../test/SCRUM-94_ACCEPTANCE_TARGETS_VI.md). They preserve the original Jira two-second objective and add explicit denominators, completion targets and review conditions; they are not team/instructor-approved SLA claims.

The browser harness measures from the create-question click until actual nonempty question text survives two `requestAnimationFrame` callbacks. Headers, `ready`, a spinner and loading labels are not counted. The 6 November five-case run saved all five questions, with four showing first text within two seconds and one at about 2.293 seconds; all five completed within five seconds. This is 80% fast-and-valid, below the 90% working target, and the required minimum sample/environment is still missing. The earlier 5 November report is preserved, including its slow case and upstream failure. **These small samples do not establish a two-second SLA or a passed end-to-end production requirement.**

See the [6 November improvement report](../test/SCRUM-94_IMPROVEMENTS_20261106_VI.md), [new controlled](../test/results/scrum94-browser-controlled-improvements-20261106.json)/[new live](../test/results/scrum94-browser-live-improvements-20261106.json) results and the [earlier implementation report](../test/SCRUM-94_IMPLEMENTATION_VI.md). Authentication is simulated and DB is local PGlite; hosted auth/DB network time is not included. Do not discard slow requests or count failed provisional output as a successful under-two-second result.

Sources consulted: [Google streaming endpoint](https://ai.google.dev/api/generate-content?hl=en#method:-models.streamgeneratecontent), [Google structured streaming](https://aistudio.google.com/docs/structured-output#streaming), and version-matched Next.js Route Handler streaming documentation under `src/node_modules/next/dist/docs`. Google's documentation lists minimal thinking as the default for Flash-Lite; this implementation leaves the existing model defaults unchanged rather than claiming a latency benefit from re-setting them.
