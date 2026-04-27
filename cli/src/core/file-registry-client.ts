/**
 * File Registry Client
 *
 * Reads manifest and assets from a local filesystem path.
 * Supports file:///absolute/path registry URLs for offline/local development.
 */

import { readFile as nodeReadFile } from 'node:fs/promises'
import path from 'node:path'
import { exists } from '../utils/fs.js'
import { RegistryError } from '../utils/errors.js'
import { parseRegistryUrl } from './config.js'
import { RegistryClient } from './registry-client.js'
import type { AsdmManifest } from './manifest.js'

export class FileRegistryClient {
  constructor(private readonly registryPath: string) {}

  async getLatestManifest(): Promise<AsdmManifest> {
    const manifestPath = path.join(this.registryPath, 'latest.json')
    if (!(await exists(manifestPath))) {
      throw new RegistryError(
        `Manifest not found at: ${manifestPath}`,
        'Ensure the registry path contains a latest.json file'
      )
    }
    const content = await nodeReadFile(manifestPath, 'utf-8')
    return JSON.parse(content) as AsdmManifest
  }

  async downloadAsset(assetPath: string, _version: string): Promise<string> {
    const filePath = path.join(this.registryPath, assetPath)
    if (!(await exists(filePath))) {
      throw new RegistryError(
        `Asset not found at: ${filePath}`,
        `Ensure the file exists in your local registry: ${assetPath}`
      )
    }
    return nodeReadFile(filePath, 'utf-8')
  }

  async ping(): Promise<boolean> {
    return exists(path.join(this.registryPath, 'latest.json'))
  }
}

/**
 * Factory that constructs the appropriate registry client based on the URL scheme.
 *
 * - github://org/repo → RegistryClient (GitHub Releases)
 * - file:///path      → FileRegistryClient (local filesystem)
 */
export function createRegistryClient(registryUrl: string): RegistryClient | FileRegistryClient {
  const parsed = parseRegistryUrl(registryUrl)
  if (parsed.type === 'file') {
    return new FileRegistryClient(parsed.path)
  }
  return new RegistryClient(registryUrl)
}
