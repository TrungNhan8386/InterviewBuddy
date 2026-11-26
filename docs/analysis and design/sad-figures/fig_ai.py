import sys
from diag import *

D = Diagram(2000, 840)
W = 470
# Answer feedback (UC-08) -------------------------------------------------------------------------
fs = D.cls(20, 20, W, 'FeedbackService', 'module', ['timeoutMs: 10000 (one answer)', 'one repair retry if output is invalid'],
           ['read(body): saved feedback or null', 'evaluate(body, {signal}): claim lease,', '  generate, validate, finish'])
fr = D.cls(20, 300, W, 'FeedbackRepository', 'module', ['lease per answer (two tabs cannot', '  score the same answer twice)'],
           ['read(answerId) · claim(answerId)', 'finish(answerId, token, feedback,', '  metadata) · release(answerId, token)'])
fp = D.cls(510, 20, W, 'FeedbackProvider', 'module', ['model: GEMINI_MODEL', 'FEEDBACK_PROMPT_VERSION'],
           ['generate(context, {signal,', '  repairReason}): raw feedback'])
fc = D.cls(510, 255, W, 'FeedbackContract', 'module', ['RUBRIC (config/feedback-rubric.json)', 'CRITERIA: content, structure,', '  clarity, confidence'],
           ['feedbackSchema(type): STAR only for', '  behavioral, else null (N/A)', 'validateFeedback(output, context):', '  quotes must exist in the answer'])

# Report summary (UC-09) ---------------------------------------------------------------------------
sp = D.cls(1000, 20, W, 'ReportSummaryProvider', 'module', ['model: GEMINI_REPORT_MODEL |', '  GEMINI_MODEL', 'time-out: below the 30 s report'],
           ['summarize(input, {signal}): {text,', '  strengths[1..3], improvements[1..3]}', 'buildSummaryRequest(input)'])
se = D.cls(1000, 300, W, 'ReportSummaryError', 'error', ['code: AI_TIMEOUT | AI_RATE_LIMITED |', '  AI_UNAVAILABLE | INVALID_OUTPUT |', '  AI_CONTENT_BLOCKED | ...'], [])

# Practice (UC-10, PR #47) ------------------------------------------------------------------------
pv = D.cls(1500, 20, 480, 'PracticeProvider', 'module', ['model: GEMINI_MODEL', 'PRACTICE_PROMPT_VERSION'],
           ['generate(input, {signal}): groups', '  of questions per criterion'], dashed=True, star=True)
pb = D.cls(1500, 230, 480, 'PracticeBuilder', 'module', ['PRACTICE_LIMITS: 2 criteria,', '  3–5 questions each', 'STRONG_SCORE: 7.5'],
           ['pickWeakCriteria(criteria): two', '  lowest; ties: Content > STAR >', '  Clarity > Confidence', 'validatePracticeOutput(value, focus)',
            'toPracticeRows(...)'], dashed=True, star=True)

# Shared --------------------------------------------------------------------------------------------
pc = D.cls(20, 640, W, 'PromptConfig', 'module', ['config/prompts/*.json: feedback,', '  report, practice, interviewer', 'version string in every prompt'],
           ['promptText(config, language)', 'REPORT_PROMPT_CONFIG, ...'])
gr = D.cls(510, 640, W, 'Guardrails', 'module', ['GEMINI_SAFETY_SETTINGS'],
           ['unsafeGeneratedText(text): boolean', 'providerContentBlocked(response)'])
gm = D.cls(1000, 640, W, 'Gemini API', 'external system', ['generateContent (HTTPS)', 'JSON output with a response schema'], [], fill=YELLOW)
lim = D.cls(1500, 640, 480, 'DailyLimit (Figure 4)', 'module', ['consume(): 1 call of the daily', '  limit before every Gemini request'], [])

A = lambda pts, label=None, lpos=None: D.arrow(pts, label=label, lpos=lpos)
A([fs.right(0.3), (fp.x, fs.right(0.3)[1])])
A([fs.bottom(0.5), (fs.bottom(0.5)[0], fr.y)])
A([(fs.x + 420, fs.y + fs.h), (fs.x + 420, 276), (fc.x, 276)], 'validate', (fs.x + 424, 252))
A([fp.bottom(0.5), (fp.bottom(0.5)[0], fc.y)], 'schema', (fp.bottom(0.5)[0] + 6, 236))
A([sp.bottom(0.5), (sp.bottom(0.5)[0], se.y)], 'throws', (sp.bottom(0.5)[0] + 6, 280))
A([pv.bottom(0.5), (pv.bottom(0.5)[0], pb.y)], 'uses', (pv.bottom(0.5)[0] + 6, 214))
# providers -> Gemini
A([fp.right(0.75), (990, fp.right(0.75)[1]), (990, 680), (gm.x, 680)], 'HTTPS', (996, 560))
A([sp.right(0.85), (1480, sp.right(0.85)[1]), (1480, 610), (1250, 610), (1250, gm.y)], 'HTTPS', (1256, 622))
A([pv.left(0.9), (1490, pv.left(0.9)[1]), (1490, 625), (1400, 625), (1400, gm.y)], None)
# config and guardrails
A([fs.left(0.5), (8, fs.left(0.5)[1]), (8, pc.left(0.5)[1]), (pc.x, pc.left(0.5)[1])], 'prompt', (12, 560))
A([(fc.x + 380, fc.y + fc.h), (fc.x + 380, gr.y)], 'unsafe text check', (fc.x + 386, 610))
D.note('dashed arrow: depends on (call) · every provider calls Gemini over HTTPS with the server-only key and a JSON schema · * = practice (UC-10), pull request #47', y=830)
D.save(sys.argv[1])
