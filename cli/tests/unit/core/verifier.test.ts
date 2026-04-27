import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { verify, VERIFY_EXIT_CODES, verifyStrict } from '../../../src/core/verifier.js'
import { writeLockfile, buildLockfile, createLockEntry } from '../../../src/core/lockfile.js'
import { hashString } from '../../../src/core/hash.js'
import { IntegrityError } from '../../../src/utils/errors.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-verify-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

async function createManagedFile(relativePath: string, content: string): Promise<string> {
  const absolutePath = path.join(tmpDir, relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, content, 'utf-8')
  return hashString(content)
}

async function setupLockfile(files: Record<string, { content: string; source?: string }>) {
  const lockFiles: Record<string, ReturnType<typeof createLockEntry>> = {}
  
  for (const [relPath, { content, source }] of Object.entries(files)) {
    const sha256 = await createManagedFile(relPath, content)
    lockFiles[relPath] = createLockEntry(sha256, source ?? 'agents/test.md', 'opencode', '1.0.0')
  }
  
  await writeLockfile(tmpDir, buildLockfile({
    cliVersion: '0.1.0',
    manifestVersion: '1.0.0',
    registry: 'github://org/repo',
    profile: 'fullstack-engineer',
    resolvedProfiles: ['base', 'fullstack-engineer'],
    files: lockFiles,
  }))
}

describe('verify', () => {
  it('returns NO_LOCK when lockfile missing', async () => {
    const result = await verify(tmpDir)
    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.NO_LOCK)
    expect(result.checkedFiles).toBe(0)
  })

  it('returns OK when all files are intact', async () => {
    await setupLockfile({
      '.opencode/agents/code-reviewer.md': { content: '# Code Reviewer\n\nInstructions here.' },
    })
    const result = await verify(tmpDir)
    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.OK)
    expect(result.violations).toHaveLength(0)
    expect(result.checkedFiles).toBe(1)
  })

  it('detects modified files', async () => {
    await setupLockfile({
      '.opencode/agents/code-reviewer.md': { content: '# Original content' },
    })
    
    // Modify the file
    await fs.writeFile(
      path.join(tmpDir, '.opencode/agents/code-reviewer.md'),
      '# TAMPERED content',
      'utf-8'
    )
    
    const result = await verify(tmpDir)
    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.MODIFIED)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]?.type).toBe('modified')
    expect(result.violations[0]?.filePath).toBe('.opencode/agents/code-reviewer.md')
  })

  it('detects missing files', async () => {
    await setupLockfile({
      '.opencode/agents/code-reviewer.md': { content: '# Agent content' },
    })
    
    // Delete the file
    await fs.unlink(path.join(tmpDir, '.opencode/agents/code-reviewer.md'))
    
    const result = await verify(tmpDir)
    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.MODIFIED)
    expect(result.violations[0]?.type).toBe('missing')
  })

  it('returns OUTDATED when new manifest version available', async () => {
    await setupLockfile({
      '.opencode/agents/code-reviewer.md': { content: '# Content' },
    })
    
    const result = await verify(tmpDir, '2.0.0')
    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.OUTDATED)
    expect(result.latestManifestVersion).toBe('2.0.0')
  })
})

describe('verifyStrict', () => {
  it('passes without throwing when all files intact', async () => {
    await setupLockfile({
      '.opencode/agents/code-reviewer.md': { content: '# Content' },
    })
    await expect(verifyStrict(tmpDir)).resolves.toBeUndefined()
  })

  it('throws IntegrityError on modification', async () => {
    await setupLockfile({
      '.opencode/agents/code-reviewer.md': { content: '# Original' },
    })
    await fs.writeFile(
      path.join(tmpDir, '.opencode/agents/code-reviewer.md'),
      '# TAMPERED',
      'utf-8'
    )
    await expect(verifyStrict(tmpDir)).rejects.toThrow(IntegrityError)
  })

  it('throws IntegrityError when no lockfile', async () => {
    await expect(verifyStrict(tmpDir)).rejects.toThrow(IntegrityError)
  })
})
