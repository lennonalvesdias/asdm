# ⚙️ ASDM — Agentic Software Delivery Model

> **Write Once, Emit Many.**
> One source of truth for all your AI coding assistant configurations.

[![npm version](https://img.shields.io/npm/v/asdm-cli.svg)](https://www.npmjs.com/package/asdm-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js ≥ 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

---

## ⚡ Quick Start

```bash
# 1. Install globally (or use npx for zero-install)
npm install -g asdm-cli

# Machine Setup — default, works from any directory
asdm init           # creates ~/.config/asdm/config.json
asdm sync           # installs to global provider config dirs

# Project Setup — per repository, opt-in
asdm init --local   # creates .asdm.json
asdm sync --local   # installs to project-local provider dirs
```

That's it. ASDM will download your team's canonical AI assistant configurations and emit them into the correct locations for every provider — OpenCode, Claude Code, and GitHub Copilot — all from a single command.

---

## What is ASDM?

ASDM solves a real problem: every AI coding assistant speaks a different dialect.

- **OpenCode** stores agents in `.opencode/agents/`, config in `opencode.jsonc`
- **Claude Code** uses `.claude/agents/`, skills in `.claude/skills/`, and `CLAUDE.md`
- **GitHub Copilot** expects `.github/agents/*.agent.md` and `copilot-instructions.md`

When your team upgrades a code-reviewer agent, that change needs to reach every developer in every format. Doing this manually doesn't scale. Doing it wrong breeds configuration drift — and configuration drift means inconsistent AI behavior across your codebase.

### The "Write Once, Emit Many" Model

ASDM introduces a **canonical format** — `.md` files with YAML frontmatter — that serves as the single source of truth for every agent, skill, and command. A publish step converts this format into every provider's native layout simultaneously:

```
asdm-registry (GitHub)
    └── agents/code-reviewer.md  ← single source
           │
           ├──▶  .opencode/agents/code-reviewer.md        (OpenCode)
           ├──▶  .claude/agents/code-reviewer.md          (Claude Code)
           └──▶  .github/agents/code-reviewer.agent.md    (GitHub Copilot)
```

### Corporate Governance Built In

ASDM is designed for teams. The registry includes a **corporate policy** that travels with every release:

- **Allowed profiles** — developers can only use profiles the platform team approves
- **Locked fields** — telemetry, hook installation, and auto-verify cannot be disabled locally
- **Integrity verification** — SHA-256 checksums prevent silent tampering of managed files
- **Git hooks** — pre-commit hooks block commits if managed files have been modified

---

## Installation

### Global install (recommended)

```bash
npm install -g asdm-cli
asdm --help
```

### Zero-install via npx

```bash
npx asdm-cli sync
```

### Requirements

- Node.js ≥ 18.0.0
- Git (for hook installation)
- A GitHub token with read access to your registry repo (set as `GITHUB_TOKEN` or `ASDM_GITHUB_TOKEN`)

---

## Commands Reference

### Core Commands

#### `asdm init [profile]`

Initialize ASDM config. By default writes to `~/.config/asdm/config.json` (global). Use `--local` to initialize a project-specific config instead.

```bash
asdm init                                                  # global config: ~/.config/asdm/config.json
asdm init fullstack-engineer                               # specify profile positionally
asdm init --registry github://acme/asdm-registry           # custom registry
asdm init --force                                          # overwrite existing config
asdm init --local                                          # project config: .asdm.json
asdm init --local --gitignore                              # also update .gitignore
```

| Option | Description |
|--------|-------------|
| `--registry <url>` | Registry URL in `github://org/repo` format |
| `--force` | Overwrite existing config |
| `--local` | Write to `.asdm.json` instead of `~/.config/asdm/config.json` |
| `--gitignore` | Add ASDM output dirs to `.gitignore` automatically (requires `--local`) |

---

#### `asdm sync`

Download agents, skills, and commands from the registry and emit them for all configured providers. This is the primary command you run daily.

By default, syncs using `~/.config/asdm/config.json` and installs to global provider config directories. Use `--local` to sync a project instead.

```bash
asdm sync                            # full sync to global provider config directories
asdm sync --local                    # sync using .asdm.json to project-local dirs
asdm sync --provider opencode        # sync only OpenCode files
asdm sync --force                    # re-download everything (ignore cache)
asdm sync --dry-run                  # preview changes without writing files
asdm sync --verbose                  # detailed output
```

| Option | Description |
|--------|-------------|
| `--local` | Use `.asdm.json` and install to project-local dirs instead of global provider dirs |
| `--provider <name>` | Sync only for `opencode`, `claude-code`, or `copilot` |
| `--force` | Re-download all assets, bypassing the local cache |
| `--dry-run` | Show what would change without writing anything |
| `--verbose` | Print each emitted file |

**Incremental sync:** ASDM compares the registry manifest against your local lockfile and only downloads assets that have changed. On a warm cache, unchanged projects sync in under 1 second.

---

#### `asdm verify`

Check that all managed files match their SHA-256 checksums in the lockfile.

By default, verifies globally managed files. Use `--local` to verify project-local files instead.

```bash
asdm verify                  # verify global managed files
asdm verify --local          # verify project-local files (.asdm-lock.json)
asdm verify --strict         # exit 1 on any violation (used by pre-commit hook)
asdm verify --quiet          # suppress output, just set exit code
```

**Exit codes:**
| Code | Meaning |
|------|---------|
| `0` | All managed files are intact |
| `1` | One or more files have been modified |
| `2` | Lockfile is missing — run `asdm sync` |
| `3` | Registry has a newer version available |

---

#### `asdm status`

Show the diff between your local files and what the registry would emit.

```bash
asdm status
asdm status --verbose
```

---

#### `asdm use <profile>`

Switch to a different profile. Writes the override to `.asdm.local.json` (gitignored) and re-runs sync automatically.

```bash
asdm use mobile
asdm use fullstack-engineer
asdm use data-analytics
```

The profile must be in the `allowed_profiles` list from corporate policy. `.asdm.local.json` is gitignored so each developer can maintain their own profile override without affecting the committed project config.

---

### Informational Commands

#### `asdm profiles`

List all profiles available in the registry, along with their agent/skill/command counts.

```bash
asdm profiles
```

---

#### `asdm agents`

List all agents in the active profile.

```bash
asdm agents
```

---

#### `asdm skills`

List all skills in the active profile.

```bash
asdm skills
```

---

#### `asdm commands`

List all slash commands in the active profile.

```bash
asdm commands
```

---

#### `asdm version`

Print CLI version, Node.js version, and OS details.

```bash
asdm version
```

---

### Maintenance Commands

#### `asdm doctor`

Run a full health check on the ASDM setup. Checks:

1. `.asdm.json` present
2. Registry reachable
3. Lockfile present
4. Managed files unmodified
5. All managed files on disk
6. Overlay references valid
7. `.gitignore` contains ASDM block
8. Local manifest version vs. registry

```bash
asdm doctor
```

Exits `0` if all checks pass, `1` if any fail.

---

#### `asdm clean`

Remove all ASDM-managed files. By default removes globally managed files. Use `--local` to clean a project instead.

```bash
asdm clean                             # remove all globally managed files + lockfile
asdm clean --local                     # remove project-local managed files + lockfile
asdm clean --target opencode           # only clean OpenCode files
asdm clean --target claude-code        # only clean Claude Code files
asdm clean --dry-run                   # preview what would be removed
asdm clean --local --target opencode   # only clean project-local OpenCode files
```

When run interactively (TTY), you will be prompted to confirm before any files are deleted. After cleaning, a summary shows how many files were removed and how much disk space was freed.

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview what would be removed without deleting |
| `--target <provider>` | Only clean files for a specific provider |
| `--local` | Clean project-local files instead of global provider config directories |

---

#### `asdm hooks install`

Install git hooks that automatically verify integrity before commits and sync after merges.

```bash
asdm hooks install                     # install both hooks (default)
asdm hooks install --hook pre-commit   # only install pre-commit hook
asdm hooks install --hook post-merge   # only install post-merge hook
asdm hooks uninstall                   # remove both hooks
asdm hooks uninstall --hook pre-commit # remove only pre-commit hook
```

**pre-commit hook** — Runs `asdm verify --strict --quiet` before every commit. Blocks the commit if any managed file has been tampered with.

**post-merge hook** — Runs `asdm sync` automatically after `git pull` or `git merge` when `.asdm.json` is present in the project root.

| Option | Description |
|--------|-------------|
| `--hook <type>` | `pre-commit` \| `post-merge` \| `all` (default: `all`) |

---

#### `asdm gitignore`

Add ASDM-generated output directories to `.gitignore`. Managed files should not be committed — they are regenerated by `asdm sync`.

```bash
asdm gitignore
```

Adds a clearly-marked ASDM block to `.gitignore` that covers:
- `.opencode/agents/`, `.opencode/skills/`, `.opencode/commands/`
- `.claude/agents/`, `.claude/skills/`
- `.github/agents/`, `.github/skills/`
- `.asdm.local.json` (developer profile override)

---

#### `asdm telemetry show`

Print recent local telemetry events from `.asdm-telemetry.jsonl`.

```bash
asdm telemetry show             # last 20 events
asdm telemetry show --limit 50  # last 50 events
asdm telemetry show --json      # raw JSON output
asdm telemetry clear --force    # delete the telemetry log
```

---

## Configuration

### `~/.config/asdm/config.json` — Global config (default)

Created by `asdm init`. This is the primary config file used by all commands unless `--local` is passed. Stores registry, profile, and provider settings for machine-wide installation.

```json
{
  "$schema": "https://asdm.dev/schemas/config.schema.json",
  "registry": "github://lennonalvesdias/asdm",
  "profile": "base",
  "providers": ["opencode"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `registry` | `string` | ✅ | Registry URL in `github://org/repo` format |
| `profile` | `string` | ✅ | Active profile |
| `providers` | `string[]` | — | Active providers (default: `["opencode"]`) |
| `$schema` | `string` | — | JSON Schema reference for editor validation |

### `.asdm.json` — Project config (committed to git, opt-in)

Created by `asdm init --local`. Used when running `asdm sync --local` inside a repository. Enables per-project profile and provider settings that differ from the global config.

```json
{
  "$schema": "https://asdm.dev/schemas/config.schema.json",
  "registry": "github://your-org/asdm-registry",
  "profile": "fullstack-engineer",
  "providers": ["opencode", "claude-code", "copilot"]
}
```

### `.asdm.local.json` — Developer override (gitignored)

Created automatically by `asdm use <profile>`. Never edit this manually.

```json
{
  "profile": "mobile"
}
```

### `.asdm-lock.json` — Lockfile

Generated by `asdm sync`. Records the exact SHA-256 of every emitted file and the manifest version. Enables:

- **Offline integrity checks** — `asdm verify` works without network access
- **Incremental sync** — only re-download changed assets
- **Audit trail** — full history via git blame

In global mode (the default), the lockfile is stored at `~/.config/asdm/global-lock.json`. In project-local mode (`--local`), it is stored as `.asdm-lock.json` in the project root.

### Configuration Layers

Config is resolved in three layers (highest precedence wins for non-locked fields):

```
Corporate Policy (manifest)          → locked fields cannot be overridden
          ↓
~/.config/asdm/config.json (global)  → default profile, providers, registry
          ↓
.asdm.json (project, --local)        → project-specific overrides
          ↓
.asdm.local.json (user)              → profile override via `asdm use`
```

**Locked fields** — set by the platform team in `policy.yaml` and embedded in every registry release:
- `telemetry` — cannot be disabled by developers
- `install_hooks` — enforced by policy
- `auto_verify` — enforced by policy

---

## Registry Structure

A registry is a Git repository with the following layout:

```
asdm-registry/
├── profiles/
│   ├── base/
│   │   └── profile.yaml               # Agents and skills common to all
│   ├── fullstack-engineer/
│   │   └── profile.yaml               # Extends base
│   ├── data-analytics/
│   │   └── profile.yaml               # Extends base
│   └── mobile/
│       └── profile.yaml               # Extends base
│
├── agents/
│   ├── code-reviewer.md               # Canonical agent definition
│   ├── tdd-guide.md
│   └── architect.md
│
├── skills/
│   ├── react-best-practices/
│   │   └── SKILL.md
│   └── api-design/
│       └── SKILL.md
│
├── commands/
│   ├── review.md
│   └── test.md
│
├── policy.yaml                        # Corporate policy (locked fields)
└── manifest.json                      # Generated by CI — contains SHA-256 checksums
```

### Canonical Format — Agents

Each agent is a `.md` file with YAML frontmatter followed by the agent's instruction body:

```markdown
---
name: code-reviewer
type: agent
description: "Reviews PRs for security, performance, and clean code"
version: 1.3.0
tags: [review, security, quality]

providers:
  opencode:
    model: anthropic/claude-sonnet-4
    permissions: [read, write]
    tools: [bash, glob]
  claude-code:
    model: claude-sonnet-4-20250514
    allowedTools: [Read, Write, Bash]
  copilot:
    on: pull_request
    permissions:
      pull-requests: write
---

# Code Reviewer

You are a senior code reviewer with expertise in security and design patterns.

## Rules

- NEVER approve code without proper error handling
- ALWAYS check that secrets are not hardcoded
```

### Canonical Format — Skills

```markdown
---
name: react-best-practices
type: skill
description: "React component patterns and best practices"
version: 2.0.0
trigger: "When the developer asks about React components"

providers:
  opencode:
    location: skills/react-best-practices/
  claude-code:
    location: skills/react-best-practices/
  copilot:
    applyTo: "**/*.tsx,**/*.jsx"
---

# React Best Practices

## Component Structure

- Use functional components with hooks exclusively
- Prefer composition over inheritance
```

### Profile Inheritance

Profiles support `extends` for layered inheritance. The `base` profile defines a minimum set of agents/skills that all developers share; specializations add on top:

```yaml
# profiles/fullstack-engineer/profile.yaml
name: fullstack-engineer
extends:
  - base

agents:
  - code-reviewer
  - tdd-guide
  - architect

skills:
  - react-best-practices
  - api-design

commands:
  - review
  - test

providers:
  - opencode
  - claude-code
  - copilot
```

### Publishing New Releases

The registry uses GitHub Actions to publish:

```yaml
# .github/workflows/publish.yml (on merge to main)
- scripts/build-manifest.ts  generates manifest.json with SHA-256 per asset
- gh release create vX.Y.Z   uploads manifest + all assets as release artifacts
```

ASDM fetches `releases/latest` to determine if a sync is needed, then downloads only changed assets.

---

## Providers

ASDM emits files in each provider's native format. You never write provider-specific files manually — they are all generated from the canonical `.md` sources.

### OpenCode

| Asset Type | Output Location |
|------------|-----------------|
| Agent | `.opencode/agents/{name}.md` |
| Skill | `.opencode/skills/{name}/SKILL.md` |
| Command | `.opencode/commands/{name}.md` |
| Root instructions | `AGENTS.md` |
| Config | `.opencode/opencode.jsonc` |

### Claude Code

| Asset Type | Output Location |
|------------|-----------------|
| Agent | `.claude/agents/{name}.md` |
| Skill | `.claude/skills/{name}/SKILL.md` |
| Command | `.claude/commands/{name}.md` |
| Root instructions | `CLAUDE.md` |
| Settings | `.claude/settings.json` |

### GitHub Copilot

| Asset Type | Output Location |
|------------|-----------------|
| Agent | `.github/agents/{name}.agent.md` (with YAML frontmatter) |
| Skill | `.github/skills/{name}/SKILL.md` |
| Command | `.github/skills/{name}/SKILL.md` (invocable as `/command-name` in Copilot CLI) |
| Root instructions | `.github/copilot-instructions.md` |

---

## Global Mode (Default)

By default, all ASDM commands operate in **global mode** — they read from `~/.config/asdm/config.json` and write to the global config directories of each provider. This makes your AI assistant configuration available in **every project** without per-project setup.

```bash
# First-time machine setup:
asdm init    # creates ~/.config/asdm/config.json
asdm sync    # installs to global provider dirs
asdm verify  # verify global installation
asdm clean   # remove global installation (when needed)
```

### Global provider directories

| Provider | macOS / Linux | Windows |
|----------|--------------|---------|
| OpenCode | `~/.config/opencode/` | `%APPDATA%\opencode\` |
| Claude Code | `~/.claude/` | `%APPDATA%\Claude\` |
| GitHub Copilot | `~/.config/github-copilot/` | `%APPDATA%\GitHub Copilot\` |

### How it works

ASDM strips the provider-specific prefix from each file path and writes directly to the provider's global config directory:

```
.opencode/agents/code-reviewer.md  →  ~/.config/opencode/agents/code-reviewer.md
.claude/agents/code-reviewer.md    →  ~/.claude/agents/code-reviewer.md
```

Project-root files (`AGENTS.md`, `CLAUDE.md`) are skipped in global mode — they have no meaningful global equivalent.

The global lockfile is stored at `~/.config/asdm/global-lock.json`.

## Project-Local Mode (`--local`)

Use `--local` to sync, verify, or clean a specific repository instead of global dirs. ASDM reads `.asdm.json` in the current directory and writes to project-local folders.

```bash
asdm init --local    # creates .asdm.json
asdm sync --local    # installs to project-local provider dirs
asdm verify --local  # verify project-local files (.asdm-lock.json)
asdm clean --local   # remove project-local managed files
```

The config source for `--local` mode is always `.asdm.json` in the current directory. If not found, ASDM exits with an error pointing to `asdm init --local`.

---

## Integrity & Governance

### How Integrity Works

Every sync writes a SHA-256 checksum for each emitted file into `.asdm-lock.json`. Verification compares the current state of every managed file against this lockfile.

```bash
asdm verify
# ✓ .opencode/agents/code-reviewer.md       ok
# ✗ .opencode/agents/tdd-guide.md           MODIFIED (sha256 mismatch)
# ✓ .claude/agents/code-reviewer.md         ok
```

If a managed file has been edited manually, `asdm verify` reports it as a violation and (with `--strict`) exits with code 1.

### Git Hooks

Install hooks to enforce governance automatically:

```bash
asdm hooks install
```

**pre-commit** — Blocks commits when managed files are tampered:
```sh
#!/usr/bin/env sh
# ASDM — managed pre-commit hook
npx asdm verify --strict --quiet
```

**post-merge** — Auto-syncs after `git pull`:
```sh
#!/usr/bin/env sh
# ASDM MANAGED — post-merge hook
if [ -f ".asdm.json" ]; then
  echo "🔄 ASDM: syncing after merge..."
  npx asdm sync
fi
```

### Corporate Policy

The registry's `policy.yaml` is embedded in every manifest release. It defines what developers can and cannot override:

```yaml
policy:
  locked_fields: [registry, telemetry, install_hooks]
  telemetry: true
  auto_verify: true
  install_hooks: true
  allowed_profiles:
    - base
    - fullstack-engineer
    - data-analytics
    - mobile
  allowed_providers:
    - opencode
    - claude-code
    - copilot
  min_cli_version: "1.0.0"
```

If a developer tries to use a profile or provider not in the allowed lists, ASDM exits with a clear policy violation error.

---

## Overlay System

The overlay system lets developers add personal agents or skills on top of the managed set — without modifying any managed files and without triggering integrity violations.

Create `.asdm-overlay.json` in your project root:

```json
{
  "additional_skills": [
    {
      "name": "my-custom-workflow",
      "source": "local",
      "path": "./my-skills/workflow/SKILL.md"
    },
    {
      "name": "community-skill",
      "source": "github",
      "repo": "someone/awesome-skills",
      "path": "skills/something"
    }
  ],
  "additional_agents": [],
  "provider_overrides": {
    "opencode": {
      "mcp_servers": [
        {
          "name": "local-db",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-sqlite", "./dev.db"]
        }
      ]
    }
  }
}
```

**Rules for overlays:**

- Overlays are **strictly additive** — they cannot modify or replace managed assets
- Overlay files are tracked separately in the lockfile (`managed: false`)
- `asdm verify` checks overlay files are still present but does not enforce their content (since you own them)
- `asdm doctor` validates that overlay references point to valid agents

---

## Telemetry

ASDM uses **local-only telemetry** by default. No data leaves your machine unless you set up a telemetry endpoint in your registry.

### What's collected

Events are written to `.asdm-telemetry.jsonl` in the project root:

```json
{
  "event": "sync.completed",
  "timestamp": "2026-03-31T14:22:00Z",
  "machineId": "a3f9d2b1e4c0",
  "version": "0.1.0",
  "profile": "fullstack-engineer",
  "providers": ["opencode", "claude-code"],
  "assetCount": 24,
  "durationMs": 1230
}
```

| Field | Description |
|-------|-------------|
| `machineId` | Truncated SHA-256 of hostname+username — cannot identify a person |
| `event` | One of: `sync.completed`, `sync.failed`, `verify.passed`, `verify.failed`, `init.completed`, `use.completed`, `doctor.ran` |
| `version` | CLI version |
| `profile` | Active profile name |

### Viewing and clearing telemetry

```bash
asdm telemetry show           # print recent events
asdm telemetry show --json    # raw JSON
asdm telemetry clear --force  # delete the log
```

### Disabling telemetry

If the corporate policy allows it (the `telemetry` field is not locked), you can disable telemetry locally:

```json
{
  "registry": "github://your-org/asdm-registry",
  "profile": "fullstack-engineer",
  "telemetry": false
}
```

> **Note:** If the platform team has locked `telemetry: true` in policy, this field will be ignored.

---

## Contributing

### Adding a new agent or skill to the registry

1. Fork the registry repo and create a branch
2. Add your `.md` file under `agents/`, `skills/`, or `commands/`
3. Add the asset to the appropriate `profile.yaml` files
4. Run `npm run validate:registry` to validate your schema
5. Open a PR — CI will run schema validation and a dry-run manifest build
6. On merge to main, CI publishes a new GitHub Release automatically

### Canonical format schema

All registry `.md` files are validated against JSON Schemas at `schemas/` in the registry. The frontmatter must conform to:

- `schemas/agent.schema.json` for agents
- `schemas/skill.schema.json` for skills
- `schemas/command.schema.json` for commands
- `schemas/profile.schema.json` for profiles

### SPEC.md

The full technical specification is in [`specs/0001/SPEC.md`](specs/0001/SPEC.md). It documents the architecture, security model, telemetry schema, and the full roadmap.

### Adding a new provider adapter

1. Create `src/adapters/{provider}.ts` implementing the `EmitAdapter` interface from `src/adapters/base.ts`
2. Register the adapter in `src/core/syncer.ts` in the `loadAdapters` switch
3. Add the provider name to the union type in `src/core/config.ts`
4. Write tests in `tests/unit/adapters/{provider}.test.ts`

---

## License

MIT © ASDM Contributors

See [LICENSE](LICENSE) for the full text.

---

<details>
<summary>Architecture overview</summary>

```
DEV MACHINES
  │
  │  npx asdm sync
  ▼
ASDM CLI
  ├── Syncer       (diff, fetch, cache)
  ├── Verifier     (sha256, lockfile)
  ├── Emitters     (opencode, claude-code, copilot)
  └── Telemetry    (local JSONL)
  │
  │  HTTPS (GitHub API)
  ▼
GIT-BASED REGISTRY (GitHub Releases)
  ├── manifest.json     (SHA-256 checksums + corporate policy)
  └── assets/           (agents, skills, commands as .md files)
```

</details>
