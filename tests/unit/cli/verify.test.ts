/**
 * Unit tests for the fetchLatestManifestVersion helper in the verify command.
 *
 * Tests that:
 *   - Returns the manifest version when RegistryClient succeeds
 *   - Returns undefined when readProjectConfig throws (no .asdm.json)
 *   - Returns undefined when getLatestManifest throws (network error)
 *   - Returns undefined when getLatestManifest rejects with any error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── Mocks must be declared before the module under test is imported ──────────

vi.mock('../../../src/core/registry-client.js', () => {
  const MockRegistryClient = vi.fn()
  MockRegistryClient.prototype.getLatestManifest = vi.fn()
  return { RegistryClient: MockRegistryClient }
})

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>()
  return {
    ...actual,
    readProjectConfig: vi.fn(),
  }
})

// ── Deferred imports so mocks are installed first ────────────────────────────

const { fetchLatestManifestVersion } = await import('../../../src/cli/commands/verify.js')
const { RegistryClient } = await import('../../../src/core/registry-client.js')
const { readProjectConfig } = await import('../../../src/core/config.js')

const mockReadProjectConfig = vi.mocked(readProjectConfig)
const MockRegistryClientClass = vi.mocked(RegistryClient)

// ── Test suite ────────────────────────────────────────────────────────────────

describe('fetchLatestManifestVersion', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-verify-cli-test-'))
    vi.clearAllMocks()
  })

  it('returns the manifest version when registry responds successfully', async () => {
    mockReadProjectConfig.mockResolvedValue({
      registry: 'github://org/repo',
      profile: 'base',
      providers: ['opencode'],
    })

    MockRegistryClientClass.prototype.getLatestManifest = vi.fn().mockResolvedValue({
      version: '2.5.0',
      policy: { allowed_profiles: ['base'], allowed_providers: ['opencode'] },
      profiles: {},
      assets: {},
    })

    const version = await fetchLatestManifestVersion(tmpDir)
    expect(version).toBe('2.5.0')
  })

  it('returns undefined when readProjectConfig throws (no .asdm.json)', async () => {
    const { ConfigError } = await import('../../../src/utils/errors.js')
    mockReadProjectConfig.mockRejectedValue(
      new ConfigError('No .asdm.json found', 'Run `asdm init`'),
    )

    const version = await fetchLatestManifestVersion(tmpDir)
    expect(version).toBeUndefined()
  })

  it('returns undefined when getLatestManifest throws a network error', async () => {
    mockReadProjectConfig.mockResolvedValue({
      registry: 'github://org/repo',
      profile: 'base',
      providers: ['opencode'],
    })

    const { NetworkError } = await import('../../../src/utils/errors.js')
    MockRegistryClientClass.prototype.getLatestManifest = vi.fn().mockRejectedValue(
      new NetworkError('Request failed', 'Check your connection'),
    )

    const version = await fetchLatestManifestVersion(tmpDir)
    expect(version).toBeUndefined()
  })

  it('returns undefined when getLatestManifest rejects with an unknown error', async () => {
    mockReadProjectConfig.mockResolvedValue({
      registry: 'github://org/repo',
      profile: 'base',
      providers: ['opencode'],
    })

    MockRegistryClientClass.prototype.getLatestManifest = vi.fn().mockRejectedValue(
      new Error('Unexpected error'),
    )

    const version = await fetchLatestManifestVersion(tmpDir)
    expect(version).toBeUndefined()
  })

  it('constructs RegistryClient with the registry URL from config', async () => {
    mockReadProjectConfig.mockResolvedValue({
      registry: 'github://myorg/myrepo',
      profile: 'base',
      providers: ['opencode'],
    })

    MockRegistryClientClass.prototype.getLatestManifest = vi.fn().mockResolvedValue({
      version: '3.0.0',
      policy: { allowed_profiles: ['base'], allowed_providers: ['opencode'] },
      profiles: {},
      assets: {},
    })

    await fetchLatestManifestVersion(tmpDir)
    expect(MockRegistryClientClass).toHaveBeenCalledWith('github://myorg/myrepo')
  })
})
