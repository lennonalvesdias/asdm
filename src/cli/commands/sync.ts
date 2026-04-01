/**
 * asdm sync — Synchronize assets from the registry to the local machine.
 *
 * Downloads agents, skills, and commands from the configured registry,
 * verifies SHA-256 integrity, and emits provider-native files.
 */

import { defineCommand } from 'citty'
import { sync } from '../../core/syncer.js'
import { TelemetryWriter } from '../../core/telemetry.js'
import { logger } from '../../utils/logger.js'

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
      const result = await sync({
        cwd,
        force: ctx.args.force,
        dryRun,
        verbose,
        provider: ctx.args.provider,
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
      process.exit(1)
    }
  },
})
