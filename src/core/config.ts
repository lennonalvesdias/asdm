/**
 * Layered Configuration Resolver
 *
 * Resolves configuration from 3 layers with merge and policy lock enforcement:
 *   1. Corporate (policy from manifest) — locked fields cannot be overridden
 *   2. Project (.asdm.json — committed to git)
 *   3. User (.asdm.local.json — gitignored, created by `asdm use`)
 *
 * Precedence: user > project; locked policy fields override everything.
 */

import path from 'node:path'
import { readJson, writeJson } from '../utils/fs.js'
import { ConfigError, PolicyError } from '../utils/errors.js'

export interface ProjectConfig {
  $schema?: string
  registry: string
  profile: string
  providers?: Array<'opencode' | 'claude-code' | 'copilot'>
  telemetry?: boolean    // Local telemetry enabled (default: true)
}

export interface UserConfig {
  profile?: string
}

export interface CorporatePolicy {
  locked_fields?: string[]
  telemetry?: boolean
  auto_verify?: boolean
  install_hooks?: boolean
  allowed_profiles: string[]
  allowed_providers: string[]
  min_cli_version?: string
}

export interface ResolvedConfig {
  registry: string
  profile: string
  providers: Array<'opencode' | 'claude-code' | 'copilot'>
  policy: CorporatePolicy
}

const PROJECT_CONFIG_FILE = '.asdm.json'
const USER_CONFIG_FILE = '.asdm.local.json'

/** Parse and validate the github:// registry URL format */
export function parseRegistryUrl(url: string): { org: string; repo: string } {
  const match = url.match(/^github:\/\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/)
  if (!match) {
    throw new ConfigError(
      `Invalid registry URL: "${url}"`,
      'Registry URL must be in format: github://{org}/{repo}'
    )
  }
  return { org: match[1]!, repo: match[2]! }
}

/** Read the project config from .asdm.json */
export async function readProjectConfig(cwd: string): Promise<ProjectConfig> {
  const filePath = path.join(cwd, PROJECT_CONFIG_FILE)
  const config = await readJson<ProjectConfig>(filePath)

  if (!config) {
    throw new ConfigError(
      `No ${PROJECT_CONFIG_FILE} found in ${cwd}`,
      'Run `asdm init --profile <name>` to initialize'
    )
  }

  if (!config.registry) {
    throw new ConfigError(`Missing required field 'registry' in ${PROJECT_CONFIG_FILE}`)
  }
  if (!config.profile) {
    throw new ConfigError(`Missing required field 'profile' in ${PROJECT_CONFIG_FILE}`)
  }

  // Validate registry URL format
  parseRegistryUrl(config.registry)

  return config
}

/** Read the user config from .asdm.local.json (may not exist) */
export async function readUserConfig(cwd: string): Promise<UserConfig | null> {
  const filePath = path.join(cwd, USER_CONFIG_FILE)
  return readJson<UserConfig>(filePath)
}

/** Write the user config to .asdm.local.json (created by `asdm use`) */
export async function writeUserConfig(cwd: string, config: UserConfig): Promise<void> {
  const filePath = path.join(cwd, USER_CONFIG_FILE)
  await writeJson(filePath, config)
}

/**
 * Resolve the final configuration by merging all layers.
 *
 * The policy is passed in (obtained from the manifest after downloading).
 * This is a two-step process:
 *   1. Read project config → get registry URL
 *   2. Download manifest → get policy
 *   3. Call resolveConfig(project, user, policy) to get final config
 */
export function resolveConfig(
  project: ProjectConfig,
  user: UserConfig | null,
  policy: CorporatePolicy
): ResolvedConfig {
  // Start with project config
  const profile = user?.profile ?? project.profile
  const providers = project.providers ?? ['opencode']

  // Validate profile is allowed by policy
  if (!policy.allowed_profiles.includes(profile)) {
    throw new PolicyError(
      `Profile "${profile}" is not allowed by corporate policy`,
      `Allowed profiles: ${policy.allowed_profiles.join(', ')}\nRun \`asdm profiles\` to see available profiles`
    )
  }

  // Validate all providers are allowed
  const disallowedProviders = providers.filter(p => !policy.allowed_providers.includes(p))
  if (disallowedProviders.length > 0) {
    throw new PolicyError(
      `Provider(s) not allowed by corporate policy: ${disallowedProviders.join(', ')}`,
      `Allowed providers: ${policy.allowed_providers.join(', ')}`
    )
  }

  return {
    registry: project.registry,
    profile,
    providers: providers as Array<'opencode' | 'claude-code' | 'copilot'>,
    policy,
  }
}

/**
 * Create a default .asdm.json for `asdm init`
 */
export async function createProjectConfig(
  cwd: string,
  registry: string,
  profile: string,
  providers: Array<'opencode' | 'claude-code' | 'copilot'> = ['opencode']
): Promise<void> {
  const filePath = path.join(cwd, PROJECT_CONFIG_FILE)
  const config: ProjectConfig = {
    $schema: 'https://asdm.dev/schemas/config.schema.json',
    registry,
    profile,
    providers,
  }
  await writeJson(filePath, config)
}
