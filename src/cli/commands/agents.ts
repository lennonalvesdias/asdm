/**
 * asdm agents — List installed or available agents.
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
    name: 'agents',
    description: 'List installed or available agents',
  },
  args: {
    available: {
      type: 'boolean',
      description: 'List agents available in the registry (requires network)',
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
      await listAvailableAgents(cwd, ctx.args.json)
      return
    }

    await listInstalledAgents(cwd, ctx.args.json)
  },
})

async function listInstalledAgents(cwd: string, asJson: boolean): Promise<void> {
  const lockfile = await readLockfile(cwd)

  if (!lockfile) {
    logger.warn('No lockfile found — run `asdm sync` first')
    process.exit(1)
  }

  const agentSources = [...new Set(
    Object.values(lockfile.files)
      .filter(e => e.managed && e.source.startsWith('agents/'))
      .map(e => e.source.replace('agents/', '').replace('.asdm.md', ''))
  )]

  if (asJson) {
    console.log(JSON.stringify(agentSources, null, 2))
    return
  }

  logger.asdm(`Installed agents (profile: ${lockfile.profile})`)
  logger.divider()

  if (agentSources.length === 0) {
    logger.info('No agents installed')
    return
  }

  for (const agent of agentSources) {
    logger.bullet(agent)
  }
}

async function listAvailableAgents(cwd: string, asJson: boolean): Promise<void> {
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
      console.log(JSON.stringify(resolved.agents, null, 2))
      return
    }

    logger.asdm(`Available agents for profile "${projectConfig.profile}"`)
    logger.divider()

    if (resolved.agents.length === 0) {
      logger.info('No agents defined for this profile')
      return
    }

    for (const agent of resolved.agents) {
      const assetKey = `agents/${agent}.asdm.md`
      const meta = manifest.assets[assetKey]
      const version = meta?.version ?? '?'
      logger.bullet(`${agent}  (v${version})`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const suggestion = (err as { suggestion?: string }).suggestion ?? undefined
    logger.error(message, suggestion)
    process.exit(1)
  }
}
