#!/bin/bash
TOKEN="github...0lSv"
cd /Users/openclaw/workspace/OpenDesktop
git remote set-url origin "https://${TOKEN}@github.com/Superior-curtis/OpenDesktop.git"
GIT_TERMINAL_PROMPT=0 git push origin master 2>&1
