/**
 * Integration tests for sync() — full pipeline with mocked network.
 *
 * These tests call sync() directly against a real temp-directory filesystem
 * while stubbing global fetch to serve fixture data. This exercises the full
 * pipeline: config parsing → RegistryClient → SHA-256 verification →
 * adapter emit → lockfile write.
 *
 * Scenarios:
 *   - Successful first sync: lockfile + emitted files land on disk
 *   - dryRun mode: nothing written, stats still reported
 *   - noEmit mode: lockfile skipped, no provider files written
 *   - Integrity error: throws when downloaded SHA-256 mismatches manifest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { sync } from '../../src/core/syncer.js'
import { readLockfile } from '../../src/core/lockfile.js'
import { hashString } from '../../src/core/hash.js'
import { exists } from '../../src/utils/fs.js'
import { IntegrityError } from '../../src/utils/errors.js'
import type { AsdmManifest } from '../../src/core/manifest.js'

// ── Fixture data ──────────────────────────────────────────────────────────────

const AGENT_CONTENT = `---
name: code-reviewer
type: agent
description: "Reviews code for quality and security"
version: "1.0.0"
tags:
  - review
providers:
  opencode:
    model: claude-sonnet-4-5
    permissions: {}
    tools: []
---
# Code Reviewer

Review code for quality, security, and best practices.
`

function buildManifest(agentSha: string): AsdmManifest {
  return {
    version: '1.0.0',
    policy: {
      allowed_profiles: ['base'],
      allowed_providers: ['opencode'],
    },
    profiles: {
      base: {
        agents: ['code-reviewer'],
        skills: [],
        commands: [],
      },
    },
    assets: {
      'agents/code-reviewer.md': {
        sha256: agentSha,
        size: AGENT_CONTENT.length,
        version: '1.0.0',
      },
    },
  }
}

// ── Fetch stub helpers ────────────────────────────────────────────────────────

function makeResponse(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (_name: string) => null },
    json: () => Promise.resolve(JSON.parse(body) as unknown),
    text: () => Promise.resolve(body),
  }
}

function stubFetchWithManifest(manifest: AsdmManifest): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: unknown) => {
      const u = String(url)

      if (u.includes('api.github.com') && u.includes('releases/latest')) {
        return Promise.resolve(makeResponse(JSON.stringify({
          assets: [{
            name: 'manifest.json',
            url: 'https://api.github.com/repos/test-org/test-repo/releases/assets/1',
            browser_download_url: 'https://github.com/test-org/test-repo/releases/download/v1.0.0/manifest.json',
          }],
        })))
      }

      if (u.includes('releases/assets/')) {
        return Promise.resolve(makeResponse(JSON.stringify(manifest)))
      }

      if (u.includes('registry/agents/')) {
        return Promise.resolve(makeResponse(AGENT_CONTENT))
      }

      return Promise.resolve(makeResponse(JSON.stringify({ message: 'Not Found' }), 404))
    }),
  )
}

// ── Test setup ────────────────────────────────────────────────────────────────

let tmpDir: string
let originalXdgCache: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-sync-int-'))

  // Redirect cache writes into tmpDir to avoid polluting the real ASDM cache
  originalXdgCache = process.env['XDG_CACHE_HOME']
  process.env['XDG_CACHE_HOME'] = path.join(tmpDir, '.cache')

  // Write minimal .asdm.json
  await fs.writeFile(
    path.join(tmpDir, '.asdm.json'),
    JSON.stringify({
      registry: 'github://test-org/test-repo',
      profile: 'base',
      providers: ['opencode'],
    }),
    'utf-8',
  )

  // Default: serve a manifest with the correct SHA for AGENT_CONTENT
  stubFetchWithManifest(buildManifest(hashString(AGENT_CONTENT)))
})

afterEach(async () => {
  vi.unstubAllGlobals()

  if (originalXdgCache !== undefined) {
    process.env['XDG_CACHE_HOME'] = originalXdgCache
  } else {
    delete process.env['XDG_CACHE_HOME']
  }

  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ── Successful first sync ─────────────────────────────────────────────────────

describe('sync — successful first sync', () => {
  it('creates .asdm-lock.json', async () => {
    await sync({ cwd: tmpDir })

    expect(await exists(path.join(tmpDir, '.asdm-lock.json'))).toBe(true)
  })

  it('lockfile records manifest version and registry URL', async () => {
    await sync({ cwd: tmpDir })

    const lockfile = await readLockfile(tmpDir)
    expect(lockfile?.manifest_version).toBe('1.0.0')
    expect(lockfile?.registry).toBe('github://test-org/test-repo')
  })

  it('lockfile records the resolved profile', async () => {
    await sync({ cwd: tmpDir })

    const lockfile = await readLockfile(tmpDir)
    expect(lockfile?.profile).toBe('base')
  })

  it('emits agent file to .opencode/agents/', async () => {
    await sync({ cwd: tmpDir })

    expect(await exists(path.join(tmpDir, '.opencode', 'agents', 'code-reviewer.md'))).toBe(true)
  })

  it('emitted agent file contains the ASDM managed file header', async () => {
    await sync({ cwd: tmpDir })

    const content = await fs.readFile(
      path.join(tmpDir, '.opencode', 'agents', 'code-reviewer.md'),
      'utf-8',
    )
    expect(content).toContain('ASDM MANAGED FILE')
    expect(content).toContain('opencode')
  })

  it('emitted agent file contains the agent body from the source', async () => {
    await sync({ cwd: tmpDir })

    const content = await fs.readFile(
      path.join(tmpDir, '.opencode', 'agents', 'code-reviewer.md'),
      'utf-8',
    )
    expect(content).toContain('Code Reviewer')
    expect(content).toContain('Review code for quality')
  })

  it('stats report 1 file added on first sync', async () => {
    const result = await sync({ cwd: tmpDir })

    expect(result.stats.filesAdded).toBe(1)
    expect(result.stats.filesUpdated).toBe(0)
    expect(result.dryRun).toBe(false)
  })

  it('stats carry correct manifest version and profile name', async () => {
    const result = await sync({ cwd: tmpDir })

    expect(result.stats.manifestVersion).toBe('1.0.0')
    expect(result.stats.profile).toBe('base')
  })

  it('emittedFiles list is non-empty', async () => {
    const result = await sync({ cwd: tmpDir })

    expect(result.emittedFiles.length).toBeGreaterThan(0)
  })

  it('every emittedFile has a non-empty sha256', async () => {
    const result = await sync({ cwd: tmpDir })

    for (const f of result.emittedFiles) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

// ── dryRun mode ───────────────────────────────────────────────────────────────

describe('sync — dryRun mode', () => {
  it('returns dryRun=true in the result', async () => {
    const result = await sync({ cwd: tmpDir, dryRun: true })

    expect(result.dryRun).toBe(true)
  })

  it('writes no lockfile to disk', async () => {
    await sync({ cwd: tmpDir, dryRun: true })

    expect(await exists(path.join(tmpDir, '.asdm-lock.json'))).toBe(false)
  })

  it('writes no provider files to disk', async () => {
    await sync({ cwd: tmpDir, dryRun: true })

    expect(await exists(path.join(tmpDir, '.opencode', 'agents', 'code-reviewer.md'))).toBe(false)
  })

  it('still reports correct stats in dryRun mode', async () => {
    const result = await sync({ cwd: tmpDir, dryRun: true })

    expect(result.stats.filesAdded).toBe(1)
    expect(result.stats.manifestVersion).toBe('1.0.0')
  })
})

// ── noEmit mode ───────────────────────────────────────────────────────────────

describe('sync — noEmit mode', () => {
  it('returns an empty emittedFiles array', async () => {
    const result = await sync({ cwd: tmpDir, noEmit: true })

    expect(result.emittedFiles).toHaveLength(0)
  })

  it('writes no provider files to disk', async () => {
    await sync({ cwd: tmpDir, noEmit: true })

    expect(await exists(path.join(tmpDir, '.opencode', 'agents', 'code-reviewer.md'))).toBe(false)
  })
})

// ── Integrity error ───────────────────────────────────────────────────────────

describe('sync — SHA-256 integrity error', () => {
  it('throws IntegrityError when downloaded asset SHA does not match manifest', async () => {
    // Replace the default stub with one whose manifest lists the wrong SHA
    vi.unstubAllGlobals()
    const corruptManifest = buildManifest(
      '0000000000000000000000000000000000000000000000000000000000000000',
    )
    stubFetchWithManifest(corruptManifest)

    await expect(sync({ cwd: tmpDir })).rejects.toThrow(IntegrityError)
  })
})
