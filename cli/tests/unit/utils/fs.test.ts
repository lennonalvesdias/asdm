import { describe, it, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { resolveGlobalEmitPath, getGlobalLockfilePath, getGlobalConfigPath } from '../../../src/utils/fs.js'

describe('resolveGlobalEmitPath', () => {
  it('resolves opencode agent path', () => {
    const result = resolveGlobalEmitPath('.opencode/agents/foo.md', 'opencode')
    expect(result).not.toBeNull()
    expect(result).toContain('agents' + path.sep + 'foo.md')
  })

  it('resolves claude-code agent path', () => {
    const result = resolveGlobalEmitPath('.claude/agents/bar.md', 'claude-code')
    expect(result).not.toBeNull()
    expect(result).toContain('agents' + path.sep + 'bar.md')
  })

  it('resolves copilot agent path', () => {
    const result = resolveGlobalEmitPath('.github/instructions/baz.md', 'copilot')
    expect(result).not.toBeNull()
    expect(result).toContain('instructions' + path.sep + 'baz.md')
  })

  it('returns null for project-root files (no provider prefix)', () => {
    expect(resolveGlobalEmitPath('AGENTS.md', 'opencode')).toBeNull()
  })

  it('returns null for CLAUDE.md project-root file', () => {
    expect(resolveGlobalEmitPath('CLAUDE.md', 'claude-code')).toBeNull()
  })

  it('returns null for unknown provider', () => {
    expect(resolveGlobalEmitPath('.opencode/agents/foo.md', 'unknown')).toBeNull()
  })

  it('returns null when provider prefix does not match path', () => {
    // copilot path passed with opencode provider → prefix mismatch
    expect(resolveGlobalEmitPath('.github/instructions/foo.md', 'opencode')).toBeNull()
  })

  it('places opencode files inside the opencode global dir', () => {
    const result = resolveGlobalEmitPath('.opencode/agents/foo.md', 'opencode')!
    const expected = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'opencode')
      : path.join(os.homedir(), '.config', 'opencode')
    expect(result.startsWith(expected)).toBe(true)
  })
})

describe('getGlobalLockfilePath', () => {
  it('returns a path inside the asdm config dir', () => {
    const p = getGlobalLockfilePath()
    expect(p).toContain('asdm')
    expect(p).toContain('global-lock.json')
  })

  it('is an absolute path', () => {
    const p = getGlobalLockfilePath()
    expect(path.isAbsolute(p)).toBe(true)
  })

  it('lives under the user home directory', () => {
    const p = getGlobalLockfilePath()
    expect(p.startsWith(os.homedir())).toBe(true)
  })
})

describe('getGlobalConfigPath', () => {
  it('returns a path ending with config.json inside the asdm dir', () => {
    const p = getGlobalConfigPath()
    expect(p).toContain('asdm')
    expect(p).toContain('config.json')
    expect(p).toContain(path.join('asdm', 'config.json'))
  })

  it('is an absolute path', () => {
    const p = getGlobalConfigPath()
    expect(path.isAbsolute(p)).toBe(true)
  })

  it('lives under the user home directory', () => {
    const p = getGlobalConfigPath()
    expect(p.startsWith(os.homedir())).toBe(true)
  })

  it('is different from the global lockfile path', () => {
    const configPath = getGlobalConfigPath()
    const lockfilePath = getGlobalLockfilePath()
    expect(configPath).not.toBe(lockfilePath)
  })
})
