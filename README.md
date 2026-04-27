# ⚙️ ASDM — Agentic Software Delivery Model

> **Write Once, Emit Many.**
> One source of truth for all your AI coding assistant configurations — with a desktop app to run them.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is ASDM?

ASDM solves a real problem: every AI coding assistant speaks a different dialect. OpenCode, Claude Code, and GitHub Copilot each expect agents, skills, and commands in their own proprietary format and directory layout.

ASDM introduces a **canonical format** — `.asdm.md` files — that serves as the single source of truth. A single `asdm sync` command converts them into every provider's native layout simultaneously, across your entire team.

---

## Components

This repository contains two components that work together:

### [`cli/`](./cli/README.md) — ASDM CLI

The command-line tool that manages your AI assistant configurations.

- Syncs agents, skills, and commands from a Git-based registry to every configured provider
- Enforces corporate policy: allowed profiles, locked fields, and SHA-256 integrity verification
- Supports project-local and global (machine-wide) installation modes
- Integrates with git via pre-commit and post-merge hooks

```bash
npm install -g asdm-cli
asdm init && asdm sync
```

→ **[Full CLI documentation](./cli/README.md)**

---

### [`cockpit/`](./cockpit/README.md) — ASDM Cockpit

A desktop application that brings your engineering workflow together in one window.

- Azure Boards sprint backlog and task management
- GitHub pull request review queue
- Embedded PTY terminal for running OpenCode AI commands directly from work items
- Powered by the agents and skills managed by the ASDM CLI

```bash
cd cockpit
npm install && npx tauri dev
```

→ **[Full Cockpit documentation](./cockpit/README.md)**

---

## License

MIT © ASDM Contributors
