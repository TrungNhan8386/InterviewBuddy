import sys
from diag import *

D = Diagram(2000, 1150)
T = lambda x, y, w, name, cols, fill=BLUE, **kw: D.cls(x, y, w, name, attrs=cols, ops=(), fill=fill, empty_attr=False, **kw)

users = T(20, 50, 400, 'auth.users', ['PK id uuid', '   email text', '   raw_user_meta_data jsonb'], fill=GREY)
fit = T(500, 50, 420, 'fit_analyses', ['PK id uuid', 'FK user_id uuid', '   jd_text text (≤3000)', '   cv_text text', '   cv_file_name text',
                                        '   language text', '   fit_score smallint', '   result jsonb', '   created_at timestamptz'])
ses = T(1000, 50, 500, 'interview_sessions', ['PK id uuid', 'FK user_id uuid', 'FK fit_analysis_id uuid', 'FK source_practice_question_id *',
                                              '   round_type text', '   difficulty text', '   language text', '   target_position text',
                                              '   interview_date date', '   duration_minutes smallint', '   input_mode text (text | voice)',
                                              '   planned_questions smallint', '   status text', '   jd_text, cv_text text', '   started_at, ended_at'])
rep = T(1580, 50, 400, 'reports', ['PK id uuid', 'FK,UK session_id uuid', '   overall_score numeric', '   criteria_scores jsonb',
                                   '   speaking_metrics jsonb', '   summary text', '   strengths, improvements text[]', 'UK share_token text', '   shared_at timestamptz'])
prof = T(20, 230, 400, 'profiles', ['PK,FK id uuid', '   full_name text', '   field_of_study text', '   target_position text',
                                    '   experience_level text', '   preferred_language text'])
usage = T(20, 450, 400, 'ai_usage_daily', ['PK,FK user_id uuid', 'PK usage_date date', '   calls integer (≤ daily limit)', '   updated_at timestamptz'], fill=GREEN)
gen = T(1580, 345, 400, 'interview_next_generations', ['PK,FK session_id uuid', 'PK turn_key text', 'FK after_answer_id uuid', 'FK question_id uuid',
                                                       '   status text', '   token uuid, expires_at', '   response, decision jsonb'], fill=GREEN)
fb = T(20, 660, 430, 'feedbacks', ['PK id uuid', 'FK,UK answer_id uuid', '   content_score 0–10', '   structure_score 0–10 | null',
                                    '   clarity_score 0–10', '   confidence_score 0–10', '   overall_score numeric', '   explanation text',
                                    '   strengths, improvements text[]', '   next_action text', '   model, rubric_version,', '   prompt_version text'], fill=GREEN)
ans = T(510, 660, 420, 'answers', ['PK id uuid', 'FK,UK question_id uuid', '   content text', '   input_mode text (text | voice)',
                                   '   duration_seconds numeric', '   word_count int'])
q = T(1000, 660, 500, 'questions', ['PK id uuid', 'FK session_id uuid', 'FK parent_question_id uuid', '   position smallint',
                                    '   kind text (main | follow_up)', '   topic text', '   content text'])
afg = T(510, 930, 420, 'answer_feedback_generations', ['PK,FK answer_id uuid', '   token uuid', '   status text', '   context_hash text', '   expires_at timestamptz'], fill=GREEN)
pq = T(1580, 660, 400, 'practice_questions', ['PK id uuid', 'FK session_id uuid', 'FK user_id uuid', 'FK practice_session_id uuid',
                                              '   criterion text', '   criterion_score numeric', '   position smallint', '   content, tip text',
                                              '   language text', '   model, prompt_version'], fill=GREEN, dashed=True, star=True)

def link(pts, label, lpos, **kw):
    D.arrow(pts, head='none', dashed=False, label=label, lpos=lpos, **kw)

link([users.right(0.5), (fit.x, users.right(0.5)[1])], '1 — *', (440, 92))
link([(220, 50), (220, 20), (1250, 20), (1250, 50)], '1 — *', (700, 20))
link([users.bottom(0.5), prof.top(0.5)], '1 — 1', (230, 200))
link([(20, 130), (8, 130), (8, 510), (20, 510)], '', None)
D.text(12, 418, '1 — *', size=9.5, color=MUTED, rotation=90, ha='left', va='center')
link([(fit.x + fit.w, 100), (ses.x, 100)], '0..1 — *', (926, 86))
link([(ses.x + ses.w, 100), (rep.x, 100)], '1 — 0..1', (1506, 86))
link([(1250, ses.y + ses.h), (1250, q.y)], '1 — *', (1258, 630))
link([(ses.x + ses.w, 400), (gen.x, 400)], '1 — *', (1512, 386))
link([(1450, ses.y + ses.h), (1450, 600), (1780, 600), (1780, pq.y)], '1 — *', (1600, 600))
link([(q.x, 700), (ans.x + ans.w, 700)], '1 — 0..1', (936, 686))
link([(ans.x, 700), (fb.x + fb.w, 700)], '1 — 0..1', (455, 686))
link([(720, ans.y + ans.h), (720, afg.y)], '1 — 0..1', (728, 880))
link([(1380, q.y + q.h), (1380, 875), (1470, 875), (1470, q.y + q.h)], None, None)
D.text(1365, 875, "follow-up of  0..1 — *", size=9.5, color=MUTED, va="center", ha="right")
D.note('RLS on every table · PK primary key · FK foreign key · UK unique · green = new or changed since SAD v1.1 · * = practice (UC-10), pull request #47', y=1140)
D.save(sys.argv[1])
