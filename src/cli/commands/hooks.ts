/**
 * asdm hooks — Manage git hooks for ASDM integrity verification and auto-sync.
 *
 * Sub-commands:
 *   install    Write git hooks (pre-commit and/or post-merge)
 *   uninstall  Remove ASDM-managed git hooks
 *
 * Options:
 *   --hook <type>   Which hook to manage: pre-commit | post-merge | all (default: all)
 */

import { defineCommand } from 'citty'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { writeFile, exists, removeFile } from '../../utils/fs.js'
import { generatePostMergeHook } from '../../utils/post-merge-hook.js'
import { logger } from '../../utils/logger.js'

type HookType = 'pre-commit' | 'post-merge'

interface HookDefinition {
  /** Path relative to project root */
  relativePath: string
  /** Full hook script content */
  content: string
  /** Substring used to detect if this hook is ASDM-managed */
  marker: string
  /** Human-readable description of what the hook does */
  description: string
}

const HOOK_DEFINITIONS: Record<HookType, HookDefinition> = {
  'pre-commit': {
    relativePath: '.git/hooks/pre-commit',
    content: `#!/usr/bin/env sh\n# ASDM — managed pre-commit hook\n# Verifies integrity of managed files before allowing commits.\nnpx asdm verify --strict --quiet\n`,
    marker: 'ASDM — managed pre-commit hook',
    description: 'runs `asdm verify --strict --quiet` before every commit',
  },
  'post-merge': {
    relativePath: '.git/hooks/post-merge',
    content: generatePostMergeHook(),
    marker: 'ASDM MANAGED — post-merge hook',
    description: 'runs `asdm sync` after git pull/merge',
  },
}

/** Resolve which hook types to operate on based on the --hook flag */
function resolveHookTypes(hookFlag: string): HookType[] {
  if (hookFlag === 'pre-commit' || hookFlag === 'post-merge') {
    return [hookFlag]
  }
  return ['pre-commit', 'post-merge']
}

async function installHook(cwd: string, hookType: HookType): Promise<void> {
  const def = HOOK_DEFINITIONS[hookType]
  const hookPath = path.join(cwd, def.relativePath)
  const gitDir = path.join(cwd, '.git')

  const hasGit = await exists(gitDir)
  if (!hasGit) {
    logger.error('No .git directory found', 'Run `git init` first')
    process.exit(1)
  }

  const hookExists = await exists(hookPath)
  if (hookExists) {
    const existing = await fs.readFile(hookPath, 'utf-8')
    if (existing.includes(def.marker)) {
      logger.info(`ASDM ${hookType} hook is already installed`)
      return
    }
    logger.warn(`A ${hookType} hook already exists and is not managed by ASDM.`)
    logger.warn(`Manual action required: add the ASDM logic to ${def.relativePath}`)
    process.exit(1)
  }

  await writeFile(hookPath, def.content)

  // Make executable on Unix/macOS (non-fatal on Windows)
  try {
    await fs.chmod(hookPath, 0o755)
  } catch {
    // chmod may not be supported on Windows — non-fatal
  }

  logger.success(`Installed ${hookType} hook at ${def.relativePath}`)
  logger.info(`The hook ${def.description}`)
}

async function uninstallHook(cwd: string, hookType: HookType): Promise<void> {
  const def = HOOK_DEFINITIONS[hookType]
  const hookPath = path.join(cwd, def.relativePath)

  const hookExists = await exists(hookPath)
  if (!hookExists) {
    logger.info(`No ${hookType} hook found — nothing to remove`)
    return
  }

  const content = await fs.readFile(hookPath, 'utf-8')
  if (!content.includes(def.marker)) {
    logger.warn(`The ${hookType} hook was not installed by ASDM — not removing it`)
    logger.info(`If you want to remove it manually: rm ${def.relativePath}`)
    process.exit(1)
  }

  await removeFile(hookPath)
  logger.success(`Removed ASDM ${hookType} hook from ${def.relativePath}`)
}

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
  },
  async run(ctx) {
    const cwd = process.cwd()
    const hookTypes = resolveHookTypes(ctx.args.hook)

    for (const hookType of hookTypes) {
      await installHook(cwd, hookType)
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
