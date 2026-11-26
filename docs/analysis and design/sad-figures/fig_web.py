import sys
from diag import *

D = Diagram(2000, 900)
W = 470
ic = D.cls(20, 20, W, 'InterviewChat', 'component (Figure 3b)', ['answerMeta: {inputMode, durationSeconds}', 'feedback: FeedbackState',
           'feedbackCollapsed: boolean'], ['send(meta): save answer, then evaluate()', 'evaluate(answerId, content)', 'continueInterview(answerId)'])
ab = D.cls(520, 20, W, 'AnswerBox', 'component', ['value, language, disabled', 'voice: useSpeechInput'],
           ['toggleMic(): start or stop listening', 'send(): onSend({inputMode: voice |', '  text, durationSeconds})'])
sp = D.cls(1020, 20, W, 'useSpeechInput', 'hook', ['SILENCE_MS: 7000', 'lang: vi-VN | en-US', 'supported, listening, error'],
           ['start(baseText): append transcript', 'stop() · reset() · clearError()', 'spokenSeconds(): number | null', 'isSpeechSupported(): boolean'])
ws = D.cls(1520, 20, 460, 'Web Speech API', 'browser API', ['SpeechRecognition (Chrome, Edge)', 'continuous, interimResults'],
           ['onresult · onerror · onend'], fill=YELLOW)

af = D.cls(20, 330, W, 'AnswerFeedback', 'component', ['question, answer, language', 'state: loading | ready | error', 'collapsed: boolean'],
           ['onBack() · onRetry() · onContinue()', 'onPracticeSimilar()'])
parts = D.cls(520, 330, W, 'Feedback sections', 'components', ['ScoreRing: overall score /10', 'RubricScores: 4 criteria, STAR N/A',
              '  when the score is null', 'WhyThisScore: quotes highlighted', 'AnswerOutline: S/T/A/R or key points'], [])
fcl = D.cls(1020, 330, W, 'answer-feedback/client', 'module', ['FEEDBACK_MODE: api | mock | off'],
            ['evaluateAnswer(sessionId, answerId,', '  {signal}): AnswerFeedback', 'parseFeedback(body, answerId)'])
fm = D.cls(1520, 330, 460, 'AnswerFeedback', 'type', ['overall, scores: CriterionScores', 'evidence: {criterion, quote}[]',
           'strengths, improvements: string[]', 'outline: STAR | key points'], [])

rp = D.cls(20, 620, W, 'ReportPage', 'page /reports/[sessionId]', ['sessionId (route), demo (query)'],
           ['render(): ReportView (W7 sample', '  data; W8: GET /api/report)'])
rv = D.cls(520, 620, W, 'ReportView', 'component', ['report: ReportResponse', 'onRetrySummary()'],
           ['score ring, trend, criteria bars,', '  speaking, summary, timeline', 'Export PDF (W9: /api/report/{id}/pdf)'])
rt = D.cls(1020, 620, W, 'ReportResponse', 'type', ['overview, criteria, structureApplies', 'speaking, summary, timeline[]',
           'REPORT_TEXT: vi | en labels'], [])
pq = D.cls(1520, 620, 460, 'PracticeQuestions', 'component', ['questions per weak criterion'],
           ['generate() · start(questionId)'], dashed=True, star=True)

A = lambda pts, label=None, lpos=None: D.arrow(pts, label=label, lpos=lpos)
A([ic.right(0.35), (ab.x, ic.right(0.35)[1])], None)
A([ab.right(0.35), (sp.x, ab.right(0.35)[1])], None)
A([sp.right(0.35), (ws.x, sp.right(0.35)[1])], None)

A([ic.bottom(0.5), (ic.bottom(0.5)[0], af.y)], 'renders', (ic.bottom(0.5)[0] + 6, 300))
A([ic.right(0.85), (500, ic.right(0.85)[1]), (500, 270), (fcl.x + 60, 270), (fcl.x + 60, fcl.y)], 'POST /api/evaluate-answer', (700, 270))
A([af.right(0.4), (parts.x, af.right(0.4)[1])], None)
A([fcl.right(0.4), (fm.x, fcl.right(0.4)[1])], 'returns', (fcl.x + W + 4, fcl.right(0.4)[1] - 14))
A([rp.right(0.4), (rv.x, rp.right(0.4)[1])], None)
A([rv.right(0.3), (rt.x, rv.right(0.3)[1])], None)
A([rv.right(0.8), (1000, rv.right(0.8)[1]), (1000, 860), (1750, 860), (1750, pq.y + pq.h)], 'practice section (Khang)', (1300, 860))
D.note('dashed arrow: uses · voice: the transcript is edited in the same box and the edited text is sent; only the speaking time is stored · * = pull request #47', y=890)
D.save(sys.argv[1])
