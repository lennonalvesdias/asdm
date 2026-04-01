/**
 * GitHub Releases Registry Client
 *
 * Downloads manifest and assets from GitHub Releases.
 * Uses native fetch (Node 18+) and zero external HTTP dependencies.
 *
 * Registry URL format: github://{org}/{repo}
 * Translates to: https://api.github.com/repos/{org}/{repo}/releases/latest
 */

import { NetworkError, RegistryError } from '../utils/errors.js'
import { parseRegistryUrl } from './config.js'
import type { AsdmManifest } from './manifest.js'

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com'
const FETCH_TIMEOUT_MS = 10_000

export interface RegistryClientOptions {
  token?: string        // GitHub token (GITHUB_TOKEN or ASDM_GITHUB_TOKEN)
  timeout?: number      // Request timeout in ms (default: 30000)
  maxRetries?: number   // Max retry attempts (default: 3)
}

function getGithubToken(): string | undefined {
  return process.env['ASDM_GITHUB_TOKEN'] ?? process.env['GITHUB_TOKEN']
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'asdm-cli/0.1.0',
  }
  const tok = token ?? getGithubToken()
  if (tok) {
    headers['Authorization'] = `Bearer ${tok}`
  }
  return headers
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, { ...options, signal: controller.signal })

      if (response.status === 403 || response.status === 429) {
        // Rate limited — retry
        const retryAfter = response.headers.get('Retry-After')
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 10000)))
          continue
        }
      }

      return response
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === maxRetries - 1) throw new NetworkError(
        `Network request failed after ${maxRetries} attempts: ${lastError.message}`,
        'Check your internet connection and GitHub token'
      )
    } finally {
      clearTimeout(timer)
    }
  }

  throw new NetworkError(
    `Network request failed: ${lastError?.message ?? 'Unknown error'}`,
    'Check your internet connection and GitHub token'
  )
}

export class RegistryClient {
  private readonly org: string
  private readonly repo: string
  private readonly options: Required<RegistryClientOptions>

  constructor(registryUrl: string, options: RegistryClientOptions = {}) {
    const { org, repo } = parseRegistryUrl(registryUrl)
    this.org = org
    this.repo = repo
    this.options = {
      token: options.token ?? getGithubToken() ?? '',
      timeout: options.timeout ?? 30000,
      maxRetries: options.maxRetries ?? 3,
    }
  }

  private get headers() {
    return buildHeaders(this.options.token || undefined)
  }

  /**
   * Fetch the latest release manifest from GitHub Releases.
   * GET /repos/{org}/{repo}/releases/latest → downloads manifest.json asset
   */
  async getLatestManifest(): Promise<AsdmManifest> {
    const url = `${GITHUB_API_BASE}/repos/${this.org}/${this.repo}/releases/latest`

    const response = await fetchWithRetry(
      url,
      { headers: this.headers },
      this.options.maxRetries
    )

    if (response.status === 404) {
      throw new RegistryError(
        `Registry not found: github://${this.org}/${this.repo}`,
        'Verify the registry URL in .asdm.json and ensure the repo exists with published releases'
      )
    }

    if (!response.ok) {
      throw new RegistryError(
        `Failed to fetch latest release: HTTP ${response.status}`,
        response.status === 401
          ? 'Set GITHUB_TOKEN or ASDM_GITHUB_TOKEN environment variable'
          : 'Check registry URL and permissions'
      )
    }

    const release = await response.json() as {
      assets: Array<{ name: string; browser_download_url: string }>
    }

    // Find manifest.json in release assets
    const manifestAsset = release.assets.find(a => a.name === 'manifest.json')
    if (!manifestAsset) {
      throw new RegistryError(
        `manifest.json not found in latest release of github://${this.org}/${this.repo}`,
        'Run the CI workflow to publish a release with manifest.json'
      )
    }

    const manifestResponse = await fetchWithRetry(
      manifestAsset.browser_download_url,
      { headers: this.headers },
      this.options.maxRetries
    )

    if (!manifestResponse.ok) {
      throw new RegistryError(`Failed to download manifest.json: HTTP ${manifestResponse.status}`)
    }

    return manifestResponse.json() as Promise<AsdmManifest>
  }

  /**
   * Download a specific asset file from the registry via raw GitHub content.
   *
   * @param assetPath - Registry-relative path (e.g., "agents/code-reviewer.asdm.md")
   * @param version - Release tag version (e.g., "1.0.0")
   */
  async downloadAsset(assetPath: string, version: string): Promise<string> {
    // Raw GitHub content URL — serves tagged registry files without path normalization
    const url = `${GITHUB_RAW_BASE}/${this.org}/${this.repo}/refs/tags/v${version}/registry/${assetPath}`

    const response = await fetchWithRetry(
      url,
      { headers: this.headers },
      this.options.maxRetries
    )

    if (response.status === 404) {
      throw new RegistryError(
        `Asset not found: ${assetPath} at version ${version}`,
        'Run `asdm sync --force` to re-download all assets'
      )
    }

    if (!response.ok) {
      throw new RegistryError(
        `Failed to download asset ${assetPath}: HTTP ${response.status}`
      )
    }

    return response.text()
  }

  /**
   * Check if the registry is accessible (for `asdm doctor`).
   */
  async ping(): Promise<boolean> {
    try {
      const url = `${GITHUB_API_BASE}/repos/${this.org}/${this.repo}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      let response: Response
      try {
        response = await fetch(url, { headers: this.headers, signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      return response.status === 200
    } catch {
      return false
    }
  }
}
