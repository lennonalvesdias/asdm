/**
 * Profile Resolver — Resolves profile inheritance chains with deep merge.
 *
 * Profiles can extend other profiles. The resolver:
 *   1. Loads the target profile
 *   2. Recursively loads all parent profiles (extends chain)
 *   3. Deep merges from base → specialization (more specific wins)
 *   4. Detects cycles in the inheritance chain
 *   5. Returns a flat ResolvedProfile with all agents, skills, commands merged
 */

import path from 'node:path'
import { readFile } from '../utils/fs.js'
import { ConfigError } from '../utils/errors.js'
import { parse as parseYaml } from 'yaml'

export interface ProfileDefinition {
  name: string
  description?: string
  extends?: string[]
  agents?: string[]
  skills?: string[]
  commands?: string[]
  providers?: string[]
  provider_config?: Record<string, unknown>
}

export interface ResolvedProfile {
  name: string
  description?: string
  agents: string[]
  skills: string[]
  commands: string[]
  providers: string[]
  provider_config: Record<string, Record<string, unknown>>
  resolvedFrom: string[]  // Ordered chain: [base, ..., current]
}

/** Load a profile.yaml from the registry directory */
async function loadProfile(registryDir: string, profileName: string): Promise<ProfileDefinition> {
  const filePath = path.join(registryDir, 'profiles', profileName, 'profile.yaml')
  const content = await readFile(filePath)

  if (!content) {
    throw new ConfigError(
      `Profile "${profileName}" not found at ${filePath}`,
      `Run \`asdm profiles\` to see available profiles`
    )
  }

  const profile = parseYaml(content) as ProfileDefinition
  if (!profile.name) {
    throw new ConfigError(`Profile at ${filePath} is missing required 'name' field`)
  }

  return profile
}

/** Deep merge two provider_config objects */
function mergeProviderConfig(
  base: Record<string, Record<string, unknown>>,
  override: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = { ...base }

  for (const [provider, config] of Object.entries(override)) {
    if (result[provider]) {
      // Deep merge arrays: concatenate and deduplicate where values are arrays
      const merged: Record<string, unknown> = { ...result[provider] }
      for (const [key, value] of Object.entries(config)) {
        if (Array.isArray(value) && Array.isArray(merged[key])) {
          // Concatenate arrays (base first, then override additions)
          const combined = [...(merged[key] as unknown[]), ...value]
          merged[key] = [...new Set(combined)]
        } else {
          merged[key] = value
        }
      }
      result[provider] = merged
    } else {
      result[provider] = { ...config }
    }
  }

  return result
}

/** Merge two string arrays, deduplicating (order: base first, then additions) */
function mergeStringArrays(base: string[], override: string[]): string[] {
  const result = [...base]
  for (const item of override) {
    if (item.startsWith('-')) {
      // Removal syntax: "-agent-name" removes from base
      const toRemove = item.slice(1)
      const idx = result.indexOf(toRemove)
      if (idx !== -1) result.splice(idx, 1)
    } else if (!result.includes(item)) {
      result.push(item)
    }
  }
  return result
}

/**
 * Resolve a profile and all its parents into a flat ResolvedProfile.
 *
 * @param registryDir - Path to the registry directory (contains profiles/, agents/, etc.)
 * @param profileName - Name of the profile to resolve
 * @param visited - Set of already-visited profile names (cycle detection)
 */
export async function resolveProfile(
  registryDir: string,
  profileName: string,
  visited: Set<string> = new Set()
): Promise<ResolvedProfile> {
  if (visited.has(profileName)) {
    throw new ConfigError(
      `Circular profile inheritance detected: ${[...visited].join(' → ')} → ${profileName}`,
      'Remove the circular extends reference in profile.yaml'
    )
  }
  visited.add(profileName)

  const profile = await loadProfile(registryDir, profileName)

  // Start with empty base
  let resolved: ResolvedProfile = {
    name: profileName,
    description: profile.description,
    agents: [],
    skills: [],
    commands: [],
    providers: [],
    provider_config: {},
    resolvedFrom: [],
  }

  // Process parent profiles (left to right: earlier parents have lower priority)
  const parents = profile.extends ?? []
  for (const parentName of parents) {
    const parentResolved = await resolveProfile(registryDir, parentName, new Set(visited))

    resolved = {
      ...resolved,
      agents: mergeStringArrays(parentResolved.agents, resolved.agents),
      skills: mergeStringArrays(parentResolved.skills, resolved.skills),
      commands: mergeStringArrays(parentResolved.commands, resolved.commands),
      providers: [...new Set([...parentResolved.providers, ...resolved.providers])],
      provider_config: mergeProviderConfig(parentResolved.provider_config, resolved.provider_config),
      resolvedFrom: [...parentResolved.resolvedFrom],
    }
  }

  // Apply this profile's own definitions on top of merged parents
  resolved = {
    ...resolved,
    agents: mergeStringArrays(resolved.agents, profile.agents ?? []),
    skills: mergeStringArrays(resolved.skills, profile.skills ?? []),
    commands: mergeStringArrays(resolved.commands, profile.commands ?? []),
    providers: [...new Set([...resolved.providers, ...(profile.providers ?? [])])],
    provider_config: mergeProviderConfig(
      resolved.provider_config,
      (profile.provider_config ?? {}) as Record<string, Record<string, unknown>>
    ),
    resolvedFrom: [...resolved.resolvedFrom, profileName],
  }

  return resolved
}

/**
 * Resolve a profile from a manifest's profile definitions (no file system needed).
 * Used when profiles are embedded in the manifest.
 */
export function resolveProfileFromManifest(
  manifestProfiles: Record<string, {
    extends?: string[]
    agents?: string[]
    skills?: string[]
    commands?: string[]
    providers?: string[]
  }>,
  profileName: string,
  visited: Set<string> = new Set()
): ResolvedProfile {
  if (visited.has(profileName)) {
    throw new ConfigError(
      `Circular profile inheritance in manifest: ${[...visited].join(' → ')} → ${profileName}`
    )
  }
  visited.add(profileName)

  const profile = manifestProfiles[profileName]
  if (!profile) {
    throw new ConfigError(`Profile "${profileName}" not found in manifest`)
  }

  let resolved: ResolvedProfile = {
    name: profileName,
    agents: [],
    skills: [],
    commands: [],
    providers: [],
    provider_config: {},
    resolvedFrom: [],
  }

  for (const parentName of profile.extends ?? []) {
    const parent = resolveProfileFromManifest(manifestProfiles, parentName, new Set(visited))
    resolved = {
      ...resolved,
      agents: mergeStringArrays(parent.agents, resolved.agents),
      skills: mergeStringArrays(parent.skills, resolved.skills),
      commands: mergeStringArrays(parent.commands, resolved.commands),
      providers: [...new Set([...parent.providers, ...resolved.providers])],
      provider_config: mergeProviderConfig(parent.provider_config, resolved.provider_config),
      resolvedFrom: [...parent.resolvedFrom],
    }
  }

  resolved = {
    ...resolved,
    agents: mergeStringArrays(resolved.agents, profile.agents ?? []),
    skills: mergeStringArrays(resolved.skills, profile.skills ?? []),
    commands: mergeStringArrays(resolved.commands, profile.commands ?? []),
    providers: [...new Set([...resolved.providers, ...(profile.providers ?? [])])],
    resolvedFrom: [...resolved.resolvedFrom, profileName],
  }

  return resolved
}
