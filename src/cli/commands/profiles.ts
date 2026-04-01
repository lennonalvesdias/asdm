/**
 * asdm profiles — List available profiles from the registry manifest.
 *
 * Fetches the latest manifest and displays all profiles with their
 * agent/skill/command counts and inheritance chains.
 */

import { defineCommand } from 'citty'
import { readProjectConfig } from '../../core/config.js'
import { RegistryClient } from '../../core/registry-client.js'
import { logger } from '../../utils/logger.js'
import { ConfigError } from '../../utils/errors.js'

export default defineCommand({
  meta: {
    name: 'profiles',
    description: 'List available profiles from the registry',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()

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

      if (ctx.args.json) {
        console.log(JSON.stringify(manifest.profiles, null, 2))
        return
      }

      logger.asdm(`Available profiles (manifest v${manifest.version})`)
      logger.divider()

      const profileEntries = Object.entries(manifest.profiles)
      if (profileEntries.length === 0) {
        logger.info('No profiles found in manifest')
        return
      }

      for (const [name, profile] of profileEntries) {
        const agents = profile.agents?.length ?? 0
        const skills = profile.skills?.length ?? 0
        const cmds = profile.commands?.length ?? 0
        const extendsFrom = profile.extends?.join(', ') ?? '—'

        logger.bullet(logger.bold(name))
        logger.table([
          ['  Extends', extendsFrom],
          ['  Agents', String(agents)],
          ['  Skills', String(skills)],
          ['  Commands', String(cmds)],
        ], 12)
      }

      logger.divider()
      logger.info('Use `asdm use <profile>` to switch profiles')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const suggestion = (err as { suggestion?: string }).suggestion ?? undefined
      logger.error(message, suggestion)
      process.exit(1)
    }
  },
})
