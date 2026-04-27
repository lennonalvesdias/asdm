# AGENTS.md

## Stack

- **Desktop app**: Tauri 2 (Rust backend) + React 19 + TypeScript + Vite 7
- **Styling**: Tailwind CSS v4 — no `tailwind.config.*`, theme defined via `@theme` in `src/index.css`
- **State**: Zustand 5 stores in `src/stores/` (no reducers, direct mutations)
- **Data fetching**: TanStack Query v5 installed but not yet wired to live data — stores are hydrated manually
- **Routing**: TanStack Router installed but **not used** — view switching is manual via `ui.store.ts`

## Commands

```sh
npm run dev          # Vite dev server only (frontend, port 1420)
npm run build        # tsc && vite build (typecheck + bundle)
npx tauri dev        # Full Tauri desktop app (starts Vite + Rust, opens window)
npx tauri build      # Production binary
```

- `npm run dev` alone gives the frontend in a browser with no Tauri APIs available.
- `npx tauri dev` is required to test any `invoke()` Tauri commands.

## Mock Mode

Set `VITE_MOCK_MODE=true` (in `.env`) to bypass all Tauri `invoke()` calls and seed stores from `src/lib/mock-data.ts`. Use this for UI-only work without needing Rust compiled or a real Azure token.

## Directory Layout

```
src/                        # Frontend
  main.tsx / App.tsx        # Entry; auth gate → AppShell or AuthView
  features/                 # One dir per feature (auth, board, task-detail, agent-runner, dashboard, settings)
  stores/                   # Zustand: auth.store, board.store, agent.store, ui.store
  lib/                      # azure-boards.ts, mock-data.ts, use-mock-init.ts, cn.ts
  types/                    # Shared TS types (work-item, provider, agent, workflow)
src-tauri/src/
  lib.rs                    # Registers all Tauri plugins + invoke_handler
  commands/                 # auth.rs (OAuth PKCE), agent.rs (subprocess runner), registry.rs (ASDM git sync)
```

## Architecture Notes

- **No backend server** — all REST calls to Azure Boards are made from the Rust process via `reqwest`.
- **Auth** (`commands/auth.rs`): OAuth 2.0 PKCE; opens system browser, captures callback on a local TCP loopback server. Tokens stored in `localStorage` under key `cockpit-auth` via Zustand persist.
- **Agent runner** (`commands/agent.rs`): Spawns a local subprocess; streams stdout/stderr to frontend via Tauri events `agent:log:{execution_id}` and `agent:done:{execution_id}`. Injects env vars: `COCKPIT_WORK_ITEM_ID`, `COCKPIT_WORK_ITEM_TITLE`, `COCKPIT_WORK_ITEM_DESCRIPTION`, `COCKPIT_REPO_PATH`, `COCKPIT_BRANCH`.
- **Registry sync** (`commands/registry.rs`): `sync_registry` git-clones/pulls an ASDM registry URL, then scans `.opencode/agents/`, `.opencode/skills/`, `.opencode/commands/`.
- **`cancel_agent`** is stubbed — no PID tracking implemented yet.

## Toolchain Quirks

- **ESLint**: `eslint-config-prettier` is installed but there is **no ESLint config file** — running `eslint` will fail.
- **Prettier**: installed with no config file — runs with defaults.
- **Vitest**: installed (`^4.1.4`) but no tests exist and no `vitest.config.*` is present.
- **TypeScript**: `noUnusedLocals` and `noUnusedParameters` are enabled — adding unused variables breaks `npm run build`.
- Vite env prefixes: `VITE_` (frontend-accessible) and `TAURI_ENV_*` (Tauri-injected, available in `vite.config.ts`).

## Not Yet Implemented

Avoid assuming these exist:

- Live Azure Boards data loading — `AzureBoardsClient` is built but not wired to any TanStack Query hooks
- TanStack Router route definitions — currently installed but unused
- OS keychain storage — auth tokens go to `localStorage`
- Dashboard, Workflow, and Team views — files exist but are stubs
- CI/CD, pre-commit hooks, test suite
