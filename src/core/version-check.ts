/**
 * Version Check — Non-blocking npm update notifier.
 *
 * Fetches the latest @asdm/cli version from the npm registry at most
 * once per 24 hours. Results are cached in ~/.config/asdm/version-check-cache.json.
 *
 * All failures are swallowed silently — the check must never disrupt CLI operation.
 */

import path from 'node:path'
import { readJson, writeJson, ensureDir, getAsdmConfigDir } from '../utils/fs.js'

interface VersionCheckCache {
  checkedAt: string      // ISO 8601 timestamp
  latestVersion: string  // semver string from npm
}

const CACHE_FILENAME = 'version-check-cache.json'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000  // 24 hours
const FETCH_TIMEOUT_MS = 3_000                   // 3 second hard timeout

/**
 * Compare two semver strings without external dependencies.
 * Returns true when `latest` is strictly newer than `current`.
 */
function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const parts = v.replace(/^v/, '').split('.')
    return [
      parseInt(parts[0] ?? '0', 10),
      parseInt(parts[1] ?? '0', 10),
      parseInt(parts[2] ?? '0', 10),
    ]
  }

  const [cMajor, cMinor, cPatch] = parse(current)
  const [lMajor, lMinor, lPatch] = parse(latest)

  if (lMajor !== cMajor) return lMajor > cMajor
  if (lMinor !== cMinor) return lMinor > cMinor
  return lPatch > cPatch
}

/**
 * Checks if a newer version of @asdm/cli is available on npm.
 *
 * - Checks at most once every 24 hours (cached in ~/.config/asdm/version-check-cache.json)
 * - Has a 3-second network timeout
 * - Returns null silently on any failure (network, parse, etc.)
 * - Returns the latest version string only when it is strictly newer than currentVersion
 */
export async function checkForUpdate(currentVersion: string): Promise<string | null> {
  const cacheDir = getAsdmConfigDir()
  const cachePath = path.join(cacheDir, CACHE_FILENAME)

  // Read cache — if it exists and is still fresh, skip network call
  const cache = await readJson<VersionCheckCache>(cachePath)
  if (cache) {
    const ageMs = Date.now() - new Date(cache.checkedAt).getTime()
    if (ageMs < CHECK_INTERVAL_MS) {
      return isNewerVersion(currentVersion, cache.latestVersion)
        ? cache.latestVersion
        : null
    }
  }

  // Cache is stale or absent — fetch latest version from npm registry
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch('https://registry.npmjs.org/@asdm/cli/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    clearTimeout(timer)

    if (!response.ok) return null

    const data = await response.json() as { version?: string }
    const latestVersion = data.version
    if (!latestVersion) return null

    // Persist to cache so the next 24 hours are served locally
    await ensureDir(cacheDir)
    await writeJson(cachePath, {
      checkedAt: new Date().toISOString(),
      latestVersion,
    } satisfies VersionCheckCache)

    return isNewerVersion(currentVersion, latestVersion) ? latestVersion : null

  } catch {
    // Network unavailable, timeout, or parse error — fail silently
    return null
  }
}
