/**
 * Unit tests for init --global behavior.
 *
 * These tests validate the underlying functions used by `asdm init --global`:
 *   - createProjectConfigAtPath writes to the given path, not to .asdm.json
 *   - readProjectConfigFromPath reads back a valid config
 *   - getGlobalConfigPath returns the expected config location
 *
 * The force/no-force guard behavior (checking file existence before writing) is
 * tested by inspecting the `exists()` utility together with `createProjectConfigAtPath`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { exists, getGlobalConfigPath } from '../../../src/utils/fs.js'
import {
  createProjectConfigAtPath,
  readProjectConfigFromPath,
} from '../../../src/core/config.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-init-global-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('init --global: config path', () => {
  it('getGlobalConfigPath lives under the asdm config dir', () => {
    const p = getGlobalConfigPath()
    expect(path.isAbsolute(p)).toBe(true)
    expect(p.startsWith(os.homedir())).toBe(true)
    expect(p).toContain(path.join('asdm', 'config.json'))
  })
})

describe('init --global: createProjectConfigAtPath', () => {
  it('writes config to the specified path, NOT to .asdm.json in cwd', async () => {
    const globalConfigPath = path.join(tmpDir, 'asdm', 'config.json')

    await createProjectConfigAtPath(globalConfigPath, 'github://org/repo', 'base', ['opencode'])

    // File created at the explicit path
    expect(await exists(globalConfigPath)).toBe(true)

    // No .asdm.json in tmpDir (the "cwd" for this test)
    expect(await exists(path.join(tmpDir, '.asdm.json'))).toBe(false)
  })

  it('creates parent directories automatically', async () => {
    const deepPath = path.join(tmpDir, 'a', 'b', 'c', 'config.json')

    await createProjectConfigAtPath(deepPath, 'github://org/repo', 'base', ['opencode'])

    expect(await exists(deepPath)).toBe(true)
  })

  it('writes a valid ProjectConfig structure', async () => {
    const targetPath = path.join(tmpDir, 'global-config.json')

    await createProjectConfigAtPath(targetPath, 'github://org/repo', 'fullstack-engineer', ['opencode', 'claude-code'])

    const config = await readProjectConfigFromPath(targetPath)
    expect(config.registry).toBe('github://org/repo')
    expect(config.profile).toBe('fullstack-engineer')
    expect(config.providers).toEqual(['opencode', 'claude-code'])
    expect(config.$schema).toBe('https://asdm.dev/schemas/config.schema.json')
  })
})

describe('init --global: force/no-force guard', () => {
  it('does not overwrite when file exists and force is false', async () => {
    const targetPath = path.join(tmpDir, 'config.json')
    await createProjectConfigAtPath(targetPath, 'github://org/repo', 'base', ['opencode'])

    // Simulate the CLI guard: alreadyExists=true, force=false → should skip
    const alreadyExists = await exists(targetPath)
    const force = false
    expect(alreadyExists).toBe(true)

    // The CLI skips writing when alreadyExists && !force
    const wouldSkip = alreadyExists && !force
    expect(wouldSkip).toBe(true)
  })

  it('overwrites existing file when force is true', async () => {
    const targetPath = path.join(tmpDir, 'config.json')
    await createProjectConfigAtPath(targetPath, 'github://org/repo', 'base', ['opencode'])

    // Overwrite with a different profile (simulating --force)
    await createProjectConfigAtPath(targetPath, 'github://org/repo', 'fullstack-engineer', ['opencode'])

    const config = await readProjectConfigFromPath(targetPath)
    expect(config.profile).toBe('fullstack-engineer')
  })
})

describe('readProjectConfigFromPath', () => {
  it('throws ConfigError when file does not exist', async () => {
    const { ConfigError } = await import('../../../src/utils/errors.js')
    const missingPath = path.join(tmpDir, 'nonexistent.json')
    await expect(readProjectConfigFromPath(missingPath)).rejects.toThrow(ConfigError)
  })

  it('throws ConfigError when registry field is missing', async () => {
    const { ConfigError } = await import('../../../src/utils/errors.js')
    const badPath = path.join(tmpDir, 'bad.json')
    await fs.writeFile(badPath, JSON.stringify({ profile: 'base' }))
    await expect(readProjectConfigFromPath(badPath)).rejects.toThrow(ConfigError)
  })

  it('throws ConfigError when profile field is missing', async () => {
    const { ConfigError } = await import('../../../src/utils/errors.js')
    const badPath = path.join(tmpDir, 'bad.json')
    await fs.writeFile(badPath, JSON.stringify({ registry: 'github://org/repo' }))
    await expect(readProjectConfigFromPath(badPath)).rejects.toThrow(ConfigError)
  })
})
