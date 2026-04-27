# Engineering Cockpit — Session Knowledge Base

> Last updated: April 2026. Generated for AI session continuity.

---

## Goal

Desktop app (**engineering-cockpit**) — Tauri 2 + React 19 + TypeScript. Integrates with Azure Boards, GitHub, and executes OpenCode CLI commands via an embedded PTY terminal.

---

## Stack

- **Desktop**: Tauri 2 (Rust backend) + React 19 + TypeScript + Vite 7
- **Styling**: Tailwind CSS v4 — no `tailwind.config.*`, theme via `@theme` in `src/index.css`
- **State**: Zustand 5 stores in `src/stores/` (no reducers, direct mutations via `set`)
- **Data fetching**: TanStack Query v5 installed but **not yet wired** to live data
- **Routing**: TanStack Router installed but **not used** — view switching via `ui.store.ts`

## Commands

```sh
npm run dev          # Vite dev server only (browser, port 1420)
npm run build        # tsc && vite build (typecheck + bundle)
npx tauri dev        # Full Tauri desktop app (Vite + Rust, opens window)
npx tauri build      # Production binary
```

- `npm run dev` = browser only, no Tauri APIs.
- `npx tauri dev` required for any `invoke()` or PTY calls.
- `VITE_MOCK_MODE=true` (`.env`) → bypasses all `invoke()`, seeds stores from `src/lib/mock-data.ts`.

---

## TypeScript Strictness

- `noUnusedLocals` and `noUnusedParameters` are **enabled** — any unused import/variable breaks `npm run build`.
- Always remove unused imports when editing files.

---

## Directory Layout

```
src/                        # Frontend
  main.tsx / App.tsx        # Entry; auth gate → AppShell or AuthView
  features/                 # One dir per feature
    auth/                   # AuthView
    board/                  # SprintView
    dashboard/              # DashboardView (stub)
    task-detail/            # TaskDetailView + CommandBar
    reviews/                # ReviewsView (GitHub PRs)
    settings/               # SettingsView
  stores/                   # Zustand stores
    auth.store.ts
    board.store.ts
    agent.store.ts          # PTY state, commands, executions
    ui.store.ts             # zoom, activeView, detailPanelWidth
    github.store.ts         # PAT, user, pullRequestsToReview
  components/
    layout/
      AppShell.tsx          # Main layout: sidebar + main + detail panel + bottom panel
      Sidebar.tsx           # Nav items; Reviews badge = prCount
      BottomPanel.tsx       # Wraps PtyTerminal; shows when isPanelOpen=true
    terminal/
      PtyTerminal.tsx       # xterm.js + Tauri PTY integration
    ui/                     # StatusBadge, TypeBadge, PriorityBadge, etc.
  lib/
    azure-boards.ts
    mock-data.ts            # Mock commands have tagsAction: [] field
    use-mock-init.ts
    cn.ts
  types/
    agent.types.ts          # AgentDefinition, CommandDefinition, AsdmRegistry, etc.
    github.types.ts         # GitHubUser, GitHubPullRequest
    work-item.types.ts      # WorkItem, WorkItemStatus, Sprint, etc.
    index.ts                # re-exports all types

src-tauri/src/
  lib.rs                    # Registers all Tauri plugins + invoke_handler
  commands/
    mod.rs                  # pub mod auth, agent, registry, pty, github
    auth.rs                 # OAuth 2.0 PKCE; opens browser, captures on TCP loopback
    agent.rs                # run_agent (subprocess), cancel_agent (stubbed)
    registry.rs             # sync_registry, scan_local_registry, load_opencode_commands
    pty.rs                  # spawn_pty, write_pty, resize_pty, kill_pty
    github.rs               # get_github_user, get_github_pull_requests_to_review
```

---

## Architecture Notes

- **No backend server** — all REST calls to Azure Boards are from Rust via `reqwest`.
- **Auth** (`auth.rs`): OAuth 2.0 PKCE. Opens system browser, captures callback on a local TCP loopback server. Tokens stored in `localStorage` under key `cockpit-auth` via Zustand persist.
- **PTY terminal** (`pty.rs`): uses `portable-pty` crate. Sessions in `DashMap<String, PtySession>`. `PtySession` has `master: Arc<Mutex<Box<dyn MasterPty + Send>>>` and `writer: Arc<Mutex<Box<dyn Write + Send>>>` (writer via `take_writer()`). Reader thread emits Tauri events `pty:output:{session_id}` (String) and `pty:exit:{session_id}` (u32 exit code).
- **Commands** (`registry.rs`): `load_opencode_commands` scans flat `.md` files from `~/.config/opencode/commands/`. Parses YAML frontmatter for `description`, `tags`, and `metadata.tags-action`. `CommandEntry` has `#[serde(rename_all = "camelCase")]` so `tags_action` → `tagsAction` in JSON.
- **GitHub PRs** (`github.rs`): `get_github_pull_requests_to_review` uses GitHub Search API with PAT.
- **Registry sync** (`registry.rs`): `sync_registry` git-clones/pulls an ASDM registry URL, scans `.opencode/agents/`, `.opencode/skills/`, `.opencode/commands/` (subdirectories).
- **`cancel_agent`** is stubbed — no PID tracking.
- **Zoom**: `document.documentElement.style.zoom` via `ZoomController` in `App.tsx`. Persisted in `cockpit-ui` localStorage.
- **Bottom panel**: conditionally rendered `{isPanelOpen && <BottomPanel />}` in `AppShell.tsx`. Fixed position at bottom, 280px height.
- **Detail panel**: resizable via drag handle in `AppShell.tsx`. Width `detailPanelWidth` persisted in `cockpit-ui`, range 280–900px.

---

## Rust Dependencies (Cargo.toml)

Key crates:

- `portable-pty = "0.8"` — PTY spawning
- `dashmap = "6"` — concurrent HashMap for PTY sessions
- `serde_yaml = "0.9"` — YAML frontmatter parsing
- `reqwest 0.12` — HTTP client (used in auth.rs, github.rs)
- `tokio 1 full` — async runtime
- `chrono` — timestamps in registry scan

---

## Tauri Commands Registered (lib.rs)

```rust
start_oauth, refresh_oauth_token, get_azure_user_profile,
run_agent, cancel_agent,
sync_registry, scan_local_registry, load_opencode_commands,
spawn_pty, write_pty, resize_pty, kill_pty,
get_github_user, get_github_pull_requests_to_review,
```

---

## Stores

### `agent.store.ts` — NOT persisted (in-memory)

Key state:

- `commands: CommandDefinition[]` — loaded from `~/.config/opencode/commands/` on startup
- `isPanelOpen: boolean` — controls BottomPanel visibility
- `activePtySessionId: string | null` — passed to `PtyTerminal` as prop
- `pendingPtySpawn: PendingPtySpawn | null` — signals PtyTerminal to spawn a PTY

`PendingPtySpawn` interface:

```ts
{
  sessionId: string;
  command: string;       // "opencode"
  args: string[];
  cwd: string | null;
  envVars: Record<string, string>;
  cols: number;
  rows: number;
  slashCommand: string;  // injected after 800ms startup
}
```

Key actions: `openPanel`, `closePanel`, `openPtySession`, `closePtySession`, `setActivePtySession`, `setPendingPtySpawn`, `setCommands`.

### `ui.store.ts` — persisted as `cockpit-ui`

Key state:

- `activeView: ActiveView` — `'sprint' | 'my-tasks' | 'board' | 'team' | 'dashboard' | 'settings' | 'workflow' | 'reviews'`
- `zoomLevel: number` — default 1.0, range 0.7–1.5, step 0.1
- `detailPanelWidth: number` — default 500, range 280–900

### `github.store.ts` — persisted as `cockpit-github` (only `pat` field)

Key state: `pat`, `user`, `pullRequestsToReview`, `isLoading`, `error`.

---

## Types

### `CommandDefinition` (`agent.types.ts`)

```ts
{
  id: string;
  name: string;
  description: string;
  command: string;
  filePath: string;
  args?: string[];
  tags: string[];
  tagsAction: string[];   // matches metadata.tags-action in frontmatter
}
```

### `WorkItem` (`work-item.types.ts`)

Key fields: `id`, `title`, `description`, `status: WorkItemStatus`, `type: WorkItemType`, `priority`, `tags: string[]`, `assignee`, `iteration`, `storyPoints`, `availableTransitions`, `providerMetadata`.

---

## PTY Terminal — How It Works

### Running a command (`CommandBar.tsx` or `TaskDetailView.tsx`)

```ts
const sessionId = nanoid();
openPtySession(sessionId);        // add to ptySessions
setActivePtySession(sessionId);   // activePtySessionId → PtyTerminal gets this prop
openPanel();                      // isPanelOpen=true → BottomPanel mounts
setPendingPtySpawn({              // PtyTerminal detects this
  sessionId,
  command: "opencode",
  slashCommand: cmd.name,
  envVars: { COCKPIT_WORK_ITEM_ID, COCKPIT_WORK_ITEM_TITLE, ... },
  cols: 120, rows: 30, cwd: null, args: [],
});
// ← DO NOT call spawn_pty here
```

### `PtyTerminal.tsx` — effect order on mount

1. **Mount effect** (`[initTerminal]`): creates `Terminal` (xterm.js), opens in `containerRef`, fits. Sets `termRef.current` and `fitAddonRef.current`.
2. **`sessionId` effect**: clears terminal, writes `(session: xxx)` indicator, wires `term.onData` → `invoke("write_pty", ...)`.
3. **`pendingPtySpawn` effect**:
   - Guards: `pendingPtySpawn.sessionId === sessionId` AND `processedSpawnRef.current !== sessionId`
   - Sets `processedSpawnRef.current = sessionId` (prevents double-spawn on re-renders)
   - **DOES NOT call `setPendingPtySpawn(null)`** — doing so would cause React to run cleanup (`mounted=false`) before `await listen()` resolves, killing the spawn
   - Awaits `listen("pty:output:...")` and `listen("pty:exit:...")` registration
   - THEN calls `invoke("spawn_pty", ...)`
   - THEN after 800ms calls `invoke("write_pty", { data: "/{slashCommand}\n" })`
4. **Resize effect** (`[sessionId]`): `ResizeObserver` → `fitAddon.fit()` → `invoke("resize_pty", ...)`.

### Key bug that was fixed

`BottomPanel` is `{isPanelOpen && <BottomPanel />}` — it unmounts when panel closes. When a command runs, `openPanel()`, `setActivePtySession()`, and `setPendingPtySpawn()` are batched into one React render. `PtyTerminal` mounts for the first time with all state already set. The old code called `setPendingPtySpawn(null)` inside the effect, which triggered React cleanup (`cancelled=true`) before `await listen()` resolved, preventing the spawn. Fixed with `processedSpawnRef`.

---

## Commands Feature — Tag-Based Filtering

Command `.md` files in `~/.config/opencode/commands/` have YAML frontmatter:

```yaml
---
description: Generates TypeScript types from a JSON Schema
model: github-copilot/claude-haiku-4.5
metadata:
  tags-action: [validated, spec-generated, tasks-created]
---
```

- `metadata.tags-action` → list of PBI tags for which this command is available
- `CommandBar` shows commands where `cmd.tagsAction.some(tag => workItem.tags.includes(tag))`
- Loaded at startup in `AppContentReal` via `invoke("load_opencode_commands")`
- In mock mode, commands are seeded from `src/lib/mock-data.ts` with `tagsAction: []`

---

## Views

| View        | Status                     | Component                                                             |
| ----------- | -------------------------- | --------------------------------------------------------------------- |
| `sprint`    | Live                       | `SprintView`                                                          |
| `my-tasks`  | Live (filtered SprintView) | `SprintView` with `filterMyTasks`                                     |
| `dashboard` | Live (stub)                | `DashboardView`                                                       |
| `settings`  | Live                       | `SettingsView` — Account, Display (zoom), GitHub PAT, ASDM Registries |
| `reviews`   | Live                       | `ReviewsView` — GitHub PRs awaiting review                            |
| `board`     | Stub                       | StubView                                                              |
| `team`      | Stub                       | StubView                                                              |
| `workflow`  | Stub                       | StubView                                                              |

---

## Not Yet Implemented

- Live Azure Boards data loading — `AzureBoardsClient` built but not wired
- TanStack Router routes — installed but unused
- OS keychain storage — tokens go to `localStorage`
- `cancel_agent` — no PID tracking
- CI/CD, pre-commit hooks, test suite
- Board, Team, Workflow views

---

## File Reference (key files to edit)

```
src/App.tsx                                  ← ZoomController + AppContentReal (loads commands)
src/stores/agent.store.ts                    ← PTY state, pendingPtySpawn, commands
src/stores/ui.store.ts                       ← zoom, activeView, detailPanelWidth (persisted)
src/stores/github.store.ts                   ← PAT, user, PRs (PAT persisted)
src/components/layout/AppShell.tsx           ← drag handle, Sidebar, BottomPanel (conditional)
src/components/layout/Sidebar.tsx            ← nav items, Reviews badge
src/components/layout/BottomPanel.tsx        ← PtyTerminal wrapper + header
src/components/terminal/PtyTerminal.tsx      ← xterm.js + PTY events (processedSpawnRef pattern)
src/features/task-detail/TaskDetailView.tsx  ← runCommand → setPendingPtySpawn
src/features/task-detail/CommandBar.tsx      ← tag-filtered quick actions
src/features/reviews/ReviewsView.tsx         ← GitHub PR list
src/features/settings/SettingsView.tsx       ← zoom slider + GitHub PAT
src/lib/mock-data.ts                         ← mock commands (tagsAction: [] on each)
src/types/agent.types.ts                     ← CommandDefinition.tagsAction: string[]
src-tauri/src/lib.rs                         ← invoke_handler registrations
src-tauri/src/commands/registry.rs           ← load_opencode_commands + CommandEntry
src-tauri/src/commands/pty.rs                ← spawn/write/resize/kill PTY
src-tauri/src/commands/github.rs             ← GitHub API calls
src-tauri/Cargo.toml                         ← portable-pty, dashmap, serde_yaml
```
