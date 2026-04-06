import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { FileRegistryClient, createRegistryClient } from '../../../src/core/file-registry-client.js'
import { RegistryClient } from '../../../src/core/registry-client.js'
import { RegistryError } from '../../../src/utils/errors.js'
import type { AsdmManifest } from '../../../src/core/manifest.js'

const MINIMAL_MANIFEST: AsdmManifest = {
  version: '1.0.0',
  policy: {
    allowed_profiles: ['base'],
    allowed_providers: ['opencode'],
  },
  profiles: {
    base: { agents: ['code-reviewer'], skills: [], commands: [] },
  },
  assets: {
    'agents/code-reviewer.asdm.md': {
      sha256: 'abc123',
      size: 100,
      version: '1.0.0',
    },
  },
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-file-reg-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('FileRegistryClient.getLatestManifest()', () => {
  it('reads and parses latest.json correctly', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'latest.json'),
      JSON.stringify(MINIMAL_MANIFEST),
      'utf-8'
    )
    const client = new FileRegistryClient(tmpDir)
    const manifest = await client.getLatestManifest()
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.policy.allowed_profiles).toEqual(['base'])
    expect(manifest.assets['agents/code-reviewer.asdm.md']?.sha256).toBe('abc123')
  })

  it('throws RegistryError when latest.json does not exist', async () => {
    const client = new FileRegistryClient(tmpDir)
    await expect(client.getLatestManifest()).rejects.toThrow(RegistryError)
  })
})

describe('FileRegistryClient.downloadAsset()', () => {
  it('reads file content from local path', async () => {
    const agentsDir = path.join(tmpDir, 'agents')
    await fs.mkdir(agentsDir, { recursive: true })
    await fs.writeFile(
      path.join(agentsDir, 'code-reviewer.asdm.md'),
      '# Code Reviewer\nAgent content here.',
      'utf-8'
    )
    const client = new FileRegistryClient(tmpDir)
    const content = await client.downloadAsset('agents/code-reviewer.asdm.md', '1.0.0')
    expect(content).toBe('# Code Reviewer\nAgent content here.')
  })

  it('throws RegistryError when asset file does not exist', async () => {
    const client = new FileRegistryClient(tmpDir)
    await expect(
      client.downloadAsset('agents/nonexistent.asdm.md', '1.0.0')
    ).rejects.toThrow(RegistryError)
  })

  it('ignores the version parameter (reads from local path regardless)', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'latest.json'),
      JSON.stringify(MINIMAL_MANIFEST),
      'utf-8'
    )
    const client = new FileRegistryClient(tmpDir)
    const content = await client.downloadAsset('latest.json', '9.9.9')
    expect(content).toContain('"version":"1.0.0"')
  })
})

describe('FileRegistryClient.ping()', () => {
  it('returns true when latest.json exists', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'latest.json'),
      JSON.stringify(MINIMAL_MANIFEST),
      'utf-8'
    )
    const client = new FileRegistryClient(tmpDir)
    expect(await client.ping()).toBe(true)
  })

  it('returns false when latest.json does not exist', async () => {
    const client = new FileRegistryClient(tmpDir)
    expect(await client.ping()).toBe(false)
  })
})

describe('createRegistryClient()', () => {
  it('returns FileRegistryClient for file:// URLs', () => {
    const client = createRegistryClient(`file://${tmpDir}`)
    expect(client).toBeInstanceOf(FileRegistryClient)
  })

  it('returns RegistryClient for github:// URLs', () => {
    const client = createRegistryClient('github://my-org/my-repo')
    expect(client).toBeInstanceOf(RegistryClient)
  })
})
