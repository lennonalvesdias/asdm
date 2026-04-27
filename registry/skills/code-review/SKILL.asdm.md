---
name: code-review
type: skill
description: "Comprehensive code review methodology with severity classification and structured feedback"
version: 1.0.0
tags: [review, quality, methodology, feedback]
trigger: "When performing a code review, reviewing a PR, or auditing a file for quality issues"

providers:
  opencode:
    location: skills/code-review/
  claude-code:
    location: skills/code-review/
  copilot:
    applyTo: "**/*.{ts,tsx,js,jsx,py,go,java,rs}"
---

# Code Review Skill

## Purpose

This skill provides a systematic methodology for code review that produces consistent, actionable feedback. Apply it during PR reviews, pair sessions, or self-review before submitting work.

## Severity Levels

Every finding is classified at one of five levels:

| Level | Definition | Response Required |
|-------|-----------|-------------------|
| **CRITICAL** | Security vulnerability, data loss risk, or production outage potential | Block merge; fix before approval |
| **HIGH** | Logic error, missing error handling, or significant performance regression | Block merge; fix or explicitly accept risk |
| **MEDIUM** | Code quality issue that increases maintenance cost or reduces reliability | Fix preferred; must be tracked if deferred |
| **LOW** | Style inconsistency, naming issue, or minor inefficiency | Fix encouraged; not a merge blocker |
| **INFO** | Observation, question, or suggestion without a required action | No action required |

## Review Checklist

Work through each category systematically:

### Correctness
- Does the code do what the author claims?
- Are all edge cases handled: null/undefined, empty collections, zero/negative numbers?
- Are concurrency and ordering assumptions documented and enforced?

### Security
- Is all user input validated and sanitized before use?
- Are secrets managed externally — no hardcoded credentials?
- Are authorization checks applied at every entry point?
- Are dependencies pinned to known-safe versions?

### Performance
- Are there N+1 queries or loops that scale quadratically?
- Is expensive work computed lazily or cached appropriately?
- Are large payloads paginated or streamed?

### Maintainability
- Is the code readable without needing to reference the PR description?
- Are functions named for what they do, not how they do it?
- Is complexity isolated behind clean interfaces?
- Is test coverage adequate for the new behavior?

### Consistency
- Does the change follow existing project conventions?
- Are new abstractions consistent with existing ones?
- Is error handling style uniform with the rest of the codebase?

## Feedback Format

Each finding:
```
[SEVERITY] file.ts:42
Issue: <concise description of the problem>
Suggestion: <specific fix or recommendation>
```

End each review with a summary verdict:
- `APPROVE` — Ready to merge
- `REQUEST_CHANGES` — Requires changes before merge
- `COMMENT` — Observations only; author decides next steps

## Confidence Threshold

If you are uncertain whether something is a bug or intentional design, mark it `INFO` and ask a question. Do not block a merge on uncertainty.
