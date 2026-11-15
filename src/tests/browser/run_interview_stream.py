"""Own the Node process directly on Windows; never terminate only a shell parent."""
import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--live', action='store_true')
parser.add_argument('--trace', action='store_true')
parser.add_argument('--port', type=int, default=4174)
parser.add_argument('--case')
parser.add_argument('--tag', default='')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
instance = str(uuid.uuid4())
with socket.socket() as check:
    try:
        check.bind(('127.0.0.1', args.port))
    except OSError as error:
        raise SystemExit(f'Port {args.port} is already in use; refusing to reuse another server.') from error
command = ['node']
if args.live:
    command.append('--env-file-if-exists=.env.local')
command += ['tests/fixtures/interview-stream-server.mjs', '--port', str(args.port), '--instance', instance]
if args.live:
    command.append('--live')
if args.trace:
    command.append('--trace')
log_dir = root.parent / 'tmp'
log_dir.mkdir(exist_ok=True)
with (log_dir / f'scrum94-server-{args.port}.log').open('w', encoding='utf-8') as log:
    process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    try:
        base = f'http://127.0.0.1:{args.port}'
        deadline = time.monotonic() + 40
        while True:
            if process.poll() is not None:
                raise RuntimeError('Verification server exited before readiness; inspect its local log.')
            try:
                with urllib.request.urlopen(base + '/fixtures', timeout=1) as response:
                    setup = json.load(response)
                if setup['instanceId'] != instance:
                    raise RuntimeError('Unexpected server instance on the test port.')
                break
            except (OSError, TimeoutError):
                if time.monotonic() >= deadline:
                    raise RuntimeError('Verification server did not become ready.')
                time.sleep(0.1)
        browser = [sys.executable, '-X', 'utf8', 'tests/browser/interview_stream.py', '--base-url', base,
                   '--mode', 'live' if args.live else 'controlled', '--instance', instance]
        if args.case:
            browser += ['--case', args.case]
        if args.tag:
            browser += ['--tag', args.tag]
        result = subprocess.run(browser, cwd=root)
        return_code = result.returncode
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        with socket.socket() as check:
            check.settimeout(0.2)
            if check.connect_ex(('127.0.0.1', args.port)) == 0:
                raise RuntimeError('Verification server port remained open after cleanup.')
print(f'Server {instance} stopped and port {args.port} closed.')
sys.exit(return_code)
