/**
 * Verifier — Integrity checking of managed files against the lockfile.
 * 
 * Works fully offline (RNF-05). Reads the lockfile and computes SHA-256
 * of each tracked file, comparing against the stored checksums.
 * 
 * Exit codes (used by CLI):
 *   0 = all files intact
 *   1 = files modified (tampering detected)
 *   2 = lockfile absent (needs asdm sync)
 *   3 = manifest version outdated (new version available)
 */

import path from 'node:path'
import { readLockfile } from './lockfile.js'
import { hashFile } from './hash.js'
import { exists, resolveGlobalEmitPath } from '../utils/fs.js'
import { IntegrityError } from '../utils/errors.js'
import type { TelemetryWriter } from './telemetry.js'

export const VERIFY_EXIT_CODES = {
  OK: 0,
  MODIFIED: 1,
  NO_LOCK: 2,
  OUTDATED: 3,
} as const

export type VerifyExitCode = typeof VERIFY_EXIT_CODES[keyof typeof VERIFY_EXIT_CODES]

export type ViolationType = 'modified' | 'missing' | 'extra'

export interface Violation {
  filePath: string
  type: ViolationType
  expected?: string    // Expected SHA-256 from lockfile
  actual?: string      // Actual SHA-256 on disk
}

export interface VerifyResult {
  exitCode: VerifyExitCode
  violations: Violation[]
  checkedFiles: number
  currentManifestVersion?: string
  latestManifestVersion?: string
}

/**
 * Verify integrity of all managed files against the lockfile.
 *
 * @param cwd - Project root directory
 * @param latestManifestVersion - If provided, compare against local to detect outdated (exit code 3)
 * @param onlyManaged - If true, only check files with managed=true in lockfile
 * @param telemetry - Optional writer for local telemetry events
 * @param lockfilePath - Explicit lockfile path override (used by `verify --global`)
 */
export async function verify(
  cwd: string,
  latestManifestVersion?: string,
  onlyManaged = true,
  telemetry?: TelemetryWriter,
  lockfilePath?: string,
): Promise<VerifyResult> {
  const lockfile = await readLockfile(cwd, lockfilePath)
  const isGlobal = lockfilePath !== undefined
  
  if (!lockfile) {
    telemetry?.write({ event: 'verify.failed' }).catch(() => {})
    return {
      exitCode: VERIFY_EXIT_CODES.NO_LOCK,
      violations: [],
      checkedFiles: 0,
    }
  }
  
  const violations: Violation[] = []
  let checkedFiles = 0
  
  const filesToCheck = onlyManaged
    ? Object.entries(lockfile.files).filter(([, entry]) => entry.managed)
    : Object.entries(lockfile.files)
  
  for (const [relativePath, entry] of filesToCheck) {
    // In global mode resolve against the provider's global config dir;
    // fall back to cwd-relative for any unrecognised path.
    const absolutePath = isGlobal
      ? (resolveGlobalEmitPath(relativePath, entry.adapter) ?? path.join(cwd, relativePath))
      : path.join(cwd, relativePath)
    checkedFiles++
    
    const fileExists = await exists(absolutePath)
    
    if (!fileExists) {
      violations.push({
        filePath: relativePath,
        type: 'missing',
        expected: entry.sha256,
      })
      continue
    }
    
    const actualHash = await hashFile(absolutePath)
    
    if (actualHash !== entry.sha256) {
      violations.push({
        filePath: relativePath,
        type: 'modified',
        expected: entry.sha256,
        actual: actualHash,
      })
    }
  }
  
  // Determine exit code
  let exitCode: VerifyExitCode = VERIFY_EXIT_CODES.OK
  
  if (violations.length > 0) {
    exitCode = VERIFY_EXIT_CODES.MODIFIED
  } else if (
    latestManifestVersion &&
    lockfile.manifest_version !== latestManifestVersion
  ) {
    exitCode = VERIFY_EXIT_CODES.OUTDATED
  }

  // Write telemetry event — fire-and-forget
  if (violations.length > 0) {
    telemetry?.write({ event: 'verify.modified', violations: violations.length }).catch(() => {})
  } else {
    telemetry?.write({ event: 'verify.passed', violations: 0 }).catch(() => {})
  }
  
  return {
    exitCode,
    violations,
    checkedFiles,
    currentManifestVersion: lockfile.manifest_version,
    latestManifestVersion,
  }
}

/**
 * Strict mode: throw IntegrityError on any violation.
 * Used by the pre-commit hook.
 */
export async function verifyStrict(cwd: string): Promise<void> {
  const result = await verify(cwd)
  
  if (result.exitCode === VERIFY_EXIT_CODES.NO_LOCK) {
    throw new IntegrityError(
      'No .asdm-lock.json found',
      'Run `asdm sync` to synchronize assets'
    )
  }
  
  if (result.violations.length > 0) {
    const paths = result.violations.map(v => `  - ${v.filePath} (${v.type})`).join('\n')
    throw new IntegrityError(
      `Integrity violations detected in ${result.violations.length} managed file(s):\n${paths}`,
      'Run `asdm sync --force` to restore managed files or `asdm verify` for details'
    )
  }
}
