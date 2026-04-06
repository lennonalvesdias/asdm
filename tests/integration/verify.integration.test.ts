/**
 * Integration tests for verify() — end-to-end flow after a real sync.
 *
 * These tests differ from the unit tests in tests/unit/core/verifier.test.ts
 * in that the pre-sync state is established by calling sync() with a stubbed
 * network, not by manually writing a lockfile. This validates that the lockfile
 * produced by sync() is fully compatible with what verify() expects.
 *
 * Scenarios:
 *   - NO_LOCK: verify before any sync
 *   - OK: verify after a clean sync
 *   - OUTDATED: verify when a newer manifest version is available
 *   - MODIFIED: verify after tampering with an emitted file
 *   - MODIFIED (missing): verify after deleting an emitted file
 *   - verifyStrict: passes after clean sync, throws after modification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { sync } from '../../src/core/syncer.js'
import { verify, verifyStrict, VERIFY_EXIT_CODES } from '../../src/core/verifier.js'
import { hashString } from '../../src/core/hash.js'
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

function buildManifest(): AsdmManifest {
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
      'agents/code-reviewer.asdm.md': {
        sha256: hashString(AGENT_CONTENT),
        size: AGENT_CONTENT.length,
        version: '1.0.0',
      },
    },
  }
}

// ── Fetch stub ────────────────────────────────────────────────────────────────

function makeResponse(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (_name: string) => null },
    json: () => Promise.resolve(JSON.parse(body) as unknown),
    text: () => Promise.resolve(body),
  }
}

function stubFetch(): void {
  const manifest = buildManifest()
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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-verify-int-'))

  originalXdgCache = process.env['XDG_CACHE_HOME']
  process.env['XDG_CACHE_HOME'] = path.join(tmpDir, '.cache')

  await fs.writeFile(
    path.join(tmpDir, '.asdm.json'),
    JSON.stringify({
      registry: 'github://test-org/test-repo',
      profile: 'base',
      providers: ['opencode'],
    }),
    'utf-8',
  )

  stubFetch()
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

// ── Helper ────────────────────────────────────────────────────────────────────

async function runSync(): Promise<void> {
  await sync({ cwd: tmpDir })
}

const AGENT_PATH = '.opencode/agents/code-reviewer.md'

// ── Before any sync ───────────────────────────────────────────────────────────

describe('verify — before sync', () => {
  it('returns NO_LOCK when no lockfile exists', async () => {
    const result = await verify(tmpDir)

    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.NO_LOCK)
    expect(result.checkedFiles).toBe(0)
    expect(result.violations).toHaveLength(0)
  })
})

// ── After clean sync ──────────────────────────────────────────────────────────

describe('verify — after clean sync', () => {
  it('returns OK when all managed files are intact', async () => {
    await runSync()

    const result = await verify(tmpDir)

    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.OK)
    expect(result.violations).toHaveLength(0)
  })

  it('reports the number of checked files', async () => {
    await runSync()

    const result = await verify(tmpDir)

    // Sync emits at minimum: agent file + AGENTS.md + opencode.jsonc
    expect(result.checkedFiles).toBeGreaterThan(0)
  })

  it('reports the current manifest version from the lockfile', async () => {
    await runSync()

    const result = await verify(tmpDir)

    expect(result.currentManifestVersion).toBe('1.0.0')
  })

  it('returns OUTDATED when a newer manifest version is available', async () => {
    await runSync()

    const result = await verify(tmpDir, '2.0.0')

    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.OUTDATED)
    expect(result.currentManifestVersion).toBe('1.0.0')
    expect(result.latestManifestVersion).toBe('2.0.0')
  })

  it('returns OK (not OUTDATED) when the manifest version matches the lockfile', async () => {
    await runSync()

    const result = await verify(tmpDir, '1.0.0')

    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.OK)
  })
})

// ── After file tampering ──────────────────────────────────────────────────────

describe('verify — after file modification', () => {
  it('returns MODIFIED when a managed agent file has been tampered with', async () => {
    await runSync()

    await fs.writeFile(
      path.join(tmpDir, AGENT_PATH),
      '# TAMPERED CONTENT — this is not what asdm wrote',
      'utf-8',
    )

    const result = await verify(tmpDir)

    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.MODIFIED)
    expect(result.violations).toHaveLength(1)

    const violation = result.violations[0]
    expect(violation?.filePath).toBe(AGENT_PATH)
    expect(violation?.type).toBe('modified')
    expect(violation?.expected).toBeDefined()
    expect(violation?.actual).toBeDefined()
  })

  it('returns MODIFIED (missing) when a managed file has been deleted', async () => {
    await runSync()

    await fs.unlink(path.join(tmpDir, AGENT_PATH))

    const result = await verify(tmpDir)

    expect(result.exitCode).toBe(VERIFY_EXIT_CODES.MODIFIED)
    expect(result.violations).toHaveLength(1)

    const violation = result.violations[0]
    expect(violation?.filePath).toBe(AGENT_PATH)
    expect(violation?.type).toBe('missing')
  })

  it('unmodified files are not reported as violations', async () => {
    await runSync()

    // Only tamper with the agent file
    await fs.writeFile(path.join(tmpDir, AGENT_PATH), '# tampered', 'utf-8')

    const result = await verify(tmpDir)

    // Violations should reference only the modified file
    for (const violation of result.violations) {
      expect(violation.filePath).toBe(AGENT_PATH)
    }
  })
})

// ── verifyStrict ──────────────────────────────────────────────────────────────

describe('verifyStrict — after clean sync', () => {
  it('resolves without throwing when all managed files are intact', async () => {
    await runSync()

    await expect(verifyStrict(tmpDir)).resolves.toBeUndefined()
  })

  it('throws IntegrityError when a managed file has been modified', async () => {
    await runSync()

    await fs.writeFile(path.join(tmpDir, AGENT_PATH), '# TAMPERED', 'utf-8')

    await expect(verifyStrict(tmpDir)).rejects.toThrow(IntegrityError)
  })

  it('throws IntegrityError when no lockfile exists', async () => {
    // No sync performed — no lockfile present
    await expect(verifyStrict(tmpDir)).rejects.toThrow(IntegrityError)
  })
})
