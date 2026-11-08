"""Actual Chat React UI with mocked HTTP boundaries; never a Supabase acceptance run."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=3187)
parser.add_argument('--tag', default='ui')
parser.add_argument('--bundler', choices=['webpack','turbopack'], default='webpack')
args = parser.parse_args()
src = Path(__file__).resolve().parents[2]
repo = src.parent
output = repo / 'output' / 'chat-stream' / args.tag
output.mkdir(parents=True, exist_ok=True)
fixture = src / 'app' / 'stream-harness' / 'page.tsx'
if fixture.exists():
    raise SystemExit('Refusing to replace an existing fixture.')
with socket.socket() as check:
    check.bind(('127.0.0.1', args.port))
fixture.parent.mkdir(parents=True, exist_ok=True)
fixture.write_text('import InterviewChat from "@/components/interview-chat/InterviewChat";\n'
    'export default function Harness() { return <main><p>Local UI verification: synthetic data and mocked HTTP. Not Supabase.</p>'
    '<InterviewChat sessionId="00000000-0000-4000-8000-000000000010" /></main>; }\n', encoding='utf-8')
script = r'''
(() => {
 const original = window.fetch.bind(window); const query = new URL(location.href).searchParams;
 const mode = query.get('case') || 'fast'; const lang = query.get('lang') || 'vi';
 const sid='00000000-0000-4000-8000-000000000010';
 const qid='00000000-0000-4000-8000-000000000011';
 const aid='00000000-0000-4000-8000-000000000012';
 const q2='00000000-0000-4000-8000-000000000013';
 const qtext = lang==='vi' ? 'Bạn sẽ xử lý lỗi API như thế nào?' : 'How would you handle an API failure?';
 const question=(n)=>({id:n===1?qid:q2,content:n===1?qtext:(lang==='vi'?'Bạn sẽ kiểm thử request bị hủy thế nào?':'How would you test an aborted request?'),
   topic:'REST API',kind:n===1?'main':'follow_up',position:n});
 const turns=mode==='resume'?[{question:question(1),answer:null}]:[];
 window.__chatWire={calls:[],generations:0,cancelled:false};
 window.fetch=async (input, init={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href); const path=url.pathname;
  if (!path.startsWith('/api/interview')) return original(input,init);
  window.__chatWire.calls.push({path,method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
  if(path==='/api/interview/'+sid) return Response.json({id:sid,status:'in_progress',startedAt:null,
   settings:{type:'technical',difficulty:'medium',language:lang,targetPosition:'Frontend Intern',durationMinutes:15,plannedQuestions:5,inputMode:'text'},turns,analysis:null});
  if(path.endsWith('/answers')) {const data=JSON.parse(init.body); const turn=turns.find(t=>t.question.id===data.questionId); if(turn)turn.answer={id:aid,content:data.content}; return Response.json({answer:{id:aid},alreadySaved:false},{status:201});}
  if(path.endsWith('/end')) return Response.json({id:sid,status:'completed'});
  if(path==='/api/interview/next') {
   if(init.headers?.Accept!=='text/event-stream') throw new Error('Chat did not request SSE');
   const n=++window.__chatWire.generations; const encoder=new TextEncoder(); const timers=[];
   const frame=(event,data)=>encoder.encode('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');
   return new Response(new ReadableStream({start(c){
    c.enqueue(frame('ready',{sessionId:sid}));
    timers.push(setTimeout(()=>c.enqueue(frame('delta',{text:lang==='vi'?'Bạn sẽ ':'How would you '})),100));
    timers.push(setTimeout(()=>{
     if(mode==='invalid') c.enqueue(frame('error',{error:{code:'INVALID_OUTPUT',message:'Invalid response.'}}));
     else {const q=question(n);turns.push({question:q,answer:null});c.enqueue(frame('complete',{sessionId:sid,action:n===1?'next_topic':'follow_up',question:q}));}
     c.close();
    },mode==='slow'?12000:mode==='invalid'?900:2200));
   },cancel(){timers.forEach(clearTimeout);window.__chatWire.cancelled=true;}}),{headers:{'Content-Type':'text/event-stream'}});
  }
  return Response.json({error:{code:'NOT_FOUND'}},{status:404});
 };
})();
'''
env = os.environ.copy()
for name in ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']:
    env[name] = ''
env['NEXT_PUBLIC_INTERVIEW_MOCK'] = '0'
# A normal checkout resolves node_modules inside src. Only a linked dependency
# directory needs an extra Turbopack root; do not assume a sibling named main.
dependency_root = (src/'node_modules').resolve().parent
if dependency_root != src.resolve():
    env.setdefault('INTERVIEW_LINKED_DEPENDENCY_ROOT', str(dependency_root))
logdir = repo / 'tmp'
logdir.mkdir(exist_ok=True)
report = {'boundary': 'Actual Next.js Chat component + production transport; mocked HTTP; no Supabase/Gemini calls.', 'checks': [], 'pageErrors': []}
code = 0
with (logdir / f'chat-ui-{args.tag}.log').open('w', encoding='utf-8') as log:
    server = subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','--'+args.bundler,'-p',str(args.port),'-H','127.0.0.1'],
        cwd=src, env=env, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    try:
        base = f'http://127.0.0.1:{args.port}/stream-harness'
        deadline = time.monotonic()+120
        while True:
            if server.poll() is not None:
                raise RuntimeError('Next.js exited before readiness; inspect local log.')
            try:
                with urllib.request.urlopen(base,timeout=2) as response:
                    if response.status==200: break
            except (OSError,TimeoutError):
                if time.monotonic()>deadline: raise RuntimeError('Next.js readiness timed out.')
                time.sleep(0.2)
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='msedge',headless=True)
            page=browser.new_page(viewport={'width':1440,'height':1100})
            page.on('pageerror',lambda error:report['pageErrors'].append(str(error)))
            page.add_init_script(script=script)
            try:
                for lang in ['vi','en']:
                    page.goto(base+'?case=fast&lang='+lang);page.wait_for_load_state('networkidle')
                    print(json.dumps({'language':lang,'buttons':page.get_by_role('button').all_text_contents()},ensure_ascii=False))
                    preview=page.get_by_test_id('question-preview')
                    expect(preview).to_contain_text('Bạn sẽ ' if lang=='vi' else 'How would you ',timeout=1500)
                    if args.bundler=='turbopack':
                        expect(page.locator('main > div').first).to_have_css('display','grid')
                    expect(page.get_by_role('textbox')).to_be_disabled()
                    page.screenshot(path=str(output/f'{lang}-preview.png'),full_page=True)
                    expect(page.get_by_text('Bạn sẽ xử lý lỗi API như thế nào?' if lang=='vi' else 'How would you handle an API failure?',exact=True)).to_be_visible(timeout=5000)
                    expect(preview).to_have_count(0)
                    expect(page.get_by_role('textbox')).to_be_enabled()
                    if lang=='vi':
                        page.get_by_role('textbox').fill('Em sẽ tách loading và error state, kiểm tra lỗi và thử lại có giới hạn.')
                        page.get_by_role('button',name='Gửi',exact=True).click()
                        expect(page.get_by_text('Bạn sẽ kiểm thử request bị hủy thế nào?',exact=True)).to_be_visible(timeout=5000)
                        calls=page.evaluate('window.__chatWire.calls')
                        assert any(item['path'].endswith('/answers') for item in calls)
                        assert [item['body']['afterAnswerId'] for item in calls if item['path']=='/api/interview/next']==[None,'00000000-0000-4000-8000-000000000012']
                    page.screenshot(path=str(output/f'{lang}-complete.png'),full_page=True)
                    report['checks'].append(lang+'-preview-complete-answer-lock')
                page.goto(base+'?case=slow');page.wait_for_load_state('networkidle')
                expect(page.get_by_text('Phản hồi đang chậm. Bạn có thể tiếp tục chờ hoặc hủy.',exact=True)).to_be_visible(timeout=7000)
                expect(page.get_by_text('Đã chờ hơn 10 giây. Bạn có thể hủy rồi thử lại cùng lượt.',exact=True)).to_be_visible(timeout=7000)
                page.screenshot(path=str(output/'extended-wait.png'),full_page=True)
                page.get_by_role('button',name='Hủy tạo câu hỏi',exact=True).click()
                expect(page.get_by_text('Đã hủy tạo câu hỏi. Bạn có thể thử lại cùng lượt.',exact=True)).to_be_visible()
                expect(page.get_by_test_id('question-preview')).to_have_count(0)
                assert page.evaluate('window.__chatWire.cancelled && window.__chatWire.generations===1')
                report['checks'].append('5s-10s-notices-cancel-no-auto-retry')
                page.goto(base+'?case=invalid');page.wait_for_load_state('networkidle')
                expect(page.get_by_text('AI trả về kết quả lỗi. Hãy thử lại.',exact=True)).to_be_visible(timeout=5000)
                expect(page.get_by_test_id('question-preview')).to_have_count(0)
                expect(page.get_by_role('textbox')).to_be_disabled()
                report['checks'].append('invalid-output-clears-draft')
                page.goto(base+'?case=resume');page.wait_for_load_state('networkidle')
                expect(page.get_by_role('textbox')).to_be_enabled()
                assert page.evaluate('window.__chatWire.generations')==0
                report['checks'].append('resume-existing-question-no-generation')
                assert not report['pageErrors'],report['pageErrors']
                report['status']='passed'
            except Exception as error:
                report['status']='failed';report['failure']=str(error);code=1
                page.screenshot(path=str(output/'failure.png'),full_page=True)
            finally:
                browser.close()
    except Exception as error:
        report['status']='failed';report['failure']=str(error);code=1
    finally:
        server.terminate()
        try:server.wait(timeout=8)
        except subprocess.TimeoutExpired:server.kill();server.wait()
        fixture.unlink(missing_ok=True)
        fixture.parent.rmdir()
        # Next dev retains generated imports of the removed temporary route.
        # Delete only those two known generated files, not application sources.
        for generated in [src/'.next/dev/types/validator.ts',src/'.next/dev/types/app/stream-harness/page.ts']:
            if generated.is_file() and 'stream-harness' in generated.read_text(encoding='utf-8'):
                generated.unlink()
        with socket.socket() as check:
            check.settimeout(0.2)
            if check.connect_ex(('127.0.0.1',args.port))==0:raise RuntimeError('Next.js test port remained open.')
(output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
sys.exit(code)
