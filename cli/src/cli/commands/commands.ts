/**
 * asdm commands — List installed or available slash commands.
 *
 * Default: reads from lockfile (offline).
 * With --available: fetches from registry manifest.
 */

import { defineCommand } from 'citty'
import { readProjectConfig } from '../../core/config.js'
import { readLockfile } from '../../core/lockfile.js'
import { RegistryClient } from '../../core/registry-client.js'
import { resolveProfileFromManifest } from '../../core/profile-resolver.js'
import { logger } from '../../utils/logger.js'
import { ConfigError } from '../../utils/errors.js'

export default defineCommand({
  meta: {
    name: 'commands',
    description: 'List installed or available slash commands',
  },
  args: {
    available: {
      type: 'boolean',
      description: 'List commands available in the registry (requires network)',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()

    if (ctx.args.available) {
      await listAvailableCommands(cwd, ctx.args.json)
      return
    }

    await listInstalledCommands(cwd, ctx.args.json)
  },
})

async function listInstalledCommands(cwd: string, asJson: boolean): Promise<void> {
  const lockfile = await readLockfile(cwd)

  if (!lockfile) {
    logger.warn('No lockfile found — run `asdm sync` first')
    process.exit(1)
  }

  const commandSources = [...new Set(
    Object.values(lockfile.files)
      .filter(e => e.managed && e.source.startsWith('commands/'))
      .map(e => e.source.replace('commands/', '').replace('.md', ''))
  )]

  if (asJson) {
    console.log(JSON.stringify(commandSources, null, 2))
    return
  }

  logger.asdm(`Installed commands (profile: ${lockfile.profile})`)
  logger.divider()

  if (commandSources.length === 0) {
    logger.info('No commands installed')
    return
  }

  for (const cmd of commandSources) {
    logger.bullet(`/${cmd}`)
  }
}

async function listAvailableCommands(cwd: string, asJson: boolean): Promise<void> {
  let projectConfig
  try {
    projectConfig = await readProjectConfig(cwd)
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.error('No .asdm.json found', 'Run `asdm init` first')
      process.exit(1)
    }
    throw err
  }

  try {
    const client = new RegistryClient(projectConfig.registry)
    const manifest = await client.getLatestManifest()
    const resolved = resolveProfileFromManifest(manifest.profiles, projectConfig.profile)

    if (asJson) {
      console.log(JSON.stringify(resolved.commands, null, 2))
      return
    }

    logger.asdm(`Available commands for profile "${projectConfig.profile}"`)
    logger.divider()

    if (resolved.commands.length === 0) {
      logger.info('No commands defined for this profile')
      return
    }

    for (const cmd of resolved.commands) {
      const assetKey = `commands/${cmd}.md`
      const meta = manifest.assets[assetKey]
      const version = meta?.version ?? '?'
      logger.bullet(`/${cmd}  (v${version})`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const suggestion = (err as { suggestion?: string }).suggestion ?? undefined
    logger.error(message, suggestion)
    process.exit(1)
  }
}
