/**
 * Lockfile Manager — .asdm-lock.json
 *
 * The lockfile records:
 *   - When the last sync happened
 *   - Which manifest version was synced
 *   - SHA-256 checksums of all emitted files (for tampering detection)
 *   - Source → adapter mapping for each file
 *
 * It enables:
 *   - Offline integrity verification (asdm verify)
 *   - Incremental sync (detect what changed)
 *   - Audit trail
 */

import path from 'node:path'
import { readJson, writeJson, exists } from '../utils/fs.js'

export interface LockfileEntry {
  sha256: string
  source: string      // Registry-relative path of source .asdm.md
  adapter: string     // Adapter name: opencode, claude-code, copilot
  version: string     // Asset version from manifest
  managed: boolean    // true = managed by ASDM; false = overlay
}

export interface AsdmLockfile {
  $schema?: string
  synced_at: string
  cli_version: string
  manifest_version: string
  manifest_commit?: string
  registry: string
  profile: string
  resolved_profiles: string[]
  files: Record<string, LockfileEntry>
}

const LOCKFILE_NAME = '.asdm-lock.json'

/** Read the lockfile from the project root */
export async function readLockfile(cwd: string): Promise<AsdmLockfile | null> {
  const filePath = path.join(cwd, LOCKFILE_NAME)
  return readJson<AsdmLockfile>(filePath)
}

/** Write the lockfile to the project root */
export async function writeLockfile(cwd: string, lockfile: AsdmLockfile): Promise<void> {
  const filePath = path.join(cwd, LOCKFILE_NAME)
  await writeJson(filePath, {
    $schema: 'https://asdm.dev/schemas/lock.schema.json',
    ...lockfile,
  })
}

/** Check if a lockfile exists */
export async function lockfileExists(cwd: string): Promise<boolean> {
  return exists(path.join(cwd, LOCKFILE_NAME))
}

/**
 * Extract a map of source-asset-path → sha256 from the lockfile.
 * Used for incremental sync comparison.
 */
export function extractSourceShas(lockfile: AsdmLockfile): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [, entry] of Object.entries(lockfile.files)) {
    if (entry.managed && entry.source) {
      result[entry.source] = entry.sha256
    }
  }

  // Note: this gives us SHA of emitted files, not source assets.
  // For manifest comparison we compare manifest.assets[path].sha256 (source)
  // vs the stored sha from when we downloaded and hashed the source.
  return result
}

/**
 * Compute the diff between an existing lockfile and new sync results.
 * Returns lists of added, updated, removed, and unchanged emitted file paths.
 */
export interface LockfileDiff {
  added: string[]
  updated: string[]
  removed: string[]
  unchanged: string[]
}

export function diffLockfiles(
  current: AsdmLockfile | null,
  incoming: Record<string, LockfileEntry>
): LockfileDiff {
  const added: string[] = []
  const updated: string[] = []
  const removed: string[] = []
  const unchanged: string[] = []

  const currentFiles = current?.files ?? {}

  for (const [filePath, entry] of Object.entries(incoming)) {
    const existing = currentFiles[filePath]
    if (!existing) {
      added.push(filePath)
    } else if (existing.sha256 !== entry.sha256) {
      updated.push(filePath)
    } else {
      unchanged.push(filePath)
    }
  }

  for (const filePath of Object.keys(currentFiles)) {
    if (!incoming[filePath]) {
      removed.push(filePath)
    }
  }

  return { added, updated, removed, unchanged }
}

/** Create a new lockfile entry for an emitted file */
export function createLockEntry(
  sha256: string,
  source: string,
  adapter: string,
  version: string,
  managed = true
): LockfileEntry {
  return { sha256, source, adapter, version, managed }
}

/** Build a new lockfile from sync results */
export function buildLockfile(params: {
  cliVersion: string
  manifestVersion: string
  manifestCommit: string
  registry: string
  profile: string
  resolvedProfiles: string[]
  files: Record<string, LockfileEntry>
}): AsdmLockfile {
  return {
    $schema: 'https://asdm.dev/schemas/lock.schema.json',
    synced_at: new Date().toISOString(),
    cli_version: params.cliVersion,
    manifest_version: params.manifestVersion,
    manifest_commit: params.manifestCommit,
    registry: params.registry,
    profile: params.profile,
    resolved_profiles: params.resolvedProfiles,
    files: params.files,
  }
}
