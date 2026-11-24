import sys
from diag import *

D = Diagram(2000, 1070)
# Clients ---------------------------------------------------------------------------------------
pc = D.node3d(40, 70, 480, 300, 'Desktop / laptop computer', 'device', fill=BLUE)
D.node3d(60, 150, 420, 200, 'Web browser', 'execution environment', fill=WHITE, d=10, title_size=11.5,
         lines=['Chrome, Edge, Safari, Firefox (latest 2)'])
D.artifact(80, 240, 380, 'Web Client', ['HTML, CSS, JavaScript bundle', 'Web Speech API (voice, Chrome/Edge)'])

ph = D.node3d(40, 440, 480, 300, 'Mobile phone', 'device', fill=BLUE)
D.node3d(60, 520, 420, 200, 'Mobile web browser', 'execution environment', fill=WHITE, d=10, title_size=11.5,
         lines=['Chrome (Android), Safari (iOS), from 360 px'])
D.artifact(80, 610, 380, 'Web Client (responsive)', ['same pages; typing if voice', 'is not supported'])

# Web server -------------------------------------------------------------------------------------
vc = D.node3d(690, 70, 620, 670, 'Vercel (web server)', 'cloud platform', fill=GREEN)
D.node3d(710, 150, 570, 120, 'Edge Network (CDN)', 'execution environment', fill=WHITE, d=10, title_size=11.5,
         lines=['static pages, JavaScript/CSS bundles, images'])
D.node3d(710, 310, 570, 410, 'Node.js serverless functions', 'execution environment', fill=WHITE, d=10, title_size=11.5,
         lines=['region close to Supabase (Singapore)'])
D.artifact(730, 395, 530, 'Next.js server build', ['proxy.ts (session refresh, page guard)', 'Server Components (dashboard, report)',
           'API Route Handlers /api/* (Table 4)', 'lib/* domain modules, assets/fonts (PDF)'])
D.artifact(730, 585, 530, 'Environment variables', ['Supabase URL and keys', 'GEMINI_API_KEY, GEMINI_MODEL (never in Git)'], stereo='configuration')

# Services ---------------------------------------------------------------------------------------
sb = D.node3d(1480, 70, 480, 350, 'Supabase (ap-southeast-1)', 'cloud platform', fill=YELLOW)
D.artifact(1500, 150, 440, 'PostgreSQL 17', ['application tables, RLS on every table', 'SQL functions (RPC), migrations'], stereo='database')
D.artifact(1500, 262, 440, 'Supabase Auth', ['email/password, Google sign-in', 'issues JWT session'], stereo='service')
D.text(1500, 382, '«service» PostgREST (REST API over HTTPS)', size=9.6)

gc = D.node3d(1480, 500, 480, 240, 'Google Cloud', 'cloud platform', fill=YELLOW)
D.artifact(1500, 580, 440, 'Gemini API', ['model in GEMINI_MODEL (Flash-Lite)'], stereo='service')
D.text(1500, 680, '«service» OAuth 2.0 (Google sign-in)', size=9.6)

# Development ------------------------------------------------------------------------------------
dev = D.node3d(40, 860, 480, 170, 'Developer machine', 'device', fill=GREY,
               lines=['Node.js, npm run dev (localhost:3000)', '.env.local (not in Git)', 'npm test, test scripts'])
gh = D.node3d(690, 860, 620, 170, 'GitHub', 'cloud platform', fill=GREY,
              lines=['«repository» TrungNhan8386/InterviewBuddy', 'main + one branch per task, pull requests',
                     '«workflow» GitHub Actions: deploy.yml', 'on push to main: vercel build, vercel deploy --prod'])

# Communication paths ----------------------------------------------------------------------------
D.arrow([(534, 205), (690, 205)], head='none', dashed=False, label='HTTPS (pages, JSON, SSE)', lpos=(540, 176))
D.arrow([(534, 575), (690, 575)], head='none', dashed=False, label='HTTPS', lpos=(570, 552))
D.arrow([(280, 56), (280, 22), (1720, 22), (1720, 56)], head='none', dashed=False, label='HTTPS: sign-in (Supabase Auth), Google OAuth redirect', lpos=(760, 22))
D.arrow([(1324, 238), (1480, 238)], head='none', dashed=False, label='HTTPS: PostgREST, Auth', lpos=(1336, 214))
D.text(1336, 252, '(user JWT, RLS)', size=9.5, color=MUTED)
D.arrow([(1324, 636), (1480, 636)], head='none', dashed=False, label='HTTPS: Gemini', lpos=(1336, 614))
D.text(1336, 652, '(server-only key)', size=9.5, color=MUTED)
D.arrow([(534, 945), (690, 945)], head='none', dashed=False, label='git push (HTTPS)', lpos=(548, 922))
D.arrow([gh.top(0.5), vc.bottom(0.5)], head='none', dashed=False, label='deploy main (HTTPS, Vercel CLI)', lpos=(1012, 800))
D.note('UML deployment diagram · 3D box = node · «artifact» = deployed file · lines = communication paths with their protocol')
D.save(sys.argv[1])
