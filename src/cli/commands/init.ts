/**
 * asdm init [profile] — Initialize .asdm.json in the current project.
 *
 * Creates a project config file with registry, profile, and provider defaults.
 * Exits early if config already exists unless --force is passed.
 *
 * Gitignore integration:
 *   --gitignore   Automatically add ASDM output dirs to .gitignore after init.
 *   (omitted)     In a TTY, prints a tip to run `asdm gitignore` manually.
 */

import { defineCommand } from 'citty'
import path from 'node:path'
import { exists } from '../../utils/fs.js'
import { updateGitignore } from '../../utils/gitignore.js'
import { createProjectConfig } from '../../core/config.js'
import { TelemetryWriter } from '../../core/telemetry.js'
import { logger } from '../../utils/logger.js'

const DEFAULT_REGISTRY = 'github://lennonalvesdias/asdm'

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize .asdm.json in the current project',
  },
  args: {
    profile: {
      type: 'positional',
      description: 'Profile to initialize with (default: base)',
      required: false,
      default: 'base',
    },
    registry: {
      type: 'string',
      description: 'Registry URL in github://org/repo format',
      default: DEFAULT_REGISTRY,
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing .asdm.json',
      default: false,
    },
    gitignore: {
      type: 'boolean',
      description: 'Add ASDM output dirs to .gitignore after init',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const configPath = path.join(cwd, '.asdm.json')

    const alreadyExists = await exists(configPath)
    if (alreadyExists && !ctx.args.force) {
      logger.warn('.asdm.json already exists. Use --force to overwrite.')
      return
    }

    const profile = ctx.args.profile || 'base'
    const registry = ctx.args.registry || DEFAULT_REGISTRY

    // Default providers written by createProjectConfig
    const providers: Array<'opencode' | 'claude-code' | 'copilot'> = ['opencode']

    try {
      await createProjectConfig(cwd, registry, profile, providers)
      logger.success(`Initialized .asdm.json with profile "${profile}"`)
      logger.info(`Registry: ${registry}`)
      logger.info('Next step: run `asdm sync` to install agents, skills, and commands')

      // Fire-and-forget telemetry after successful init
      const telemetry = new TelemetryWriter(cwd)
      telemetry.write({ event: 'init.completed', profile, registry }).catch(() => {})

      if (ctx.args.gitignore) {
        const updated = await updateGitignore(cwd, providers)
        if (updated) {
          logger.success('Updated .gitignore with ASDM managed entries')
        } else {
          logger.info('.gitignore already up to date')
        }
      } else if (process.stdout.isTTY) {
        logger.info("💡 Tip: Run 'asdm gitignore' to add ASDM output dirs to .gitignore")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(message)
      process.exitCode = 1
      return
    }
  },
})
