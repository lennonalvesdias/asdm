# Engineering Cockpit — Platform Plan

## Vision

A corporate desktop platform (Tauri 2) that gives engineering teams superpowers across the entire software development lifecycle. Centralizes task management, AI agents, skills and commands into a single IDE-like command center.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Platform | Tauri 2 (Rust + WebView) | ~10MB binary, native OS access, keychain, shell |
| Frontend | React 18 + TypeScript + Vite | Ecosystem, DX, component model |
| Styling | Tailwind CSS v4 | Utility-first, design tokens, dark theme |
| State | Zustand | Minimal boilerplate, Tauri-friendly |
| Data fetching | TanStack Query | Caching, background sync, optimistic updates |
| Board Provider (MVP) | Azure Boards | Enterprise-first |
| Auth | OAuth 2.0 PKCE + OS Keychain | Secure, no backend needed for tokens |
| Registry | Git-based (ASDM pattern) | Skills/Agents/Commands as code |
| Agent Runtime | Local shell execution | Direct filesystem access, low latency |
| Backend | Hybrid — API centralizada para config + Tauri direct calls to providers | No token exposure to backend |

## Feature Modules

### 1. Board Integration (Azure Boards)
- Work Items listing with filters (assigned to me, sprint, status)
- Unified work item model: `WorkItem` with `providerMetadata`
- Status pipeline: Backlog → Active → Code Review → Testing → Done
- Actions per status: available transitions + custom actions
- Direct API calls from Tauri (Rust HTTP client)

### 2. Agent Runtime
- Discover agents from ASDM Git registry
- Inject task context (title, description, branch, repo path)
- Execute agent as local subprocess
- Stream stdout/stderr to embedded terminal panel
- Save execution history per work item

### 3. Workflow Engine
- Tech lead configures stages and gates per project
- Rule engine: if (trigger) when (conditions) then (actions)
- Gates: code coverage threshold, PR approval, pipeline status
- Automations: on status change, on PR merge, on pipeline event
- RBAC: Admin > Tech Lead > Developer

### 4. ASDM Registry
- Configure Git repo URL for company registry
- Sync via git pull on app start and on demand
- Discover skills, commands, agents from .opencode/ structure
- Surface relevant skills/agents per work item type

### 5. Tech Lead Dashboard
- Team overview: who is working on what
- Cycle time and throughput charts
- Blockers and at-risk items
- Workflow configuration UI
- Rule engine editor

## UI Layout (IDE-like)

```
┌─────────────────────────────────────────────────────────┐
│ Titlebar: logo + workspace selector + user avatar        │
├──────────┬──────────────────────────────────────────────┤
│          │                                               │
│ Sidebar  │            Main Panel                         │
│          │  (Work Item Detail / Dashboard / Settings)    │
│ - Sprint │                                               │
│   Tasks  │                                               │
│ - My     │                                               │
│   Tasks  ├───────────────────────────────────────────────│
│ - Board  │                                               │
│ - Team   │         Bottom Panel (Agent Terminal)         │
│          │                                               │
│ [Nav]    │                                               │
└──────────┴───────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4
- **State**: Zustand, TanStack Query v5
- **UI Primitives**: Radix UI
- **Icons**: Lucide React
- **Desktop**: Tauri 2 (Rust)
- **Rust deps**: reqwest, serde, tauri-plugin-store, tauri-plugin-shell, tauri-plugin-oauth, tauri-plugin-keyring
- **Auth**: OAuth 2.0 PKCE (Azure DevOps)
- **Registry**: Git-based (ASDM)

## Roadmap

### MVP (V1)
- [x] Project scaffold
- [ ] Tauri setup + Rust commands
- [ ] OAuth 2.0 PKCE with Azure DevOps
- [ ] Work Items listing and detail
- [ ] Status transitions
- [ ] ASDM registry sync
- [ ] Agent execution with embedded terminal
- [ ] IDE-like layout (sidebar + main + bottom)

### V2
- [ ] Multi-provider (Jira, Trello)
- [ ] Rule engine full UI
- [ ] Tech Lead dashboard with metrics
- [ ] Workflow designer (drag & drop)
- [ ] CI/CD gates integration
- [ ] Notification center
- [ ] Custom branding per org
