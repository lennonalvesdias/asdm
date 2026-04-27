/**
 * asdm sync — Synchronize assets from the registry to the local machine.
 *
 * Downloads agents, skills, and commands from the configured registry,
 * verifies SHA-256 integrity, and emits provider-native files.
 *
 * Default: installs to global provider config directories using ~/.config/asdm/config.json.
 * Use --local to install to the current project using .asdm.json.
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
 *   1. --local flag → local .asdm.json (error if not found)
 *   2. Default → global ~/.config/asdm/config.json (error if not found)
 */
async function resolveConfigPath(cwd: string, isLocal: boolean): Promise<string> {
  if (isLocal) {
    const localPath = path.join(cwd, '.asdm.json')
    if (await exists(localPath)) return localPath
    throw new ConfigError(
      'No .asdm.json found in current directory.',
      'Run `asdm init --local` to initialize this project.'
    )
  }

  const globalPath = getGlobalConfigPath()
  if (await exists(globalPath)) return globalPath

  throw new ConfigError(
    'No global config found.',
    'Run `asdm init` to set up global config, or use `asdm sync --local` for project-local sync.'
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
    clean: {
      type: 'boolean',
      description: 'Remove managed files from previous profile that are no longer in use',
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
    local: {
      type: 'boolean',
      description: 'Sync using .asdm.json and install to project-local folders instead of global dirs',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const dryRun = ctx.args['dry-run']
    const verbose = ctx.args.verbose
    const isLocal = ctx.args.local ?? false

    if (verbose) logger.setVerbose(true)

    if (dryRun) {
      logger.info('Dry run — no files will be written')
    }

    logger.asdm('Starting sync…')

    const telemetry = new TelemetryWriter(cwd)

    try {
      const configPath = await resolveConfigPath(cwd, isLocal)

      const result = await sync({
        cwd,
        configPath,
        force: ctx.args.force,
        dryRun,
        verbose,
        provider: ctx.args.provider,
        global: !isLocal,
        clean: ctx.args.clean,
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
        ['Files removed', String(stats.filesRemoved)],
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
