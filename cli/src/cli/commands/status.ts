/**
 * asdm status — Show current config and sync status.
 *
 * Displays registry URL, active profile, installed assets,
 * and the last sync timestamp from the lockfile.
 */

import { defineCommand } from 'citty'
import { readProjectConfig, readUserConfig } from '../../core/config.js'
import { readLockfile } from '../../core/lockfile.js'
import { logger } from '../../utils/logger.js'
import { ConfigError } from '../../utils/errors.js'

export default defineCommand({
  meta: {
    name: 'status',
    description: 'Show current config and sync status',
  },
  async run(_ctx) {
    const cwd = process.cwd()

    let projectConfig
    try {
      projectConfig = await readProjectConfig(cwd)
    } catch (err) {
      if (err instanceof ConfigError) {
        logger.warn('Not initialized. Run `asdm init` first.')
        process.exitCode = 1
        return
      }
      throw err
    }

    const userConfig = await readUserConfig(cwd)
    const lockfile = await readLockfile(cwd)

    const activeProfile = userConfig?.profile ?? projectConfig.profile
    const providers = projectConfig.providers ?? ['opencode']

    logger.asdm('ASDM Status')
    logger.divider()

    logger.table([
      ['Registry', projectConfig.registry],
      ['Profile (project)', projectConfig.profile],
      ['Profile (active)', activeProfile],
      ['Providers', providers.join(', ')],
    ])

    logger.divider()

    if (!lockfile) {
      logger.warn('Not synced — no lockfile found')
      logger.info('Run `asdm sync` to synchronize assets')
      return
    }

    const syncedAt = new Date(lockfile.synced_at).toLocaleString()
    const managedFiles = Object.entries(lockfile.files).filter(([, e]) => e.managed)
    const agents = [...new Set(managedFiles.filter(([, e]) => e.source.startsWith('agents/')).map(([, e]) => e.source.replace('agents/', '').replace('.asdm.md', '')))]
    const skills = [...new Set(managedFiles.filter(([, e]) => e.source.startsWith('skills/')).map(([, e]) => e.source.replace('skills/', '').replace('/SKILL.asdm.md', '')))]
    const commands = [...new Set(managedFiles.filter(([, e]) => e.source.startsWith('commands/')).map(([, e]) => e.source.replace('commands/', '').replace('.asdm.md', '')))]

    logger.table([
      ['Last synced', syncedAt],
      ['Manifest version', lockfile.manifest_version],
      ['CLI version', lockfile.cli_version],
      ['Managed files', String(managedFiles.length)],
      ['Agents', agents.length > 0 ? agents.join(', ') : '(none)'],
      ['Skills', skills.length > 0 ? skills.join(', ') : '(none)'],
      ['Commands', commands.length > 0 ? commands.join(', ') : '(none)'],
    ])

    logger.divider()
    logger.success('Up to date — run `asdm sync` to check for updates')
  },
})
