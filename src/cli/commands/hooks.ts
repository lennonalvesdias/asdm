/**
 * asdm hooks — Manage git hooks for ASDM integrity verification and auto-sync.
 *
 * Sub-commands:
 *   install    Write hooks (auto-detects Husky; falls back to .git/hooks/)
 *   uninstall  Remove ASDM-managed hooks from all known locations
 *
 * Options (install):
 *   --hook <type>    Which hook to manage: pre-commit | post-merge | all (default: all)
 *   --no-husky       Force .git/hooks/ mode even when Husky is detected
 */

import { defineCommand } from 'citty'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { writeFile, exists, removeFile, ensureDir } from '../../utils/fs.js'
import { generatePostMergeHookBody } from '../../utils/post-merge-hook.js'
import { detectHusky } from '../../utils/husky-detect.js'
import { logger } from '../../utils/logger.js'
import type { HuskyInfo } from '../../utils/husky-detect.js'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type HookType = 'pre-commit' | 'post-merge'
type HookMode = 'git' | 'husky-v8' | 'husky-v9+'

export interface ResolvedHookDefinition {
  absolutePath: string
  relativePath: string
  content: string
  /** Substring used to detect if this hook is ASDM-managed */
  marker: string
  /** Human-readable description of what the hook does */
  description: string
}

// ─────────────────────────────────────────────
// Hook body constants (shared across all modes)
// ─────────────────────────────────────────────

/** Functional content for each hook type — no shebang, mode-agnostic */
const HOOK_BODIES: Record<HookType, string> = {
  'pre-commit':
    `# ASDM — managed pre-commit hook\n` +
    `# Verifies integrity of managed files before allowing commits.\n` +
    `npx asdm verify --strict --quiet\n`,
  'post-merge': generatePostMergeHookBody(),
}

/** Marker strings embedded in hook bodies — used to identify ASDM-managed files */
const HOOK_MARKERS: Record<HookType, string> = {
  'pre-commit': 'ASDM — managed pre-commit hook',
  'post-merge': 'ASDM MANAGED — post-merge hook',
}

const HOOK_DESCRIPTIONS: Record<HookType, string> = {
  'pre-commit': 'runs `asdm verify --strict --quiet` before every commit',
  'post-merge': 'runs `asdm sync` after git pull/merge',
}

// ─────────────────────────────────────────────
// Hook resolution helpers — exported for tests
// ─────────────────────────────────────────────

/** Resolve which hook types to operate on based on the --hook flag */
function resolveHookTypes(hookFlag: string): HookType[] {
  if (hookFlag === 'pre-commit' || hookFlag === 'post-merge') return [hookFlag]
  return ['pre-commit', 'post-merge']
}

/** Determine the write mode from the detected Husky state and the --no-husky flag */
function determineHookMode(huskyInfo: HuskyInfo, noHusky: boolean): HookMode {
  if (noHusky || !huskyInfo.detected) return 'git'
  if (huskyInfo.version === 'v8') return 'husky-v8'
  return 'husky-v9+'
}

/** Prepend the appropriate header to a hook body based on the write mode */
function buildHookContent(body: string, mode: HookMode): string {
  if (mode === 'git') return `#!/usr/bin/env sh\n${body}`
  if (mode === 'husky-v8') return `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n${body}`
  return body  // v9+: no shebang or sourcing needed
}

/**
 * Resolve the full definition (path + content) for a hook given the current mode.
 * Exported so integration tests can inspect the resolved definition directly.
 */
export function resolveHookDefinition(
  cwd: string,
  hookType: HookType,
  huskyInfo: HuskyInfo,
  noHusky: boolean,
): ResolvedHookDefinition {
  const mode = determineHookMode(huskyInfo, noHusky)
  const body = HOOK_BODIES[hookType]
  const marker = HOOK_MARKERS[hookType]
  const description = HOOK_DESCRIPTIONS[hookType]

  const relativePath = mode === 'git'
    ? `.git/hooks/${hookType}`
    : `.husky/${hookType}`

  const content = buildHookContent(body, mode)

  return {
    absolutePath: path.join(cwd, relativePath),
    relativePath,
    content,
    marker,
    description,
  }
}

// ─────────────────────────────────────────────
// Core install / uninstall — exported for tests
// ─────────────────────────────────────────────

/**
 * Install a single ASDM-managed hook.
 *
 * - Git mode:      requires .git/ to exist; writes to .git/hooks/<hookType>
 * - Husky mode:    creates .husky/ if absent; writes to .husky/<hookType>
 * - Idempotent:    no-op if the file already contains the ASDM marker
 */
export async function installHook(
  cwd: string,
  hookType: HookType,
  huskyInfo: HuskyInfo,
  noHusky: boolean,
): Promise<void> {
  const mode = determineHookMode(huskyInfo, noHusky)
  const def = resolveHookDefinition(cwd, hookType, huskyInfo, noHusky)

  if (mode === 'git') {
    const hasGit = await exists(path.join(cwd, '.git'))
    if (!hasGit) {
      logger.error('No .git directory found', 'Run `git init` first')
      process.exit(1)
    }
  } else {
    // Husky mode: ensure .husky/ directory exists
    await ensureDir(path.join(cwd, '.husky'))
  }

  const hookExists = await exists(def.absolutePath)
  if (hookExists) {
    const existing = await fs.readFile(def.absolutePath, 'utf-8')
    if (existing.includes(def.marker)) {
      logger.info(`ASDM ${hookType} hook is already installed`)
      return
    }
    logger.warn(`A ${hookType} hook already exists and is not managed by ASDM.`)
    logger.warn(`Manual action required: add the ASDM logic to ${def.relativePath}`)
    process.exit(1)
  }

  await writeFile(def.absolutePath, def.content)

  // Make executable on Unix/macOS (non-fatal on Windows)
  try {
    await fs.chmod(def.absolutePath, 0o755)
  } catch {
    // chmod may not be supported on Windows — non-fatal
  }

  logger.success(`Installed ${hookType} hook at ${def.relativePath}`)
  logger.info(`The hook ${def.description}`)
}

/**
 * Remove ASDM-managed hooks.
 *
 * Checks both .git/hooks/ and .husky/ to handle the case where the user
 * has switched between modes after the initial install. Non-ASDM files
 * are warned about but never removed.
 */
export async function uninstallHook(cwd: string, hookType: HookType): Promise<void> {
  const marker = HOOK_MARKERS[hookType]

  // Candidate locations in priority order
  const candidates: Array<{ relativePath: string; absolutePath: string }> = [
    {
      relativePath: `.git/hooks/${hookType}`,
      absolutePath: path.join(cwd, '.git', 'hooks', hookType),
    },
    {
      relativePath: `.husky/${hookType}`,
      absolutePath: path.join(cwd, '.husky', hookType),
    },
  ]

  let removed = false

  for (const { relativePath, absolutePath } of candidates) {
    const hookExists = await exists(absolutePath)
    if (!hookExists) continue

    const content = await fs.readFile(absolutePath, 'utf-8')
    if (!content.includes(marker)) {
      logger.warn(`A ${hookType} hook at ${relativePath} was not installed by ASDM — skipping`)
      continue
    }

    await removeFile(absolutePath)
    logger.success(`Removed ASDM ${hookType} hook from ${relativePath}`)
    removed = true
  }

  if (!removed) {
    logger.info(`No ASDM-managed ${hookType} hook found — nothing to remove`)
  }
}

// ─────────────────────────────────────────────
// CLI sub-commands
// ─────────────────────────────────────────────

const installCommand = defineCommand({
  meta: {
    name: 'install',
    description: 'Install ASDM git hooks (pre-commit and/or post-merge)',
  },
  args: {
    hook: {
      type: 'string',
      description: 'Which hook to install: pre-commit | post-merge | all',
      default: 'all',
    },
    'no-husky': {
      type: 'boolean',
      description: 'Force .git/hooks/ mode even when Husky is detected',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const hookTypes = resolveHookTypes(ctx.args.hook)
    const noHusky = ctx.args['no-husky'] ?? false

    const huskyInfo = noHusky
      ? ({ detected: false, version: null, huskyDir: null } satisfies HuskyInfo)
      : await detectHusky(cwd)

    if (huskyInfo.detected) {
      logger.info(`Using Husky hooks in .husky/ (${huskyInfo.version})`)
    } else {
      logger.info('Using Git hooks in .git/hooks/')
    }

    for (const hookType of hookTypes) {
      await installHook(cwd, hookType, huskyInfo, noHusky)
    }
  },
})

const uninstallCommand = defineCommand({
  meta: {
    name: 'uninstall',
    description: 'Remove ASDM git hooks',
  },
  args: {
    hook: {
      type: 'string',
      description: 'Which hook to remove: pre-commit | post-merge | all',
      default: 'all',
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const hookTypes = resolveHookTypes(ctx.args.hook)

    for (const hookType of hookTypes) {
      await uninstallHook(cwd, hookType)
    }
  },
})

export default defineCommand({
  meta: {
    name: 'hooks',
    description: 'Manage git hooks for ASDM integrity verification and auto-sync',
  },
  subCommands: {
    install: installCommand,
    uninstall: uninstallCommand,
  },
})
