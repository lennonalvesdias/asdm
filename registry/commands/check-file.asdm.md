---
name: check-file
type: command
description: "Analyzes a file for quality issues including style, complexity, and correctness"
version: 1.0.0

providers:
  opencode:
    slash_command: /check-file
    agent: code-reviewer
  claude-code:
    slash_command: /check-file
    agent: code-reviewer
  copilot:
    slash_command: /check-file
    agent: code-reviewer
---

# /check-file

Performs a comprehensive quality analysis of a single file, reporting issues by severity.

## Usage

```
/check-file <path>
/check-file src/auth/login.ts
/check-file --severity high src/payments/stripe.ts
```

## Options

- `<path>` — Required. Path to the file to analyze (relative to project root)
- `--severity <level>` — Filter output to findings at or above this severity (default: LOW)
- `--focus <area>` — Limit analysis to a specific concern: `security`, `performance`, `style`, `correctness`

## Behavior

1. Reads the specified file
2. Identifies the language and applicable rule set
3. Performs static analysis across all configured categories
4. Reports findings sorted by severity (CRITICAL first)
5. Provides a summary with total count per severity level

## Output Format

```
CRITICAL  src/auth/login.ts:47   Hardcoded JWT secret — move to environment variable
HIGH      src/auth/login.ts:62   Missing error handling on async bcrypt.compare call
MEDIUM    src/auth/login.ts:89   Function loginUser has cyclomatic complexity of 14
LOW       src/auth/login.ts:12   Import order: third-party imports before local imports

Summary: 1 CRITICAL, 1 HIGH, 1 MEDIUM, 1 LOW
```

## Exit Behavior

Returns findings as output. Does not modify the file. Use with `code-reviewer` agent for suggested fixes.
