import sys
from diag import *

D = Diagram(2000, 1000)
W = 375
X = [20, 415, 810, 1205, 1600]
ev = D.cls(X[0], 20, W, 'EvaluateAnswerRoute', 'route', ['POST /api/evaluate-answer', 'GET  ?answerId=  (saved feedback)', 'maxDuration: 60'],
           ['POST = handlers.POST', 'GET = handlers.GET'])
rr = D.cls(X[1], 20, W, 'ReportRoute', 'route', ['GET /api/report/{sessionId}', '    [?retry=summary]', 'maxDuration: 60'],
           ['GET(): ReportResponse | error'])
pr = D.cls(X[2], 20, W, 'ReportPdfRoute', 'route', ['GET /api/report/{sessionId}/pdf', 'maxDuration: 60'],
           ['GET(): application/pdf (download)', 'loadFont(): Geist TTF, once'])
pg = D.cls(X[3], 20, W, 'PracticeGenerateRoute', 'route', ['GET|POST /api/practice/generate'],
           ['GET(): saved set, no AI call', 'POST(): generate once and save'], dashed=True, star=True)
ps = D.cls(X[4], 20, W, 'PracticeStartRoute', 'route', ['POST /api/practice/start'],
           ['POST(): {sessionId} of a practice', '  session (rpc start_practice_session)'], dashed=True, star=True)

fh = D.cls(X[0], 290, W, 'FeedbackHttp', 'module', ['MESSAGES, STATUS by error code'],
           ['createFeedbackHandlers({', '  authenticate, makeService,', '  observeTiming}): {POST, GET}'])
rs = D.cls(X[1], 290, W, 'ReportService', 'module', ['scores recomputed on every request', 'AI summary written once, reused'],
           ['createReportService({repository,', '  provider, consume})', 'getReport(sessionId, {retrySummary,', '  signal}): ReportResponse'])
pdf = D.cls(X[2], 290, W, 'ReportPdf', 'module', ['A4, session language (vi | en)', 'font: Geist (OFL), Vietnamese'],
            ['renderReportPdf(report, {fontBytes})', '  : Uint8Array', 'reportPdfFileName(report): string'])
psv = D.cls(X[3], 290, 770, 'PracticeService', 'module', ['reads the report of a completed session; one saved set per session'],
            ['createPracticeService({repository, provider, consume})', 'read(sessionId) · generate(sessionId, {signal}) · start(practiceQuestionId)'],
            dashed=True, star=True)

err = D.cls(X[0], 560, W, 'ReportError', 'error', ['code: NOT_FOUND (404) |', '  SESSION_NOT_COMPLETED (409) |', '  NO_SCORED_ANSWERS (409)'], [])
repo = D.cls(X[1], 560, W, 'ReportRepository', 'module', ['RLS: only the owner\'s rows'],
             ['session(id) · questions(id)', '  questions + answers + feedbacks', 'savedReport(id) · previous(session)', 'save(row): upsert reports'])
bld = D.cls(X[2], 560, W, 'ReportBuilder', 'module', ['CRITERIA: content, structure,', '  clarity, confidence', 'FILLER_WORDS: vi, en'],
            ['buildReport(session, rows, previous)', 'countFillers(texts, language)', 'toReportRow(id, report, summary)', 'buildSummaryInput(...)',
             'validateSummary(value)'])
prepo = D.cls(X[3], 560, W, 'PracticeRepository', 'module', ['practice_questions (RLS)'],
              ['session(id) · saved(id)', 'insert(rows)', 'start(id): rpc'], dashed=True, star=True)
perr = D.cls(X[4], 560, W, 'PracticeError', 'error', ['code: NOT_FOUND (404) |', '  SESSION_NOT_COMPLETED (409) |', '  NOT_ENOUGH_SCORES (409) |', '  AI_DAILY_LIMIT (429) | AI_*'], [], dashed=True, star=True)

ai = D.cls(X[0], 840, 1955, 'AI Integration (Figure 6b)', 'layer', ['FeedbackService · ReportSummaryProvider · PracticeProvider *'], [], dashed=True)

A = lambda pts, label=None, lpos=None: D.arrow(pts, label=label, lpos=lpos)
A([ev.bottom(), (ev.bottom()[0], fh.y)])
A([rr.bottom(), (rr.bottom()[0], rs.y)])
A([pr.bottom(0.3), (pr.bottom(0.3)[0], 255), (rs.right()[0] - 60, 255), (rs.right()[0] - 60, rs.y)], 'getReport()', (650, 255))
A([pr.bottom(0.6), (pr.bottom(0.6)[0], pdf.y)])
A([pg.bottom(), (pg.bottom()[0], psv.y)])
A([ps.bottom(), (ps.bottom()[0], psv.y)])
A([fh.left(0.5), (8, fh.left(0.5)[1]), (8, ai.y + 30), (ai.x, ai.y + 30)], 'makeService()', (12, 760))
A([rs.bottom(0.1), (rs.bottom(0.1)[0], 520), (300, 520), (300, err.y)], 'throws', (305, 540))
A([rs.bottom(0.35), (rs.bottom(0.35)[0], repo.y)])
A([rs.bottom(0.7), (rs.bottom(0.7)[0], 525), (bld.x + 60, 525), (bld.x + 60, bld.y)], 'buildReport()', (bld.x + 66, 540))
A([rs.right(0.92), (800, rs.right(0.92)[1]), (800, ai.y)], 'summarize()', (720, 805))
A([psv.bottom(0.15), (psv.bottom(0.15)[0], prepo.y)])
A([psv.bottom(0.7), (psv.bottom(0.7)[0], perr.y)], 'throws', (psv.bottom(0.7)[0] + 6, 530))
A([(1592, psv.y + psv.h), (1592, ai.y)], 'generate()', (1500, 805))
D.note('every route signs the user in with InterviewHttp and counts AI calls with DailyLimit (Figure 4) · dashed arrow: depends on (call) · * = practice (UC-10), pull request #47', y=990)
D.save(sys.argv[1])
