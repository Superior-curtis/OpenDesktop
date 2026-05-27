---
description: Review code changes for bugs, security issues, and best practices
when_to_use: When asked to review code, check a PR, or audit changes
allowed_tools: Read, Grep, Glob, Bash, WebFetch
context: inline
---

# Code Review Skill

Perform a thorough code review of the changes.

## Steps

1. Identify the files changed (use Grep/Glob to find them, or ask the user)
2. Read each changed file carefully
3. Check for:
   - Logic errors and bugs
   - Security vulnerabilities (injection, XSS, auth issues)
   - Performance problems (N+1 queries, unnecessary allocations)
   - Code style and consistency
   - Missing error handling
   - Missing tests
   - Breaking API changes

4. Provide your review organized as:
   - Critical issues (must fix before merge)
   - Warnings (should fix)
   - Suggestions (nice to have)
   - Positive observations

5. For each issue, include:
   - File path and line number
   - The problematic code snippet
   - Why it's a problem
   - Suggested fix
