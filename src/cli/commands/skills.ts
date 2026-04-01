/**
 * asdm skills — List installed or available skills.
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
    name: 'skills',
    description: 'List installed or available skills',
  },
  args: {
    available: {
      type: 'boolean',
      description: 'List skills available in the registry (requires network)',
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
      await listAvailableSkills(cwd, ctx.args.json)
      return
    }

    await listInstalledSkills(cwd, ctx.args.json)
  },
})

async function listInstalledSkills(cwd: string, asJson: boolean): Promise<void> {
  const lockfile = await readLockfile(cwd)

  if (!lockfile) {
    logger.warn('No lockfile found — run `asdm sync` first')
    process.exit(1)
  }

  const skillSources = [...new Set(
    Object.values(lockfile.files)
      .filter(e => e.managed && e.source.startsWith('skills/'))
      .map(e => {
        const parts = e.source.replace('skills/', '').split('/')
        return parts[0] ?? e.source
      })
  )]

  if (asJson) {
    console.log(JSON.stringify(skillSources, null, 2))
    return
  }

  logger.asdm(`Installed skills (profile: ${lockfile.profile})`)
  logger.divider()

  if (skillSources.length === 0) {
    logger.info('No skills installed')
    return
  }

  for (const skill of skillSources) {
    logger.bullet(skill)
  }
}

async function listAvailableSkills(cwd: string, asJson: boolean): Promise<void> {
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
      console.log(JSON.stringify(resolved.skills, null, 2))
      return
    }

    logger.asdm(`Available skills for profile "${projectConfig.profile}"`)
    logger.divider()

    if (resolved.skills.length === 0) {
      logger.info('No skills defined for this profile')
      return
    }

    for (const skill of resolved.skills) {
      const assetKey = `skills/${skill}/SKILL.asdm.md`
      const meta = manifest.assets[assetKey]
      const version = meta?.version ?? '?'
      logger.bullet(`${skill}  (v${version})`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const suggestion = (err as { suggestion?: string }).suggestion ?? undefined
    logger.error(message, suggestion)
    process.exit(1)
  }
}
