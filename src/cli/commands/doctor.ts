/**
 * asdm doctor — Run diagnostics on the ASDM setup.
 *
 * Checks:
 *   1. Is .asdm.json present?
 *   2. Is the registry reachable?
 *   3. Is the lockfile present?
 *   4. Are emitted files unmodified?
 *   5. Are all managed files in the correct locations?
 *   6. Are overlay files referencing known agents?
 *   7. Does .gitignore contain ASDM entries? (info only)
 *   8. Is the local manifest up to date with the registry? (non-blocking)
 *
 * Prints ✅ / ⚠️ / ❌ for each check.
 * Exits 0 if all pass, 1 if any fail.
 */

import { defineCommand } from 'citty'
import path from 'node:path'
import { readProjectConfig } from '../../core/config.js'
import { RegistryClient } from '../../core/registry-client.js'
import { readLockfile } from '../../core/lockfile.js'
import { verify, VERIFY_EXIT_CODES } from '../../core/verifier.js'
import { readOverlays } from '../../core/overlay.js'
import { exists, readFile } from '../../utils/fs.js'
import { ASDM_MARKER_START } from '../../utils/gitignore.js'
import { logger } from '../../utils/logger.js'
import type { ProjectConfig } from '../../core/config.js'
import type { AsdmLockfile } from '../../core/lockfile.js'

interface CheckResult {
  label: string
  status: 'ok' | 'fail' | 'warn' | 'skip'
  detail?: string
}

/** Extract agent names from lockfile sources (e.g. "agents/code-reviewer.asdm.md" → "code-reviewer"). */
function extractAgentNamesFromLockfile(lockfile: AsdmLockfile): Set<string> {
  const names = new Set<string>()
  for (const entry of Object.values(lockfile.files)) {
    if (entry.source.startsWith('agents/') && entry.source.endsWith('.asdm.md')) {
      const name = entry.source.slice('agents/'.length, -'.asdm.md'.length)
      names.add(name)
    }
  }
  return names
}

export default defineCommand({
  meta: {
    name: 'doctor',
    description: 'Run diagnostics on the ASDM setup',
  },
  async run(_ctx) {
    const cwd = process.cwd()
    const checks: CheckResult[] = []
    let anyFailed = false

    // Retain config and client for later checks without re-reading
    let projectConfig: ProjectConfig | null = null
    let registryClient: RegistryClient | null = null

    // -----------------------------------------------------------------------
    // Check 1: .asdm.json present
    // -----------------------------------------------------------------------
    const configPath = path.join(cwd, '.asdm.json')
    const hasConfig = await exists(configPath)
    checks.push({
      label: '.asdm.json present',
      status: hasConfig ? 'ok' : 'fail',
      detail: hasConfig ? undefined : 'Run `asdm init` to create it',
    })
    if (!hasConfig) anyFailed = true

    // -----------------------------------------------------------------------
    // Check 2: Registry reachable
    // -----------------------------------------------------------------------
    if (hasConfig) {
      try {
        projectConfig = await readProjectConfig(cwd)
        registryClient = new RegistryClient(projectConfig.registry)
        const reachable = await registryClient.ping()
        checks.push({
          label: `Registry reachable (${projectConfig.registry})`,
          status: reachable ? 'ok' : 'fail',
          detail: reachable ? undefined : 'Check GITHUB_TOKEN and network connectivity',
        })
        if (!reachable) anyFailed = true
      } catch {
        checks.push({
          label: 'Registry reachable',
          status: 'fail',
          detail: 'Could not read registry config',
        })
        anyFailed = true
      }
    } else {
      checks.push({
        label: 'Registry reachable',
        status: 'skip',
        detail: 'Skipped — no .asdm.json',
      })
    }

    // -----------------------------------------------------------------------
    // Check 3: Lockfile present
    // -----------------------------------------------------------------------
    const lockfile = await readLockfile(cwd)
    checks.push({
      label: '.asdm-lock.json present',
      status: lockfile ? 'ok' : 'warn',
      detail: lockfile ? undefined : 'Run `asdm sync` to generate lockfile',
    })
    if (!lockfile) anyFailed = true

    // -----------------------------------------------------------------------
    // Check 4: Managed files unmodified
    // Check 5: All managed files on disk
    // -----------------------------------------------------------------------
    if (lockfile) {
      const verifyResult = await verify(cwd)

      if (verifyResult.exitCode === VERIFY_EXIT_CODES.OK) {
        checks.push({
          label: `Managed files intact (${verifyResult.checkedFiles} files)`,
          status: 'ok',
        })
      } else if (verifyResult.exitCode === VERIFY_EXIT_CODES.MODIFIED) {
        const count = verifyResult.violations.length
        checks.push({
          label: 'Managed files intact',
          status: 'fail',
          detail: `${count} violation(s) — run \`asdm verify\` for details`,
        })
        anyFailed = true
      } else {
        checks.push({
          label: 'Managed files intact',
          status: 'warn',
          detail: `Exit code ${verifyResult.exitCode}`,
        })
      }

      // Check 5: All managed files present on disk
      const managedEntries = Object.entries(lockfile.files).filter(([, e]) => e.managed)
      const missingFiles = []
      const resolvedCwd = path.resolve(cwd)
      for (const [filePath] of managedEntries) {
        const absPath = path.resolve(cwd, filePath)
        if (!absPath.startsWith(resolvedCwd + path.sep) && absPath !== resolvedCwd) {
          continue
        }
        const fileExists = await exists(absPath)
        if (!fileExists) missingFiles.push(filePath)
      }

      checks.push({
        label: 'All managed files on disk',
        status: missingFiles.length === 0 ? 'ok' : 'fail',
        detail: missingFiles.length > 0
          ? `${missingFiles.length} missing — run \`asdm sync --force\``
          : undefined,
      })
      if (missingFiles.length > 0) anyFailed = true
    } else {
      checks.push({
        label: 'Managed files intact',
        status: 'skip',
        detail: 'Skipped — no lockfile',
      })
      checks.push({
        label: 'All managed files on disk',
        status: 'skip',
        detail: 'Skipped — no lockfile',
      })
    }

    // -----------------------------------------------------------------------
    // Check 6: Overlay files reference known agents
    // -----------------------------------------------------------------------
    if (lockfile) {
      const overlays = await readOverlays(cwd)

      if (overlays.size === 0) {
        checks.push({
          label: 'Overlay files valid',
          status: 'ok',
          detail: 'No overlays found',
        })
      } else {
        const knownAgents = extractAgentNamesFromLockfile(lockfile)
        const unknownOverlays = [...overlays.keys()].filter(id => !knownAgents.has(id))

        if (unknownOverlays.length === 0) {
          checks.push({
            label: `Overlay files valid (${overlays.size} overlay(s))`,
            status: 'ok',
          })
        } else {
          checks.push({
            label: 'Overlay files valid',
            status: 'warn',
            detail: `Unknown agent(s): ${unknownOverlays.join(', ')} — not in lockfile`,
          })
        }
      }
    } else {
      checks.push({
        label: 'Overlay files valid',
        status: 'skip',
        detail: 'Skipped — no lockfile',
      })
    }

    // -----------------------------------------------------------------------
    // Check 7: .gitignore contains ASDM entries (info only — not a failure)
    // -----------------------------------------------------------------------
    const gitignoreContent = await readFile(path.join(cwd, '.gitignore'))
    const hasAsdmBlock = gitignoreContent?.includes(ASDM_MARKER_START) ?? false
    checks.push({
      label: '.gitignore has ASDM block',
      status: hasAsdmBlock ? 'ok' : 'skip',
      detail: hasAsdmBlock
        ? undefined
        : "Run 'asdm gitignore' to add managed output dirs",
    })

    // -----------------------------------------------------------------------
    // Check 8: Registry version (non-blocking — network unavailable is ok)
    // -----------------------------------------------------------------------
    if (lockfile && registryClient) {
      try {
        const latestManifest = await registryClient.getLatestManifest()
        const isUpToDate = lockfile.manifest_version === latestManifest.version

        checks.push({
          label: 'Registry version',
          status: isUpToDate ? 'ok' : 'warn',
          detail: isUpToDate
            ? `Up to date (v${lockfile.manifest_version})`
            : `Behind — local v${lockfile.manifest_version}, registry v${latestManifest.version}`,
        })
      } catch {
        checks.push({
          label: 'Registry version',
          status: 'skip',
          detail: 'Could not reach registry to check version',
        })
      }
    } else if (!registryClient) {
      checks.push({
        label: 'Registry version',
        status: 'skip',
        detail: 'Skipped — no registry config',
      })
    } else {
      checks.push({
        label: 'Registry version',
        status: 'skip',
        detail: 'Skipped — no lockfile',
      })
    }

    // -----------------------------------------------------------------------
    // Print results
    // -----------------------------------------------------------------------
    logger.asdm('ASDM Doctor')
    logger.divider()

    for (const check of checks) {
      logger.status(check.label, check.status, check.detail)
    }

    logger.divider()

    if (anyFailed) {
      logger.error('Some checks failed — review the output above')
      process.exitCode = 1
      return
    } else {
      logger.success('All checks passed')
    }
  },
})
