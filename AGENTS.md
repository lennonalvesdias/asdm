# AGENTS.md — ASDM Developer Guide for AI Coding Agents

This file documents conventions, commands, and patterns for AI agents working in this repository.

---

## Build / Test / Lint Commands

```bash
# Run all tests (single pass)
npm test

# Run a single test file
npm test -- tests/unit/core/hash.test.ts

# Run tests matching a name pattern
npm test -- --grep "hashString"

# Watch mode
npm run test:watch

# Type check (authoritative — no emit)
npm run typecheck

# Lint
npm run lint

# Build CLI bundle → dist/index.mjs
npm run build

# Build manifest (computes SHA-256 hashes for registry assets)
npm run build:manifest

# Validate registry integrity
npm run validate:registry

# Run built CLI
node dist/index.mjs --help
node dist/index.mjs version
```

> **Note**: `npm run build` triggers `prebuild` which runs `validate:registry` first.  
> Use `npm run typecheck` for fast feedback; it is the authoritative TypeScript check.

---

## Project Layout

```
src/
├── adapters/       # Output format adapters: opencode, claude-code, copilot
├── cli/
│   ├── index.ts    # CLI entry point — registers all commands
│   └── commands/   # One file per command (init, sync, verify, …)
├── core/           # Business logic: config, syncer, verifier, registry, …
└── utils/          # Shared: errors, logger, fs, gitignore, hash

registry/           # Static registry content (agents, skills, commands, profiles)
schemas/            # JSON Schema files for all ASDM asset types
scripts/            # build-manifest.ts, validate.ts (run via tsx)
tests/
├── unit/           # Unit tests mirroring src/ structure
├── integration/    # Integration tests
└── fixtures/       # Test data (agents, profiles, manifests, lockfiles)

~/.config/asdm/config.json       # global config (created by `asdm init --global`)
~/.config/asdm/global-lock.json  # global lockfile (created by `asdm sync --global`)
```

---

## TypeScript Rules (strict mode)

- `target`: ES2022, `module`: ESNext, `moduleResolution`: bundler
- Strict mode enabled: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Prefix intentionally unused parameters with `_` (e.g., `_ctx`, `_targetDir`)
- Do **not** use `any` — use `unknown` and narrow, or a typed interface
- Explicit return types required on exported functions
- Use `as const` to preserve literal types for constant objects

---

## Import Conventions

```typescript
// Node.js built-ins — use `node:` prefix, no extension
import path from 'node:path'
import { readFile } from 'node:fs/promises'

// External npm packages — no extension
import { defineCommand } from 'citty'
import { parse } from 'yaml'

// Local TypeScript files — MUST use .js extension (ESM)
import { sync } from './syncer.js'
import type { EmitAdapter } from '../adapters/base.js'

// Type-only imports — use `import type`
import type { ParsedAsset } from '../core/parser.js'

// Dynamic / optional imports
const os = await import('node:os')
```

**Rule**: All relative imports to local `.ts` files must end with `.js`. No exceptions.

---

## Naming Conventions

| Construct              | Convention              | Example                                     |
| ---------------------- | ----------------------- | ------------------------------------------- |
| Functions / variables  | `camelCase`             | `resolveProfile`, `dryRun`                  |
| Classes / Interfaces   | `PascalCase`            | `OpenCodeAdapter`, `SyncOptions`            |
| Module-level constants | `UPPER_SNAKE_CASE`      | `ADAPTER_NAME`, `VERIFY_EXIT_CODES`         |
| CLI arg keys           | `kebab-case`            | `'dry-run'`, `'no-emit'`                    |
| Ignored parameters     | `_` prefix              | `_ctx`, `_targetDir`                        |
| Type unions            | `type` keyword          | `type ViolationType = 'modified' \| …`     |
| Data shapes            | `interface` keyword     | `interface SyncOptions { … }`               |

---

## Error Handling

```typescript
// Use typed error classes — never throw bare Error in core/cli
import { IntegrityError, ConfigError, NetworkError } from '../utils/errors.js'
throw new IntegrityError('message', 'optional user suggestion')

// Error class codes: CONFIG_ERROR, INTEGRITY_ERROR, REGISTRY_ERROR,
//                    PARSE_ERROR, POLICY_ERROR, NETWORK_ERROR, SCHEMA_ERROR

// In CLI commands — always catch and print, then exit 1
try {
  await sync(options)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  const suggestion = (err as { suggestion?: string }).suggestion
  logger.error(message, suggestion)
  process.exit(1)
}

// Telemetry is fire-and-forget — never let it propagate
telemetry?.write({ event: 'sync.failed', error: msg }).catch(() => {})
```

---

## Logger API (CLI layer only — never in core/adapters)

```typescript
import { logger } from '../../utils/logger.js'

logger.asdm('Starting sync…')          // Brand prefix
logger.success('Done')                  // Green ✓
logger.error('msg', 'suggestion')       // Red ✗ + optional hint
logger.warn('msg')                      // Yellow ⚠
logger.info('msg')                      // Blue ℹ
logger.step('msg')                      // Progress step
logger.divider()                        // Horizontal rule
logger.table([['Key', 'Value'], …])    // Aligned key-value table
logger.status('check', 'ok'|'fail'|'warn'|'skip')  // Doctor checks
```

> **Strict rule**: No `console.log` or `logger.*` calls in `src/core/` or `src/adapters/`. All output is CLI-layer only.

---

## Exit Codes

| Code | Meaning                        | Used by              |
| ---- | ------------------------------ | -------------------- |
| `0`  | Success                        | All commands         |
| `1`  | Error / integrity violation    | All commands, verify |
| `2`  | No lockfile (not synced yet)   | `verify`             |
| `3`  | Outdated (needs sync)          | `verify`             |

Import `VERIFY_EXIT_CODES` from `src/core/verifier.js` — never hardcode these numbers.

---

## Test Patterns

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('ModuleName', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'asdm-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('should describe expected behaviour', async () => {
    const result = await myFunction(tmpDir)
    expect(result).toEqual({ … })
  })
})
```

- Test files live in `tests/unit/<module>/` mirroring `src/` structure
- Use `vitest` globals (`describe`, `it`, `expect`) — they do not need to be imported (globals: true), but importing from `'vitest'` is also acceptable and preferred for clarity
- The build-time constant `__ASDM_VERSION__` is defined as `'0.0.0-test'` in vitest config

---

## Adding a New CLI Command

1. Create `src/cli/commands/<name>.ts` — export default `defineCommand({ … })`
2. Register in `src/cli/index.ts` under `subCommands`
3. Guard: read config at top, exit 1 with helpful message if not initialized
4. Pattern: `try { await coreFunction(opts) } catch (err) { logger.error(…); process.exit(1) }`

## Adding a New Registry Asset

1. Create the `.asdm.md` file in `registry/agents/`, `registry/skills/<name>/`, or `registry/commands/`
2. Add required frontmatter: `id`, `name`, `version`, `description`, `type`, `category`, `tags`, `sha256: ""`
3. Run `npm run build:manifest` to recompute hashes and update `registry/latest.json`
4. Run `npm run validate:registry` to confirm validity

---

## Key Architectural Invariants

- **Write Once, Emit Many**: The registry is the single source of truth. Adapters only transform and write; they never read from target directories.
- **No logging in core**: `src/core/` and `src/adapters/` are side-effect-free except for explicit I/O operations. No `console.*` or `logger.*`.
- **Managed file headers**: All emitted files must include `managedFileHeader(adapterName)` from `src/adapters/base.ts`. This is how `verify` and `clean` identify managed files.
- **SHA-256 integrity**: Every synced asset is hashed and stored in `.asdm-lock.json`. Always verify after download; never trust the manifest hash alone.
- **Telemetry is optional**: All `telemetry?.write(…)` calls use optional chaining and `.catch(() => {})`. Telemetry outages must never surface to the user.
- **Global mode**: `asdm sync --global` writes to provider global config dirs; config source = local `.asdm.json` → `~/.config/asdm/config.json` (fallback) → error; lockfile at `~/.config/asdm/global-lock.json`; project-root files (`AGENTS.md`, `CLAUDE.md`) are skipped.

---

## Versioning & Publishing

The package is published as `asdm-cli` on npm. Publishing is triggered automatically by creating a GitHub Release.

### Pre-release checklist

Before bumping the version, confirm all of the following pass locally:

```bash
npm test                  # all tests green
npm run typecheck         # no TypeScript errors
npm run validate:registry # registry integrity confirmed
# Confirm clean working tree (no uncommitted files)
git status --short
```

> After running `npm run build:manifest`, always confirm `git status` shows no untracked or modified files before tagging. The files `package-lock.json` and `registry/vX.Y.Z.json` (the versioned manifest snapshot) must be included in the release commit.

### Bumping the version

Update the version in `package.json` manually, or use `npm version` (which also creates a local git tag automatically):

```bash
# Option A — manual
# Edit "version" in package.json, then:
npm run build:manifest
git add package.json package-lock.json registry/latest.json registry/vX.Y.Z.json
git commit -m "chore: release vX.Y.Z"

# Option B — npm version (recommended; bumps package.json and tags in one step)
npm version patch   # or minor / major
git push origin main --tags
```

> **Note**: `npm run build:manifest` must be run after every version bump to keep `registry/latest.json` in sync with the new version.

### Creating the Git tag and GitHub Release

**Via `npm version` (recommended):**

```bash
npm version patch          # bumps package.json and creates local tag vX.Y.Z
git push origin main --tags
```

Then create the GitHub Release through the GitHub UI pointing to the pushed tag. Publishing the release triggers CI/CD.

**Manual approach:**

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Then create the GitHub Release through the GitHub UI targeting that tag.

### What CI/CD does automatically

When a GitHub Release is published (`on: release: types: [published]`), the workflow:

1. Runs `npm ci` — clean install
2. Runs `npm test` — final safety gate
3. Runs `npm run build:manifest` — regenerates SHA-256 hashes
4. Runs `npm run build` — bundles `dist/index.mjs`
5. Publishes to npm: `npm publish --provenance --access public`
6. Uploads `registry/latest.json` as `manifest.json` on the GitHub Release (this is the URL consumed by the registry client)

### Version format (semantic versioning)

| Bump | When to use |
| --- | --- |
| `patch` (0.1.X) | Bug fixes, documentation, internal refactors |
| `minor` (0.X.0) | New features, new commands, new registry assets |
| `major` (X.0.0) | Breaking changes to CLI interface or registry format |

### Required secrets

| Secret | Purpose |
| --- | --- |
| `NPM_TOKEN` | Authenticates `npm publish` in CI — must be set in GitHub repository secrets |
