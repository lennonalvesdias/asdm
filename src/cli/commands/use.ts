/**
 * asdm use <profile> — Switch the active profile.
 *
 * Validates the requested profile against the cached manifest (if available),
 * writes the new profile to .asdm.local.json (gitignored), then runs sync
 * automatically to apply the change.
 */

import { defineCommand } from 'citty'
import { readProjectConfig, writeUserConfig } from '../../core/config.js'
import { sync } from '../../core/syncer.js'
import { loadCachedManifest } from '../../core/manifest.js'
import { logger } from '../../utils/logger.js'
import { ConfigError } from '../../utils/errors.js'

export default defineCommand({
  meta: {
    name: 'use',
    description: 'Switch the active profile (stored in .asdm.local.json)',
  },
  args: {
    profile: {
      type: 'positional',
      description: 'Profile name to activate',
      required: true,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const profile = ctx.args.profile

    if (!profile) {
      logger.error('Profile name is required', 'Usage: asdm use <profile>')
      process.exitCode = 1
      return
    }

    try {
      // Ensure project is initialized
      await readProjectConfig(cwd)
    } catch (err) {
      if (err instanceof ConfigError) {
        logger.error('No .asdm.json found', 'Run `asdm init` first')
        process.exitCode = 1
        return
      }
      throw err
    }

    // M2: Validate profile against cached manifest (skip gracefully if unavailable)
    const cachedManifest = await loadCachedManifest(cwd)
    if (cachedManifest) {
      if (!cachedManifest.profiles[profile]) {
        const available = Object.keys(cachedManifest.profiles).join(', ')
        logger.error(
          `Profile "${profile}" not found in manifest`,
          `Available profiles: ${available}`
        )
        process.exitCode = 1
        return
      }
    } else {
      logger.warn('No cached manifest found — skipping profile validation')
    }

    try {
      await writeUserConfig(cwd, { profile })
      logger.success(`Switched to profile "${profile}"`)

      // M1: Auto-sync to apply the new profile immediately
      logger.asdm('Syncing with new profile…')
      const result = await sync({ cwd })
      const changed = result.stats.filesAdded + result.stats.filesUpdated
      logger.success(`Sync complete — ${changed} file(s) updated`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const suggestion = (err as { suggestion?: string }).suggestion ?? undefined
      logger.error(message, suggestion)
      process.exitCode = 1
      return
    }
  },
})
