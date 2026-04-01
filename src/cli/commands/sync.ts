/**
 * asdm sync — Synchronize assets from the registry to the local machine.
 *
 * Downloads agents, skills, and commands from the configured registry,
 * verifies SHA-256 integrity, and emits provider-native files.
 */

import { defineCommand } from 'citty'
import path from 'node:path'
import { sync } from '../../core/syncer.js'
import { TelemetryWriter } from '../../core/telemetry.js'
import { logger } from '../../utils/logger.js'
import { exists, getGlobalConfigPath } from '../../utils/fs.js'
import { ConfigError } from '../../utils/errors.js'

/**
 * Resolve the config file path to use for sync.
 *
 * Resolution order:
 *   1. Local .asdm.json (always checked first)
 *   2. Global ~/.config/asdm/config.json (only if --global and no local config)
 *   3. ConfigError if neither is found
 */
async function resolveConfigPath(cwd: string, isGlobal: boolean): Promise<string> {
  const localPath = path.join(cwd, '.asdm.json')
  if (await exists(localPath)) return localPath

  if (isGlobal) {
    const globalPath = getGlobalConfigPath()
    if (await exists(globalPath)) return globalPath
  }

  throw new ConfigError(
    'No config found.',
    isGlobal
      ? 'Run `asdm init` (project) or `asdm init --global` (machine-wide setup).'
      : 'Run `asdm init` to initialize this project.'
  )
}

export default defineCommand({
  meta: {
    name: 'sync',
    description: 'Synchronize assets from the registry',
  },
  args: {
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be done without writing files',
      default: false,
    },
    force: {
      type: 'boolean',
      description: 'Re-download all assets even if SHA matches',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Print verbose output',
      default: false,
    },
    provider: {
      type: 'string',
      description: 'Sync only for a specific provider',
    },
    global: {
      type: 'boolean',
      description: 'Install to global provider config directories instead of project-local folders',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const dryRun = ctx.args['dry-run']
    const verbose = ctx.args.verbose

    if (verbose) logger.setVerbose(true)

    if (dryRun) {
      logger.info('Dry run — no files will be written')
    }

    logger.asdm('Starting sync…')

    const telemetry = new TelemetryWriter(cwd)

    try {
      const configPath = await resolveConfigPath(cwd, ctx.args.global ?? false)

      const result = await sync({
        cwd,
        configPath,
        force: ctx.args.force,
        dryRun,
        verbose,
        provider: ctx.args.provider,
        global: ctx.args.global ?? false,
        telemetry,
      })

      const { stats } = result

      if (dryRun) {
        logger.info('Sync plan (dry run):')
        logger.bullet(`${stats.filesAdded} file(s) to add`)
        logger.bullet(`${stats.filesUpdated} file(s) to update`)
        logger.bullet(`${stats.filesUnchanged} file(s) unchanged`)
        logger.bullet(`${stats.filesRemoved} file(s) to remove`)
        return
      }

      logger.divider()
      logger.success('Sync complete')
      logger.table([
        ['Profile', stats.profile],
        ['Manifest version', stats.manifestVersion],
        ['Providers', stats.providers.join(', ')],
        ['Files added', String(stats.filesAdded)],
        ['Files updated', String(stats.filesUpdated)],
        ['Files unchanged', String(stats.filesUnchanged)],
        ['Duration', `${stats.duration}ms`],
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const suggestion =
        (err as { suggestion?: string }).suggestion ?? undefined
      logger.error(message, suggestion)
      process.exitCode = 1
      return
    }
  },
})
