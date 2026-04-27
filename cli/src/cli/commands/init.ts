/**
 * asdm init [profile] — Initialize .asdm.json in the current project.
 *
 * Creates a project config file with registry, profile, and provider defaults.
 * Exits early if config already exists unless --force is passed.
 *
 * Flags:
 *   --global      Write config to ~/.config/asdm/config.json instead of .asdm.json.
 *   --gitignore   Automatically add ASDM output dirs to .gitignore after init.
 *   (omitted)     In a TTY, prints a tip to run `asdm gitignore` manually.
 *
 * Interactive mode (TTY only):
 *   Prompts for providers (multi-select) and profile (single-select).
 *   Falls back to CLI args in CI / non-TTY environments.
 */

import { defineCommand } from 'citty'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { readdir, readFile as readFileRaw } from 'node:fs/promises'
import { parse as parseYaml } from 'yaml'
import { exists, ensureDir, getGlobalConfigPath } from '../../utils/fs.js'
import { updateGitignore } from '../../utils/gitignore.js'
import { createProjectConfig, createProjectConfigAtPath } from '../../core/config.js'
import { TelemetryWriter } from '../../core/telemetry.js'
import { logger } from '../../utils/logger.js'
import { selectOne, selectMany } from '../../utils/prompt.js'

type Provider = 'opencode' | 'claude-code' | 'copilot' | 'agents-dir'

const DEFAULT_REGISTRY = 'github://lennonalvesdias/asdm'

const DEFAULT_PROVIDERS: Provider[] = ['opencode']

const PROVIDER_OPTIONS: Array<{ label: string; value: Provider }> = [
  { label: 'opencode    — OpenCode IDE integration (.opencode/)', value: 'opencode' },
  { label: 'claude-code — Claude Code IDE integration (.claude/)', value: 'claude-code' },
  { label: 'copilot     — GitHub Copilot integration (.github/)', value: 'copilot' },
  { label: 'agents-dir  — Cross-provider agents directory (.agents/)', value: 'agents-dir' },
]

function findPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  let dir = path.dirname(currentFile)
  while (true) {
    if (existsSync(path.join(dir, 'package.json'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error('Could not find package root (package.json not found)')
    dir = parent
  }
}

async function loadProfileOptions(): Promise<Array<{ label: string; value: string }>> {
  const root = findPackageRoot()
  const profilesDir = path.join(root, 'registry', 'profiles')
  const entries = await readdir(profilesDir, { withFileTypes: true })
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort()

  const options: Array<{ label: string; value: string }> = []
  for (const name of dirs) {
    const yamlPath = path.join(profilesDir, name, 'profile.yaml')
    const raw = await readFileRaw(yamlPath, 'utf-8')
    const parsed = parseYaml(raw) as Record<string, unknown>
    const displayName = typeof parsed?.name === 'string' ? parsed.name : name
    const description = typeof parsed?.description === 'string' ? parsed.description : ''
    const pad = displayName.padEnd(20)
    options.push({ label: `${pad}— ${description}`, value: name })
  }

  if (options.length === 0) {
    throw new Error('No profiles found in registry/profiles/')
  }

  return options
}

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
      description: 'Overwrite existing config',
      default: false,
    },
    global: {
      type: 'boolean',
      description: 'Write config to ~/.config/asdm/config.json instead of .asdm.json',
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
    const registry = ctx.args.registry || DEFAULT_REGISTRY
    const isTTY = process.stdin.isTTY && process.stdout.isTTY

    let profile: string
    let providers: Provider[]

    if (isTTY) {
      let profileOptions: Array<{ label: string; value: string }>
      try {
        profileOptions = await loadProfileOptions()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
        return
      }

      const selectedProviders = await selectMany('Select providers', PROVIDER_OPTIONS)
      providers = selectedProviders.length > 0 ? selectedProviders : DEFAULT_PROVIDERS

      const selectedProfile = await selectOne('Select profile', profileOptions)
      profile = selectedProfile ?? 'base'

      console.log('')
      logger.info(`  Profile:   ${profile}`)
      logger.info(`  Providers: ${providers.join(', ')}`)
    } else {
      profile = ctx.args.profile || 'base'
      providers = DEFAULT_PROVIDERS
    }

    if (ctx.args.global) {
      const targetPath = getGlobalConfigPath()
      const alreadyExists = await exists(targetPath)

      if (alreadyExists && !ctx.args.force) {
        logger.warn(`Global config already exists at ${targetPath}. Use --force to overwrite.`)
        return
      }

      try {
        await ensureDir(path.dirname(targetPath))
        await createProjectConfigAtPath(targetPath, registry, profile, providers)
        logger.success(`Global config written to ${targetPath}`)
        logger.info(`Registry: ${registry}`)
        logger.info('Next step: run `asdm sync --global` to install agents, skills, and commands')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(message)
        process.exitCode = 1
        return
      }
      return
    }

    // Local init (existing behavior)
    const configPath = path.join(cwd, '.asdm.json')

    const alreadyExists = await exists(configPath)
    if (alreadyExists && !ctx.args.force) {
      logger.warn('.asdm.json already exists. Use --force to overwrite.')
      return
    }

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
