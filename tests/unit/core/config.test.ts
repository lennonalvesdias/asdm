import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  readProjectConfig,
  readUserConfig,
  writeUserConfig,
  resolveConfig,
  createProjectConfig,
  parseRegistryUrl,
} from '../../../src/core/config.js'
import { ConfigError, PolicyError } from '../../../src/utils/errors.js'

const POLICY = {
  allowed_profiles: ['base', 'fullstack-engineer', 'mobile', 'data-analytics'],
  allowed_providers: ['opencode', 'claude-code', 'copilot'],
  min_cli_version: '0.1.0',
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('parseRegistryUrl', () => {
  it('parses valid github:// URL', () => {
    const result = parseRegistryUrl('github://my-org/my-repo')
    expect(result).toEqual({ type: 'github', org: 'my-org', repo: 'my-repo' })
  })

  it('throws ConfigError for invalid URL', () => {
    expect(() => parseRegistryUrl('https://github.com/org/repo')).toThrow(ConfigError)
    expect(() => parseRegistryUrl('github://invalid')).toThrow(ConfigError)
  })

  it('parses valid file:// URL', () => {
    // Windows requires a drive letter; Unix-style paths (no drive) are invalid on Windows
    const testUrl = process.platform === 'win32'
      ? 'file:///C:/path/to/registry'
      : 'file:///path/to/registry'
    const result = parseRegistryUrl(testUrl)
    expect(result).toEqual({ type: 'file', path: fileURLToPath(testUrl) })
  })

  it('parses file:// URL with Windows-style path', () => {
    const result = parseRegistryUrl('file:///C:/Users/test/registry')
    expect(result).toEqual({ type: 'file', path: fileURLToPath('file:///C:/Users/test/registry') })
  })

  it('throws ConfigError for file:// URL with empty path', () => {
    expect(() => parseRegistryUrl('file://')).toThrow(ConfigError)
  })
})

describe('readProjectConfig', () => {
  it('reads valid .asdm.json', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.asdm.json'),
      JSON.stringify({ registry: 'github://org/repo', profile: 'fullstack-engineer' })
    )
    const config = await readProjectConfig(tmpDir)
    expect(config.registry).toBe('github://org/repo')
    expect(config.profile).toBe('fullstack-engineer')
  })

  it('throws ConfigError when file missing', async () => {
    await expect(readProjectConfig(tmpDir)).rejects.toThrow(ConfigError)
  })

  it('throws ConfigError when registry missing', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.asdm.json'),
      JSON.stringify({ profile: 'fullstack-engineer' })
    )
    await expect(readProjectConfig(tmpDir)).rejects.toThrow(ConfigError)
  })
})

describe('readUserConfig / writeUserConfig', () => {
  it('returns null when .asdm.local.json does not exist', async () => {
    const config = await readUserConfig(tmpDir)
    expect(config).toBeNull()
  })

  it('reads and writes user config', async () => {
    await writeUserConfig(tmpDir, { profile: 'mobile' })
    const config = await readUserConfig(tmpDir)
    expect(config?.profile).toBe('mobile')
  })
})

describe('resolveConfig', () => {
  const project = {
    registry: 'github://org/repo',
    profile: 'fullstack-engineer',
    providers: ['opencode' as const, 'claude-code' as const],
  }

  it('uses project profile when no user override', () => {
    const resolved = resolveConfig(project, null, POLICY)
    expect(resolved.profile).toBe('fullstack-engineer')
  })

  it('uses user profile override', () => {
    const resolved = resolveConfig(project, { profile: 'mobile' }, POLICY)
    expect(resolved.profile).toBe('mobile')
  })

  it('throws PolicyError for disallowed profile', () => {
    expect(() =>
      resolveConfig(project, { profile: 'super-admin' }, POLICY)
    ).toThrow(PolicyError)
  })

  it('throws PolicyError for disallowed provider', () => {
    const badProject = { ...project, providers: ['cursor' as any] }
    expect(() => resolveConfig(badProject, null, POLICY)).toThrow(PolicyError)
  })

  it('includes policy in resolved config', () => {
    const resolved = resolveConfig(project, null, POLICY)
    expect(resolved.policy).toBe(POLICY)
  })
})

describe('createProjectConfig', () => {
  it('creates valid .asdm.json', async () => {
    await createProjectConfig(tmpDir, 'github://org/repo', 'fullstack-engineer')
    const content = await fs.readFile(path.join(tmpDir, '.asdm.json'), 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.registry).toBe('github://org/repo')
    expect(parsed.profile).toBe('fullstack-engineer')
    expect(parsed.providers).toEqual(['opencode'])
  })
})
