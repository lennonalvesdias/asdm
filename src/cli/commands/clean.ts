/**
 * asdm clean — Remove ASDM-managed files and optionally the lockfile.
 *
 * Reads the lockfile to determine which files are managed,
 * removes them, and deletes .asdm-lock.json.
 *
 * Options:
 *   --dry-run         Preview what would be removed without deleting
 *   --global          Clean files installed to global provider config dirs
 *   --target <name>   Only clean files for a specific provider (opencode | claude-code | copilot)
 */

import { defineCommand } from 'citty'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import readline from 'node:readline'
import { readLockfile, writeLockfile } from '../../core/lockfile.js'
import { removeFile, exists, getGlobalLockfilePath, resolveGlobalEmitPath } from '../../utils/fs.js'
import { logger } from '../../utils/logger.js'

const LOCKFILE_NAME = '.asdm-lock.json'

/** Get file size in bytes. Returns 0 if the file is missing or unreadable. */
async function getFileSizeBytes(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath)
    return stat.size
  } catch {
    return 0
  }
}

/** Format a byte count into a human-readable string (B / KB / MB). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(2)} MB`
}

/**
 * Ask the user a yes/no question on stdin.
 * Returns true only if the user types exactly 'y' or 'Y'.
 * Default answer (Enter with no input) is No.
 */
async function confirmPrompt(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y')
    })
  })
}

export default defineCommand({
  meta: {
    name: 'clean',
    description: 'Remove ASDM-managed files and the lockfile',
  },
  args: {
    'dry-run': {
      type: 'boolean',
      description: 'Preview what would be removed without deleting',
      default: false,
    },
    global: {
      type: 'boolean',
      description: 'Clean files installed to global provider config directories',
      default: false,
    },
    target: {
      type: 'string',
      description: 'Only clean files for a specific provider (opencode | claude-code | copilot)',
      alias: 't',
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const dryRun = ctx.args['dry-run']
    const target = ctx.args.target as string | undefined
    const isGlobal = ctx.args.global ?? false

    if (dryRun) {
      logger.info('Dry run — no files will be removed')
    }

    if (isGlobal) {
      await runGlobalClean(dryRun, target)
      return
    }

    await runLocalClean(cwd, dryRun, target)
  },
})

/** Clean globally installed files using the global lockfile. */
async function runGlobalClean(dryRun: boolean, target: string | undefined): Promise<void> {
  const globalLockfilePath = getGlobalLockfilePath()
  const lockfile = await readLockfile(process.cwd(), globalLockfilePath)

  if (!lockfile) {
    logger.warn('No global lockfile found — nothing to clean')
    return
  }

  const managedEntries = Object.entries(lockfile.files).filter(([, entry]) => {
    if (!entry.managed) return false
    if (target) return entry.adapter === target
    return true
  })

  if (managedEntries.length === 0) {
    if (target) {
      logger.warn(`No globally managed files found for provider "${target}"`)
    } else {
      logger.warn('No globally managed files found — nothing to clean')
    }
    return
  }

  // For non-dry-run interactive sessions, confirm before proceeding
  if (!dryRun && process.stdout.isTTY && process.stdin.isTTY) {
    const suffix = target ? ` for provider "${target}"` : ''
    const confirmed = await confirmPrompt(
      `About to delete ${managedEntries.length} globally managed file(s)${suffix}. Continue? [y/N] `
    )
    if (!confirmed) {
      logger.info('Aborted — no files were removed')
      return
    }
  }

  logger.asdm(`Cleaning ${managedEntries.length} globally managed file(s)…`)
  logger.divider()

  let removed = 0
  let skippedMissing = 0
  let totalBytesFreed = 0

  for (const [relativePath, entry] of managedEntries) {
    const absolutePath = resolveGlobalEmitPath(relativePath, entry.adapter)

    if (absolutePath === null) {
      logger.dim(`  skip  ${relativePath} (project-root file, not applicable in global mode)`)
      skippedMissing++
      continue
    }

    const filePresent = await exists(absolutePath)
    if (!filePresent) {
      logger.dim(`  skip  ${absolutePath} (not found)`)
      skippedMissing++
      continue
    }

    if (dryRun) {
      logger.bullet(`would remove: ${absolutePath}`)
      removed++
      continue
    }

    const fileSize = await getFileSizeBytes(absolutePath)
    await removeFile(absolutePath)
    totalBytesFreed += fileSize
    logger.bullet(`removed: ${absolutePath}`)
    removed++
  }

  // Handle the global lockfile — update (partial clean) or remove (full clean)
  const lockfilePresent = await exists(globalLockfilePath)

  if (target) {
    // Partial clean: update lockfile to remove only the targeted provider's entries
    if (!dryRun && lockfilePresent) {
      const updatedFiles = Object.fromEntries(
        Object.entries(lockfile.files).filter(([, entry]) => entry.adapter !== target)
      )
      const hasRemainingEntries = Object.keys(updatedFiles).length > 0
      if (hasRemainingEntries) {
        await writeLockfile(process.cwd(), { ...lockfile, files: updatedFiles }, globalLockfilePath)
        logger.bullet(`updated: global lockfile (removed ${target} entries)`)
      } else {
        await removeFile(globalLockfilePath)
        logger.bullet(`removed: global lockfile (no entries remaining)`)
      }
    } else if (dryRun) {
      logger.bullet(`would update: global lockfile (remove ${target} entries)`)
    }
  } else {
    // Full clean: remove the lockfile entirely
    if (lockfilePresent) {
      if (dryRun) {
        logger.bullet(`would remove: global lockfile`)
      } else {
        const lockfileSize = await getFileSizeBytes(globalLockfilePath)
        await removeFile(globalLockfilePath)
        totalBytesFreed += lockfileSize
        logger.bullet(`removed: global lockfile`)
      }
    }
  }

  logger.divider()
  if (dryRun) {
    const suffix = target ? ` for provider "${target}"` : ''
    logger.info(`${removed} file(s) would be removed${suffix}, ${skippedMissing} skipped`)
    logger.info('Run without --dry-run to actually remove them')
  } else {
    const suffix = target ? ` (${target})` : ''
    logger.success(`Cleaned ${removed} globally managed file(s)${suffix} — ${formatBytes(totalBytesFreed)} freed`)
    if (skippedMissing > 0) logger.dim(`  ${skippedMissing} file(s) were already missing`)
    logger.info('Run `asdm sync --global` to reinstall')
  }
}

/** Clean project-local files using the project lockfile. */
async function runLocalClean(cwd: string, dryRun: boolean, target: string | undefined): Promise<void> {
  const lockfile = await readLockfile(cwd)

  if (!lockfile) {
    logger.warn('No lockfile found — nothing to clean')
    return
  }

  // Collect managed entries, optionally filtered by target provider
  const managedEntries = Object.entries(lockfile.files).filter(([, entry]) => {
    if (!entry.managed) return false
    if (target) return entry.adapter === target
    return true
  })

  if (managedEntries.length === 0) {
    if (target) {
      logger.warn(`No managed files found for provider "${target}"`)
    } else {
      logger.warn('No managed files found — nothing to clean')
    }
    return
  }

  const managedPaths = managedEntries.map(([filePath]) => filePath)
  const resolvedCwd = path.resolve(cwd)

  // Guard: filter out any paths that escape the project root
  const safePaths = managedPaths.filter((relativePath) => {
    const absPath = path.resolve(cwd, relativePath)
    return absPath.startsWith(resolvedCwd + path.sep) || absPath === resolvedCwd
  })

  const skippedSuspicious = managedPaths.length - safePaths.length
  if (skippedSuspicious > 0) {
    logger.warn(`Skipping ${skippedSuspicious} path(s) outside project root`)
  }

  // For non-dry-run interactive sessions, confirm before proceeding
  if (!dryRun && process.stdout.isTTY && process.stdin.isTTY) {
    const suffix = target ? ` for provider "${target}"` : ''
    const confirmed = await confirmPrompt(
      `About to delete ${safePaths.length} file(s)${suffix}. Continue? [y/N] `
    )
    if (!confirmed) {
      logger.info('Aborted — no files were removed')
      return
    }
  }

  logger.asdm(`Cleaning ${safePaths.length} managed file(s)…`)
  logger.divider()

  let removed = 0
  let skippedMissing = 0
  let totalBytesFreed = 0

  for (const relativePath of safePaths) {
    const absolutePath = path.resolve(cwd, relativePath)
    const filePresent = await exists(absolutePath)

    if (!filePresent) {
      logger.dim(`  skip  ${relativePath} (not found)`)
      skippedMissing++
      continue
    }

    if (dryRun) {
      logger.bullet(`would remove: ${relativePath}`)
      removed++
      continue
    }

    const fileSize = await getFileSizeBytes(absolutePath)
    await removeFile(absolutePath)
    totalBytesFreed += fileSize
    logger.bullet(`removed: ${relativePath}`)
    removed++
  }

  // Handle the lockfile — only remove (or update) when not in dry-run mode
  const lockfilePath = path.join(cwd, LOCKFILE_NAME)
  const lockfileOnDisk = await exists(lockfilePath)

  if (target) {
    // Partial clean: update lockfile to remove entries for the targeted provider
    if (!dryRun && lockfileOnDisk) {
      const updatedFiles = Object.fromEntries(
        Object.entries(lockfile.files).filter(([, entry]) => entry.adapter !== target)
      )
      await writeLockfile(cwd, { ...lockfile, files: updatedFiles })
      logger.bullet(`updated: ${LOCKFILE_NAME} (removed ${target} entries)`)
    } else if (dryRun) {
      logger.bullet(`would update: ${LOCKFILE_NAME} (remove ${target} entries)`)
    }
  } else {
    // Full clean: remove the lockfile entirely
    if (lockfileOnDisk) {
      if (dryRun) {
        logger.bullet(`would remove: ${LOCKFILE_NAME}`)
      } else {
        const lockfileSize = await getFileSizeBytes(lockfilePath)
        await removeFile(lockfilePath)
        totalBytesFreed += lockfileSize
        logger.bullet(`removed: ${LOCKFILE_NAME}`)
      }
    }
  }

  logger.divider()

  if (dryRun) {
    const suffix = target ? ` for provider "${target}"` : ''
    logger.info(`${removed} file(s) would be removed${suffix}, ${skippedMissing} not found`)
    logger.info('Run without --dry-run to actually remove them')
  } else {
    const suffix = target ? ` (${target})` : ''
    logger.success(`Cleaned ${removed} managed file(s)${suffix} — ${formatBytes(totalBytesFreed)} freed`)
    if (skippedMissing > 0) logger.dim(`  ${skippedMissing} file(s) were already missing`)
    logger.info('Run `asdm sync` to reinstall')
  }
}
