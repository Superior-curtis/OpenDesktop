
python3 -c "
import subprocess, os
os.chdir('/Users/openclaw/workspace/OpenDesktop')
t = 'gh...6Din'
url = 'https://' + t + '@github.com/Superior-curtis/OpenDesktop.git'
subprocess.run(['git', 'remote', 'set-url', 'origin', url])
r = subprocess.run(['git', 'push', 'origin', 'master'], capture_output=True, text=True, env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
print('OUT:', r.stdout)
print('ERR:', r.stderr)
"
