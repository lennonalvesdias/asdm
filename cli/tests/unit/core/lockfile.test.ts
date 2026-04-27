import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  readLockfile,
  writeLockfile,
  lockfileExists,
  diffLockfiles,
  buildLockfile,
  createLockEntry,
} from '../../../src/core/lockfile.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-lock-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

const SAMPLE_ENTRY = createLockEntry(
  'a'.repeat(64),
  'agents/code-reviewer.md',
  'opencode',
  '1.0.0'
)

describe('readLockfile / writeLockfile', () => {
  it('returns null when lockfile does not exist', async () => {
    const lock = await readLockfile(tmpDir)
    expect(lock).toBeNull()
  })

  it('round-trips lockfile data', async () => {
    const lockfile = buildLockfile({
      cliVersion: '0.1.0',
      manifestVersion: '1.0.0',
      registry: 'github://org/repo',
      profile: 'fullstack-engineer',
      resolvedProfiles: ['base', 'fullstack-engineer'],
      files: { '.opencode/agents/code-reviewer.md': SAMPLE_ENTRY },
    })

    await writeLockfile(tmpDir, lockfile)
    const read = await readLockfile(tmpDir)

    expect(read?.manifest_version).toBe('1.0.0')
    expect(read?.profile).toBe('fullstack-engineer')
    expect(read?.files['.opencode/agents/code-reviewer.md']?.sha256).toBe('a'.repeat(64))
  })
})

describe('lockfileExists', () => {
  it('returns false when missing', async () => {
    expect(await lockfileExists(tmpDir)).toBe(false)
  })

  it('returns true after writing', async () => {
    const lockfile = buildLockfile({
      cliVersion: '0.1.0',
      manifestVersion: '1.0.0',
      registry: 'github://org/repo',
      profile: 'base',
      resolvedProfiles: ['base'],
      files: {},
    })
    await writeLockfile(tmpDir, lockfile)
    expect(await lockfileExists(tmpDir)).toBe(true)
  })
})

describe('diffLockfiles', () => {
  it('marks all as added when no current lockfile', () => {
    const diff = diffLockfiles(null, {
      '.opencode/agents/code-reviewer.md': SAMPLE_ENTRY,
    })
    expect(diff.added).toContain('.opencode/agents/code-reviewer.md')
    expect(diff.updated).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
  })

  it('marks as unchanged when sha matches', () => {
    const current = buildLockfile({
      cliVersion: '0.1.0',
      manifestVersion: '1.0.0',
      registry: 'github://org/repo',
      profile: 'base',
      resolvedProfiles: ['base'],
      files: { '.opencode/agents/code-reviewer.md': SAMPLE_ENTRY },
    })
    const diff = diffLockfiles(current, { '.opencode/agents/code-reviewer.md': SAMPLE_ENTRY })
    expect(diff.unchanged).toContain('.opencode/agents/code-reviewer.md')
  })

  it('marks as removed when not in incoming', () => {
    const current = buildLockfile({
      cliVersion: '0.1.0',
      manifestVersion: '1.0.0',
      registry: 'github://org/repo',
      profile: 'base',
      resolvedProfiles: ['base'],
      files: { '.opencode/agents/old-agent.md': SAMPLE_ENTRY },
    })
    const diff = diffLockfiles(current, {})
    expect(diff.removed).toContain('.opencode/agents/old-agent.md')
  })
})
