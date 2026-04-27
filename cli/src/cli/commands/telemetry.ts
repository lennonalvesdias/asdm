/**
 * asdm telemetry — Manage local telemetry data.
 *
 * Sub-commands:
 *   show   Print recent telemetry events from .asdm-telemetry.jsonl
 *   clear  Delete the local telemetry log
 */

import { defineCommand } from 'citty'
import { TelemetryWriter } from '../../core/telemetry.js'
import { logger } from '../../utils/logger.js'

const showCommand = defineCommand({
  meta: {
    name: 'show',
    description: 'Show recent telemetry events',
  },
  args: {
    limit: {
      type: 'string',
      description: 'Number of events to show',
      default: '20',
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const writer = new TelemetryWriter(cwd)
    const events = await writer.readAll()

    const limit = Math.max(1, parseInt(ctx.args.limit, 10) || 20)
    const shown = events.slice(-limit)

    if (ctx.args.json) {
      console.log(JSON.stringify(shown, null, 2))
      return
    }

    if (shown.length === 0) {
      logger.info('No telemetry events found in .asdm-telemetry.jsonl')
      return
    }

    logger.asdm(`Last ${shown.length} telemetry event(s)`)
    logger.divider()

    for (const event of shown) {
      const ts = new Date(event.timestamp).toLocaleString()

      const parts: string[] = []
      if (event.profile) parts.push(`profile=${event.profile}`)
      if (event.durationMs != null) parts.push(`${event.durationMs}ms`)
      if (event.assetCount != null) parts.push(`${event.assetCount} assets`)
      if (event.violations != null) parts.push(`${event.violations} violation(s)`)
      if (event.error) parts.push(`error="${event.error}"`)

      const detail = parts.length > 0 ? `  ${parts.join('  ')}` : ''
      logger.bullet(`${event.event.padEnd(20)} ${ts}${detail}`)
    }
  },
})

const clearCommand = defineCommand({
  meta: {
    name: 'clear',
    description: 'Clear the local telemetry log',
  },
  args: {
    force: {
      type: 'boolean',
      description: 'Skip confirmation prompt',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()

    if (!ctx.args.force) {
      logger.warn('This will permanently delete all local telemetry data.')
      logger.info('Use --force to confirm: asdm telemetry clear --force')
      process.exit(1)
    }

    const writer = new TelemetryWriter(cwd)
    await writer.clear()
    logger.success('Telemetry log cleared (.asdm-telemetry.jsonl removed)')
  },
})

export default defineCommand({
  meta: {
    name: 'telemetry',
    description: 'Manage local telemetry data',
  },
  subCommands: {
    show: showCommand,
    clear: clearCommand,
  },
})
