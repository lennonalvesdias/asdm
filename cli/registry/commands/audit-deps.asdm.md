---
name: audit-deps
type: command
description: "Audits project dependencies for security vulnerabilities and supply chain risks"
version: 1.0.0

providers:
  opencode:
    slash_command: /audit-deps
    agent: security-auditor
    model: github-copilot/claude-haiku-4.5
  claude-code:
    slash_command: /audit-deps
    agent: security-auditor
  copilot:
    slash_command: /audit-deps
    agent: security-auditor
---

# /audit-deps

Performs a comprehensive security audit of project dependencies. Checks for known CVEs, outdated packages, license compliance issues, and supply chain risk indicators.

## Usage

```
/audit-deps
/audit-deps --severity high
/audit-deps --fix
/audit-deps --format json
```

## Options

- `--severity <level>` — Report only findings at or above this level: `critical`, `high` (default), `medium`, `low`
- `--fix` — Automatically apply safe, non-breaking upgrades for found vulnerabilities
- `--format <type>` — Output format: `table` (default), `json`, `sarif`
- `--production` — Audit only production dependencies (skip devDependencies)
- `--license <policy>` — Fail on packages with incompatible licenses: `permissive`, `copyleft`

## Checks Performed

### CVE Scan
Cross-references installed package versions against the GitHub Advisory Database and OSV (Open Source Vulnerabilities). Reports CVE ID, CVSS score, affected version range, and fixed version.

### Outdated Packages
Identifies packages more than 2 major versions behind latest stable. Major version lag increases the cost of future security updates.

### Supply Chain Indicators
Flags packages exhibiting risk signals:
- Maintainer changes in the last 90 days
- Package publish from a new or recently-created npm account
- Lockfile hash mismatch (possible tampering)
- Package name typosquatting risk (similarity to popular packages)

### License Compliance
Identifies packages with licenses that may be incompatible with your project's license:
- GPL/AGPL in proprietary projects
- Missing license (undeclared licenses = legal risk)
- Dual-licensed packages requiring commercial licensing

## Output Example

```
CRITICAL  lodash@4.17.15    CVE-2021-23337  Prototype pollution via zipObjectDeep  → fix: 4.17.21
HIGH      axios@0.21.1      CVE-2021-3749   SSRF via redirect following            → fix: 0.21.4
MEDIUM    moment@2.29.1     Deprecated      Use dayjs or date-fns instead

Summary: 2 vulnerabilities found (1 CRITICAL, 1 HIGH), 1 deprecation warning
Run /audit-deps --fix to apply 2 safe upgrades automatically
```

## Notes

- Always review `--fix` changes before committing — automatic upgrades may introduce breaking changes
- Run in CI on every PR to catch new vulnerabilities introduced by dependency updates
- SARIF output format is compatible with GitHub Code Scanning for automated tracking
