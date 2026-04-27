/**
 * Husky Detection Utility
 *
 * Detects whether Husky is installed in a project and determines the version.
 * Pure detection — no side effects, no logging.
 *
 * Detection strategy:
 *   1. Check package.json devDependencies/dependencies for "husky" key
 *   2. Parse semver major to determine v8 vs v9+
 *   3. Fall back to filesystem detection via .husky/ directory
 */

import path from 'node:path'
import { readJson, exists } from './fs.js'

export interface HuskyInfo {
  detected: boolean
  version: 'v8' | 'v9+' | null  // null only when detected=false
  huskyDir: string | null        // absolute path to .husky/ dir, or null
}

interface PackageJson {
  devDependencies?: Record<string, string>
  dependencies?: Record<string, string>
}

/**
 * Extract the semver major integer from a version string.
 * Strips leading range sigils (^, ~, >=, =, v) before parsing.
 * Returns null if the string cannot be parsed.
 */
function parseMajorVersion(versionString: string): number | null {
  const stripped = versionString.replace(/^[^0-9]*/, '')
  const majorPart = stripped.split('.')[0] ?? ''
  const major = parseInt(majorPart, 10)
  return isNaN(major) ? null : major
}

/** Map semver major to the version discriminator used by HuskyInfo */
function majorToHuskyVersion(major: number): 'v8' | 'v9+' {
  return major >= 9 ? 'v9+' : 'v8'
}

/**
 * Detect Husky installation in the given project root.
 *
 * Returns { detected: false } when neither package.json nor the
 * .husky/ directory indicate a Husky setup.
 */
export async function detectHusky(cwd: string): Promise<HuskyInfo> {
  const huskyDirPath = path.join(cwd, '.husky')
  const huskyDirExists = await exists(huskyDirPath)

  // ── Step 1: check package.json ───────────────────────────────────────────
  const pkg = await readJson<PackageJson>(path.join(cwd, 'package.json'))
  const huskyVersionString =
    pkg?.devDependencies?.['husky'] ?? pkg?.dependencies?.['husky']

  if (huskyVersionString !== undefined) {
    const major = parseMajorVersion(huskyVersionString)
    const version = major !== null ? majorToHuskyVersion(major) : 'v9+'
    return {
      detected: true,
      version,
      huskyDir: huskyDirExists ? huskyDirPath : null,
    }
  }

  // ── Step 2: no package.json entry — inspect .husky/ dir ─────────────────
  if (!huskyDirExists) {
    return { detected: false, version: null, huskyDir: null }
  }

  // .husky/ dir exists without a package.json entry.
  // Presence of .husky/_/husky.sh distinguishes v8 from v9+.
  const huskyShExists = await exists(path.join(huskyDirPath, '_', 'husky.sh'))
  const version = huskyShExists ? 'v8' : 'v9+'

  return {
    detected: true,
    version,
    huskyDir: huskyDirPath,
  }
}
