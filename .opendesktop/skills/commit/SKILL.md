---
description: Generate a git commit message and commit staged changes
when_to_use: When asked to commit changes, make a commit, or generate a commit message
allowed_tools: Bash, Read
context: inline
---

# Commit Skill

Generate a conventional commit message and commit staged changes.

## Steps

1. Run `git diff --cached --stat` to see what's staged
2. Run `git diff --cached` to see the full diff
3. Generate a concise commit message following conventional commits format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `refactor:` for code restructuring
   - `docs:` for documentation
   - `test:` for tests
   - `chore:` for maintenance
4. Run `git commit -m "message"` to commit
5. Confirm the commit was created with `git log -1 --oneline`
