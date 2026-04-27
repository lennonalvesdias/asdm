# 🖥️ ASDM Cockpit — Engineering Desktop App

> **Your team's AI-assisted delivery hub.**
> Sprint board, PR reviews, and an embedded terminal — all in one desktop window.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-blue.svg)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg)](https://www.typescriptlang.org)

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Run in browser only (no Tauri APIs)
npm run dev

# Run full desktop app (Vite + Rust backend, opens a window)
npx tauri dev
```

> **Note:** `npm run dev` starts a browser-only Vite dev server. Any feature that calls `invoke()` (PTY terminal, registry sync, GitHub) requires `npx tauri dev`.

Set `VITE_MOCK_MODE=true` in `.env` to bypass all `invoke()` calls and seed the app with data from `src/lib/mock-data.ts` — no Tauri installation needed.

---

## What is ASDM Cockpit?

Cockpit is a desktop application that brings your engineering workflow together in a single place. It connects to Azure Boards for sprint management, GitHub for pull request reviews, and runs [OpenCode](https://opencode.ai) AI commands via an embedded terminal — all driven by the agents and skills managed by the [ASDM CLI](../cli/README.md).

### Views

| View | Status | Description |
|------|--------|-------------|
| Sprint | ✅ Live | Azure Boards sprint backlog — all work items |
| My Tasks | ✅ Live | Sprint view filtered to the authenticated user |
| Reviews | ✅ Live | GitHub pull requests awaiting your review |
| Dashboard | 🔧 Stub | Summary dashboard |
| Settings | ✅ Live | Azure account, GitHub PAT, zoom, ASDM registries |
| Board | 🔧 Stub | Kanban board |
| Team | 🔧 Stub | Team capacity view |
| Workflow | 🔧 Stub | Workflow automation |

### Embedded PTY Terminal

The bottom panel hosts a full PTY terminal powered by [xterm.js](https://xtermjs.org) and Tauri's `portable-pty` integration. When you run an AI command from a work item, Cockpit:

1. Spawns an OpenCode process in a PTY session
2. Injects the slash command after startup
3. Streams output live in the terminal panel

Command availability is tag-based — only commands whose `metadata.tags-action` frontmatter overlaps with the work item's tags are shown in the command bar.

---

## Installation

### Prerequisites

- [Node.js ≥ 18](https://nodejs.org)
- [Rust](https://rustup.rs) (for full desktop build)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

### Setup

```bash
# 1. Clone and install
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
```

---

## Commands Reference

```bash
npm run dev        # Vite dev server only (browser, port 1420)
npm run build      # tsc + vite build (typecheck + bundle)
npm run preview    # Preview the Vite production build
npx tauri dev      # Full desktop app (Vite + Rust, opens window)
npx tauri build    # Production binary
```

---

## Configuration

### `.env` — Environment variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Azure DevOps OAuth2 App Registration
# Create an app at: https://app.vsaex.visualstudio.com/app/register
VITE_AZURE_CLIENT_ID=your-azure-app-client-id-here
VITE_AZURE_TENANT_ID=organizations

# Optional: Set to your org URL to skip the settings step
VITE_AZURE_ORG_URL=https://dev.azure.com/your-org
VITE_AZURE_PROJECT=YourProject
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_AZURE_CLIENT_ID` | ✅ | OAuth2 app client ID from Azure DevOps |
| `VITE_AZURE_TENANT_ID` | ✅ | `organizations` for multi-tenant or your tenant ID |
| `VITE_AZURE_ORG_URL` | — | Pre-fill Azure org URL to skip the settings step |
| `VITE_AZURE_PROJECT` | — | Pre-fill Azure project name |
| `VITE_MOCK_MODE` | — | Set to `true` to run with mock data, no Tauri needed |

### GitHub PAT

To enable PR reviews, add a GitHub Personal Access Token in **Settings → GitHub**. The PAT is stored in `localStorage` (key `cockpit-github`). Required scopes: `repo`, `read:user`.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS v4 (theme via `@theme` in `index.css`) |
| State | Zustand 5 |
| Data fetching | TanStack Query v5 |
| Terminal | xterm.js + `portable-pty` (Rust) |
| HTTP | `reqwest` (Rust, for Azure Boards and GitHub APIs) |

---

## Architecture

```
COCKPIT (Tauri 2)
  │
  ├── React Frontend (Vite)
  │     ├── SprintView          (Azure Boards backlog)
  │     ├── ReviewsView         (GitHub PRs)
  │     ├── TaskDetailView      (work item + CommandBar)
  │     └── BottomPanel         (xterm.js terminal)
  │
  └── Rust Backend (Tauri commands)
        ├── auth.rs             (OAuth 2.0 PKCE — Azure DevOps)
        ├── github.rs           (GitHub Search API)
        ├── registry.rs         (ASDM registry sync + local scan)
        ├── agent.rs            (subprocess execution)
        └── pty.rs              (PTY spawn/write/resize/kill)
```

All Azure Boards and GitHub API calls are made from Rust via `reqwest` — there is no intermediate backend server. Authentication uses OAuth 2.0 PKCE: Cockpit opens the system browser and captures the callback on a local TCP loopback server.

---

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## License

MIT © ASDM Contributors

See [LICENSE](../LICENSE) for the full text.
