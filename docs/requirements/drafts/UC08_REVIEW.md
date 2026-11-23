# UC 08 review record

Prepared on 22 November 2026 for SCRUM-167, under SCRUM-166. The Jira title names a 20 November deadline; this draft records the actual preparation date. The original v1.3 document remains unchanged. v1.4 DRAFT is a proposed requirements update for review, not a group-approved baseline.

## Changes and decisions submitted for review

| Finding | Draft resolution | Review boundary |
| --- | --- | --- |
| R01 scope and actors | One saved answer, separate from CV/JD fit and next-question selection; Candidate and Gemini retained. | No change to other use cases. |
| R02 validity and linkage | Save answer first, validate required fields/scores/exact quotes, store once and replay. | Implemented by the backend; integrated Chat still needs wiring. |
| R03 score calculation | Mean of applicable integer scores, rounded to one decimal. Technical/HR STAR is N/A, not zero. | Equal weights are the reviewable implementation default in `feedback-rubric.json`. |
| R04 detail and confidence | Specific comments, exact quotes, actionable improvement and type-specific outline; confidence estimated only from text. | Semantic quality still requires independent review. |
| R05 Continue | Display feedback until Candidate clicks Continue; then return to UC-06 step 9. | Existing main Chat advances early. Khang's integration must honor this sequence. |
| R06 Back to Question | View the submitted answer without changing it or silently reevaluating it. | Editing/versioned reevaluation is outside this revision. |
| R07 similar practice | Separate practice and preserve the original interview anchor; return on completion/cancellation/failure. | UC-10 integration is owned by the practice work. |
| R08 stored feedback | Load without AI; return to Report or History according to the entry point. | GET is implemented; navigation belongs to the UI. |
| R09 failures and retry | At most one retry for invalid output/transient service failure within one budget. No blind retry for quota, safety, configuration or expired deadline; preserve answer and allow continuation. | Uncertain save is read back first. If none was saved, a later evaluation may consume another AI allowance; no promise to retain an unsaved AI result. |
| R10 preconditions | Signed in and owns the answer; AI needed only for new evaluation. | Local SQL tests check foreign-user denial; shared-project acceptance is pending. |
| R11 postconditions | Ready feedback linked to answer; unavailable feedback is distinct from zero. | Report must exclude missing feedback from score averages. |

## Document checks

The structural comparison checks all baseline body paragraphs: only UC-08, cover version and TOC page-number caches may differ, plus one revision-history row. Header version/date identify the draft. Existing use-case text, tables and numbering are preserved. The draft is rendered and inspected before publication; visual QA details are recorded in the SCRUM-166 test report.

Document walkthroughs D01–D12 cover successful behavioral and technical/HR feedback, invalid evidence, service failures, quota, safety refusal, uncertain save, continuation/resume, stored feedback from Report/History, Back to Question, separate practice and ownership denial. These checks assess whether the specified paths are defined; they are not application acceptance tests.

## Remaining review and acceptance

The team should review the equal weighting/rounding default, view-only Back to Question, retry policy and revised N/A display before adopting v1.4. No teammate approval is recorded here. UC-06/09/10/11 and the Supplementary Specification have not been silently edited to accommodate this proposal.

Existing NFR requirements remain: feedback p95 ≤10 seconds over 20 staging requests; repeated scoring on 10 fixed answers; evidence/specificity review of 20 feedback items by two independent members; practice notice and 30-case safety review. The local six-case smoke run does not establish these gates. See [API integration and verification](../../api/ANSWER_FEEDBACK_API_v1.md) for responsibilities and deployment prerequisites.
