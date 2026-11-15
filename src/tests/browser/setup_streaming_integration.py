"""Protected Setup -> streaming Chat. Real test login; interview/settings HTTP mocked.

Requires a running local app and SEED_USER_PASSWORD in ignored .env.local.
Never calls Gemini or writes/deletes shared Supabase practice data.
"""
import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser()
parser.add_argument('--base-url',default='http://localhost:4191')
parser.add_argument('--output-dir',required=True)
args=parser.parse_args()
src=Path(__file__).resolve().parents[2]
out=Path(args.output_dir);out.mkdir(parents=True,exist_ok=True)
config={}
for line in (src/'.env.local').read_text(encoding='utf-8-sig').splitlines():
    m=re.match(r'^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$',line)
    if m:config[m[1]]=m[2].strip().strip('"\'')
if not config.get('SEED_USER_PASSWORD'):raise SystemExit('SEED_USER_PASSWORD is required; do not pass it on the command line.')

wire=r'''
(() => {
 const key='setup-streaming-integration';
 const initial={calls:[],sessions:{},counter:0,language:'vi'};
 const s=JSON.parse(sessionStorage.getItem(key)||'null')||initial;
 const save=()=>sessionStorage.setItem(key,JSON.stringify(s));
 const original=window.fetch.bind(window);
 window.__setupStreaming=s;
 window.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(url.origin!==location.origin)return original(input,init);
  const p=url.pathname,method=init.method||'GET';
  if(!p.startsWith('/api/interview')&&!p.startsWith('/api/settings'))return original(input,init);
  const body=init.body?JSON.parse(init.body):null;
  const accept=new Headers(init.headers).get('Accept');
  s.calls.push({path:p,method,body,accept});save();
  if(p==='/api/settings/data')return Response.json({error:{code:'TEST_GUARD',message:'Deletion disabled by test boundary.'}},{status:403});
  if(p==='/api/settings'){
   if(method==='PATCH'){s.language=body.preferredLanguage;save();}
   return Response.json({preferredLanguage:s.language});
  }
  if(p==='/api/interview'&&method==='POST'){
   const id='00000000-0000-4000-8000-'+String(++s.counter).padStart(12,'0');
   s.sessions[id]={id,status:'in_progress',startedAt:null,analysis:null,turns:[],settings:{...body,plannedQuestions:8}};save();
   return Response.json({sessionId:id,fitAnalysisId:null},{status:201});
  }
  if(p==='/api/interview/next'){
   const session=s.sessions[body.sessionId];
   if(accept!=='text/event-stream')return Response.json({error:{code:'TEST_EXPECTED_STREAM'}},{status:406});
   const en=session.settings.language==='en',n=session.turns.length+1;
   const text=en?(n===1?'How would you handle an API failure?':'How would you test an aborted request?'):
    (n===1?'Bạn sẽ xử lý lỗi API như thế nào?':'Bạn sẽ kiểm thử request bị hủy thế nào?');
   const q={id:'00000000-0000-4000-8000-'+String(s.counter*100+n).padStart(12,'0'),content:text,
    kind:n===1?'main':'follow_up',topic:'REST API',position:n};
   const encoder=new TextEncoder();
   const frame=(event,data)=>encoder.encode('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');
   return new Response(new ReadableStream({start(c){
    c.enqueue(frame('ready',{sessionId:session.id}));
    setTimeout(()=>c.enqueue(frame('delta',{text:en?'How would you ':'Bạn sẽ '})),100);
    setTimeout(()=>{session.turns.push({question:q,answer:null});save();
     c.enqueue(frame('complete',{sessionId:session.id,action:n===1?'next_topic':'follow_up',question:q}));c.close();},2200);
   }}),{headers:{'Content-Type':'text/event-stream'}});
  }
  const parts=p.split('/'),session=s.sessions[parts[3]];
  if(!session)return Response.json({error:{code:'NOT_FOUND'}},{status:404});
  if(parts[4]==='answers'){
   const t=session.turns.find(t=>t.question.id===body.questionId);
   const answer={id:'00000000-0000-4000-8000-'+String(s.counter*1000).padStart(12,'0'),content:body.content};
   t.answer=answer;save();return Response.json({answer,alreadySaved:false},{status:201});
  }
  if(parts[4]==='end'){session.status='completed';save();}
  return Response.json(session);
 };
})();
'''

report={'boundary':'Actual protected Setup/Chat/Settings pages with real Supabase test sign-in and profile reads; interview/settings HTTP mocked. No real generation, practice-data write or deletion.',
        'checks':[],'status':'running'}
def persist():
    text=json.dumps(report,ensure_ascii=False,indent=2)
    for key in ['GEMINI_API_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SEED_USER_PASSWORD']:
        if config.get(key):text=text.replace(config[key],'[REDACTED]')
    (out/'results.json').write_text(text,encoding='utf-8')
    return text
def stage(value):
    report['stage']=value;persist();print(json.dumps({'stage':value}),flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1100})
    context.add_init_script(wire)
    page=context.new_page()
    try:
        stage('login')
        page.goto(args.base_url+'/login');page.wait_for_load_state('networkidle')
        page.get_by_label('Email',exact=True).fill(config.get('TEST_USER_EMAIL','candidate.a@interviewbuddy.test'))
        page.get_by_label('Mật khẩu',exact=True).fill(config['SEED_USER_PASSWORD'])
        page.get_by_role('button',name='Đăng nhập',exact=True).click()
        page.wait_for_url('**/dashboard',timeout=45000)
        for language in ['vi','en']:
            stage(language+'-setup')
            page.goto(args.base_url+'/interview/new');page.wait_for_load_state('networkidle')
            page.get_by_label('Vị trí mục tiêu *',exact=True).fill('Frontend Intern — synthetic integration test')
            date=(datetime.now(timezone(timedelta(hours=7)))+timedelta(days=1)).date().isoformat()
            page.get_by_label('Ngày phỏng vấn thực tế *',exact=True).fill(date)
            language_label='English' if language=='en' else 'Tiếng Việt'
            page.get_by_role('group',name='Ngôn ngữ',exact=True).get_by_text(language_label,exact=True).click()
            expect(page.get_by_label(language_label,exact=True)).to_be_checked()
            button=page.get_by_role('button',name='Bắt đầu phỏng vấn',exact=True).first
            expect(button).to_be_enabled(timeout=4000)
            button.click();page.wait_for_url(re.compile(r'.*/interview/[0-9a-f-]{36}$'),timeout=20000)
            stage(language+'-chat-preview')
            preview=page.get_by_test_id('question-preview')
            expect(preview).to_contain_text('How would you ' if language=='en' else 'Bạn sẽ ',timeout=5000)
            expect(page.get_by_role('textbox')).to_be_disabled()
            expect(preview).to_have_count(0,timeout=6000)
            expect(page.get_by_role('textbox')).to_be_enabled()
            expected='How would you handle an API failure?' if language=='en' else 'Bạn sẽ xử lý lỗi API như thế nào?'
            expect(page.get_by_text(expected,exact=True)).to_be_visible()
            report['checks'].append(language+' Setup creates session and opens streaming preview then confirmed Chat')
            stage(language+'-answer-resume-end')
            page.get_by_role('textbox').fill('Synthetic answer: I preserve drafts, handle API errors and test cancellation.')
            page.get_by_role('button',name='Send' if language=='en' else 'Gửi',exact=True).click()
            expected='How would you test an aborted request?' if language=='en' else 'Bạn sẽ kiểm thử request bị hủy thế nào?'
            expect(page.get_by_text(expected,exact=True)).to_be_visible(timeout=6000)
            expect(page.get_by_role('textbox')).to_be_enabled()
            state=page.evaluate('window.__setupStreaming')
            sid=page.url.rsplit('/',1)[1]
            calls=[c for c in state['calls'] if c['body'] and c['body'].get('sessionId')==sid and c['path']=='/api/interview/next']
            assert len(calls)==2 and calls[0]['body']['afterAnswerId'] is None
            saved=state['sessions'][sid]['turns'][0]['answer']['id']
            assert calls[1]['body']['afterAnswerId']==saved
            before=len(state['calls']);page.reload();page.wait_for_load_state('networkidle')
            expect(page.get_by_text(expected,exact=True)).to_be_visible()
            assert not any(c['path']=='/api/interview/next' for c in page.evaluate('window.__setupStreaming.calls')[before:])
            page.get_by_role('button',name='End interview' if language=='en' else 'Kết thúc phỏng vấn',exact=True).click()
            page.get_by_role('alertdialog').get_by_role('button',name='End' if language=='en' else 'Kết thúc',exact=True).click()
            expect(page.get_by_role('heading',name='The interview has ended' if language=='en' else 'Buổi phỏng vấn đã kết thúc',exact=True)).to_be_visible()
            report['checks'].append(language+' answer anchor, saved resume and end preserved')
        stage('settings')
        page.goto(args.base_url+'/settings');page.wait_for_load_state('networkidle')
        page.get_by_label('Ngôn ngữ',exact=True).select_option('en')
        page.get_by_role('button',name='Lưu cài đặt',exact=True).click()
        expect(page.get_by_text('Đã lưu ngôn ngữ mặc định cho phiên mới.',exact=True)).to_be_visible()
        page.reload();page.wait_for_load_state('networkidle')
        expect(page.get_by_label('Ngôn ngữ',exact=True)).to_have_value('en')
        assert not any(c['path']=='/api/settings/data' for c in page.evaluate('window.__setupStreaming.calls'))
        report['checks'].append('Settings language save/reload; no deletion requested')
        report['status']='passed'
    except Exception as error:
        report['status']='failed';report['failure']=str(error)
        persist()
        try:page.screenshot(path=str(out/'failure.png'),full_page=True,timeout=5000)
        except Exception as capture_error:report['screenshotErrorType']=type(capture_error).__name__
    finally:
        browser.close()
text=persist()
print(json.dumps(json.loads(text),ensure_ascii=True))
raise SystemExit(0 if report['status']=='passed' else 1)
