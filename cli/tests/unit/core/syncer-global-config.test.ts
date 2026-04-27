/**
 * Tests for sync() configPath option.
 *
 * Verifies that when configPath is provided in SyncOptions, sync() reads the
 * config from that path instead of the default cwd/.asdm.json location.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { sync } from '../../../src/core/syncer.js'
import { ConfigError } from '../../../src/utils/errors.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-syncer-global-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('sync with configPath option', () => {
  it('throws ConfigError when configPath points to a missing file', async () => {
    const missingPath = path.join(tmpDir, 'nonexistent-config.json')

    // No config file exists — should throw ConfigError (not NetworkError or anything else)
    await expect(sync({ cwd: tmpDir, configPath: missingPath })).rejects.toThrow(ConfigError)
  })

  it('reads config from configPath when no local .asdm.json exists', async () => {
    // Create a valid config at a custom path (not the default .asdm.json location)
    const configPath = path.join(tmpDir, 'custom', 'my-config.json')
    await fs.mkdir(path.dirname(configPath), { recursive: true })
    await fs.writeFile(
      configPath,
      JSON.stringify({
        registry: 'github://org/repo',
        profile: 'base',
        providers: ['opencode'],
      })
    )

    // No .asdm.json in tmpDir — if sync reads from cwd it would throw ConfigError
    // If it reads from configPath it will fail later (registry unreachable) with a non-ConfigError
    const err = await sync({ cwd: tmpDir, configPath }).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(ConfigError)
  })

  it('throws ConfigError for invalid config JSON at configPath (missing registry)', async () => {
    const configPath = path.join(tmpDir, 'bad-config.json')
    await fs.writeFile(configPath, JSON.stringify({ profile: 'base' })) // missing registry

    await expect(sync({ cwd: tmpDir, configPath })).rejects.toThrow(ConfigError)
  })

  it('falls back to cwd/.asdm.json when configPath is not provided', async () => {
    // No .asdm.json in tmpDir and no configPath provided → ConfigError from default location
    await expect(sync({ cwd: tmpDir })).rejects.toThrow(ConfigError)
  })
})
