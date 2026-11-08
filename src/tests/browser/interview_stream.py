"""Headless browser checks: real production consumer/HTTP/provider, local test DB/auth."""
import argparse
import json
import re
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:4174')
parser.add_argument('--mode', choices=['controlled', 'live'], default='controlled')
parser.add_argument('--channel', default='msedge')
parser.add_argument('--case', default=None)
parser.add_argument('--instance', default=None)
parser.add_argument('--tag', default='')
args = parser.parse_args()
if args.tag and not re.fullmatch(r'[a-zA-Z0-9-]{1,60}', args.tag):
    parser.error('Use a short alphanumeric --tag.')
repo = Path(__file__).resolve().parents[3]
images = repo / 'output' / 'interview-stream'
if args.tag:
    images = images / args.tag
reports = repo / 'docs' / 'test' / 'results'
images.mkdir(parents=True, exist_ok=True)
reports.mkdir(parents=True, exist_ok=True)
results = []
page_errors = []
report = {'mode': args.mode, 'boundary': 'Real browser + production consumer/handler/service/provider; simulated authentication and local PGlite. Live mode uses real Gemini.',
          'provenance': 'AI-authored synthetic CV/JD/answers. No real applicant data.',
          'metric': 'click to actual nonempty question text, measured after two requestAnimationFrame callbacks; ready/loading frames do not count',
          'results': results, 'pageErrors': page_errors}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel=args.channel, headless=True)
    report['browser'] = browser.version
    page = browser.new_page(viewport={'width': 1280, 'height': 960}, device_scale_factor=1)
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    try:
        page.goto(args.base_url)
        page.wait_for_load_state('networkidle')
        page.screenshot(path=str(images / f'{args.mode}-initial.png'), full_page=True)
        # Reconnaissance: locate controls from the rendered page, then act.
        print(json.dumps({'title': page.title(), 'buttons': page.get_by_role('button').all_text_contents()}, ensure_ascii=False))
        expect(page.get_by_label('Tình huống kiểm tra')).to_be_enabled()
        report['fixtures'] = page.request.get(args.base_url + '/fixtures').json()
        assert report['fixtures']['mode'] == args.mode
        if args.instance:
            assert report['fixtures']['instanceId'] == args.instance, 'Connected to an old verification server'

        def statistics(session_id):
            return page.request.get(args.base_url + '/stats', params={'sessionId': session_id}).json()

        def start(case_id):
            page.get_by_label('Tình huống kiểm tra').select_option(case_id)
            page.get_by_role('button', name='Tạo câu hỏi', exact=True).click()

        def finish():
            page.wait_for_function('window.testResult && window.testResult.finished', timeout=60000)
            return page.evaluate('JSON.parse(JSON.stringify(window.testResult))')

        def record(result):
            result['database'] = statistics(result['sessionId'])
            results.append(result)
            print(json.dumps({'id': result['id'], 'error': result['error'], 'firstVisibleMs': result['firstVisibleMs'],
                              'completeMs': result['completeMs'], 'saved': result['database']['newQuestions']}, ensure_ascii=False))

        if args.mode == 'controlled':
            start('slow-success')
            expect(page.locator('#question')).to_contain_text('Bạn sẽ kiểm thử')
            page.wait_for_function('window.testResult.firstVisibleMs !== null')
            assert page.locator('#status').inner_text() == 'Đang tạo câu hỏi'
            pending = page.evaluate('window.testResult.sessionId')
            assert statistics(pending)['newQuestions'] == 0
            page.screenshot(path=str(images / 'controlled-preview.png'), full_page=True)
            result = finish()
            assert result['output']['question']['content'] == 'Bạn sẽ kiểm thử lỗi API như thế nào?'
            assert result['firstVisibleMs'] < 2000 and result['completeMs'] > 2000
            assert result['firstVisibleStatus'] == 'Đang tạo câu hỏi'
            record(result)
            assert result['database']['calls'] == 1 and result['database']['newQuestions'] == 1
            page.screenshot(path=str(images / 'controlled-complete.png'), full_page=True)
            saved_id = result['output']['question']['id']
            page.get_by_role('button', name='Gửi lại lượt này', exact=True).click()
            replay = finish()
            assert replay['output']['question']['id'] == saved_id
            record(replay)
            assert replay['database']['calls'] == 1 and replay['database']['newQuestions'] == 1

            start('unicode')
            result = finish()
            assert result['error'] is None and result['output']['question']['content'] == 'Bạn chọn "Go" và 😀 như thế nào?'
            record(result)

            for case_id in ['invalid-output', 'truncated']:
                start(case_id)
                result = finish()
                assert result['error'] == 'INVALID_OUTPUT'
                assert page.locator('#question').inner_text() == ''
                record(result)
                assert result['database']['newQuestions'] == 0 and result['database']['generationStatus'] == 'failed'
                page.screenshot(path=str(images / f'controlled-{case_id}.png'), full_page=True)

            start('cancel')
            expect(page.locator('#question')).to_contain_text('Bạn')
            page.get_by_role('button', name='Hủy', exact=True).click()
            result = finish()
            assert result['error'] == 'REQUEST_CANCELLED' and page.locator('#question').inner_text() == ''
            deadline = time.monotonic() + 3
            while statistics(result['sessionId'])['generationStatus'] == 'generating' and time.monotonic() < deadline:
                time.sleep(0.05)
            record(result)
            assert result['database']['generationStatus'] == 'failed' and result['database']['newQuestions'] == 0
            assert result['database']['upstreamCancelled']

            start('closed')
            result = finish()
            assert result['output']['action'] == 'end' and result['firstVisibleMs'] is None
            record(result)
            assert result['database']['calls'] == 0

            start('stop-open')
            result = finish()
            assert result['error'] is None and result['completeMs'] < 2000
            record(result)
            assert result['database']['newQuestions'] == 1 and result['database']['upstreamCancelled']

            start('slow-notices')
            expect(page.locator('#status')).to_contain_text('Phản hồi đang chậm', timeout=7000)
            assert statistics(page.evaluate('window.testResult.sessionId'))['newQuestions'] == 0
            expect(page.get_by_role('button', name='Hủy', exact=True)).to_be_enabled()
            expect(page.locator('#status')).to_contain_text('Đã chờ hơn 10 giây', timeout=7000)
            page.screenshot(path=str(images / 'controlled-extended-wait.png'), full_page=True)
            result = finish()
            assert result['error'] is None and result['output']['question']['content']
            assert [entry['status'] for entry in result['statusEvents']] == ['generating', 'slow', 'extended', 'complete']
            record(result)
            assert result['database']['calls'] == 1 and result['database']['newQuestions'] == 1

            for case_id, code in [('provider-timeout', 'AI_TIMEOUT'), ('browser-deadline', 'RESPONSE_TIMEOUT'), ('disconnect', 'NETWORK_ERROR')]:
                start(case_id)
                result = finish()
                assert result['error'] == code, result
                assert page.locator('#question').inner_text() == ''
                deadline = time.monotonic() + 3
                while statistics(result['sessionId'])['generationStatus'] == 'generating' and time.monotonic() < deadline:
                    time.sleep(0.05)
                record(result)
                assert result['database']['newQuestions'] == 0 and result['database']['generationStatus'] == 'failed'
                assert result['database']['calls'] == 1 and result['database']['upstreamCancelled']
                page.screenshot(path=str(images / f'controlled-{case_id}.png'), full_page=True)

            start('busy')
            result = finish()
            assert result['error'] == 'GENERATION_IN_PROGRESS'
            record(result)
            assert result['database']['calls'] == 0
        else:
            for fixture in report['fixtures']['fixtures']:
                if args.case and fixture['id'] != args.case:
                    continue
                start(fixture['id'])
                result = finish()
                record(result)
                page.screenshot(path=str(images / f"{fixture['id']}-complete.png"), full_page=True)
                assert result['error'] is None, result['error']
                assert result['firstVisibleMs'] is not None and result['output']['question']['content']
                assert result['database']['calls'] == 1 and result['database']['newQuestions'] == 1
                result['withinTwoSeconds'] = result['firstVisibleMs'] <= 2000
                saved_id = result['output']['question']['id']
                page.get_by_role('button', name='Gửi lại lượt này', exact=True).click()
                replay = finish()
                result['replaySameQuestionWithoutExtraCall'] = (replay['error'] is None and
                    replay['output']['question']['id'] == saved_id and statistics(result['sessionId'])['calls'] == 1)
                assert result['replaySameQuestionWithoutExtraCall']
        assert not page_errors, page_errors
        report['functionalChecks'] = 'passed'
    except Exception as error:
        report['functionalChecks'] = 'failed'
        report['failure'] = str(error)
        page.screenshot(path=str(images / f'{args.mode}-failure.png'), full_page=True)
    finally:
        browser.close()

if args.mode == 'live':
    report['withinTwoSeconds'] = sum(bool(entry.get('withinTwoSeconds')) for entry in results)
    report['sampleCount'] = len(results)
    report['allSamplesWithinTwoSeconds'] = bool(results) and report['withinTwoSeconds'] == len(results)
suffix = '-' + args.case if args.case else ''
if args.tag:
    suffix += '-' + args.tag
destination = reports / f'scrum94-browser-{args.mode}{suffix}.json'
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('Report: ' + str(destination))
if report['functionalChecks'] != 'passed':
    print('FAILURE: ' + report.get('failure', 'unknown'))
    sys.exit(1)
if args.mode == 'live' and not report['allSamplesWithinTwoSeconds']:
    print('Functional checks passed, but the observed first-text latency target was missed in at least one sample.')
    sys.exit(2)
print('Browser checks passed.')
