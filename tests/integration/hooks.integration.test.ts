/**
 * Integration tests for asdm hooks install / uninstall.
 *
 * These tests exercise the real filesystem using temp directories.
 * They call installHook / uninstallHook directly (exported from hooks.ts)
 * to validate that the correct files land in the correct locations with
 * the correct content for each mode.
 *
 * Scenarios:
 *   - Git mode (no Husky): hooks written to .git/hooks/
 *   - Husky v9+ mode:      hooks written to .husky/ with no shebang
 *   - Husky v8 mode:       hooks written to .husky/ with husky.sh source
 *   - --no-husky override: git mode even when Husky is detected
 *   - Uninstall:           removes hooks from the correct location
 *   - Uninstall both:      removes hooks from both locations if both exist
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { installHook, uninstallHook, resolveHookDefinition } from '../../src/cli/commands/hooks.js'
import { exists } from '../../src/utils/fs.js'
import type { HuskyInfo } from '../../src/utils/husky-detect.js'

// ── fixtures ──────────────────────────────────────────────────────────────────

const NO_HUSKY: HuskyInfo = { detected: false, version: null, huskyDir: null }
const HUSKY_V9: HuskyInfo = { detected: true, version: 'v9+', huskyDir: null }
const HUSKY_V8: HuskyInfo = { detected: true, version: 'v8', huskyDir: null }

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-hooks-integration-'))
  // Create .git/ structure so git-mode tests don't fail the "no .git" guard
  await fs.mkdir(path.join(tmpDir, '.git', 'hooks'), { recursive: true })
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ── resolveHookDefinition ─────────────────────────────────────────────────────

describe('resolveHookDefinition', () => {
  it('targets .git/hooks/ in git mode', () => {
    const def = resolveHookDefinition(tmpDir, 'pre-commit', NO_HUSKY, false)
    expect(def.relativePath).toBe('.git/hooks/pre-commit')
    expect(def.absolutePath).toBe(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))
  })

  it('targets .husky/ in husky v9+ mode', () => {
    const def = resolveHookDefinition(tmpDir, 'pre-commit', HUSKY_V9, false)
    expect(def.relativePath).toBe('.husky/pre-commit')
    expect(def.absolutePath).toBe(path.join(tmpDir, '.husky', 'pre-commit'))
  })

  it('targets .git/hooks/ when noHusky=true even if Husky detected', () => {
    const def = resolveHookDefinition(tmpDir, 'pre-commit', HUSKY_V9, true)
    expect(def.relativePath).toBe('.git/hooks/pre-commit')
  })

  it('includes shebang in git mode content', () => {
    const def = resolveHookDefinition(tmpDir, 'pre-commit', NO_HUSKY, false)
    expect(def.content).toContain('#!/usr/bin/env sh')
    expect(def.content).toContain('ASDM — managed pre-commit hook')
  })

  it('includes husky.sh source in v8 mode content', () => {
    const def = resolveHookDefinition(tmpDir, 'pre-commit', HUSKY_V8, false)
    expect(def.content).toContain('. "$(dirname -- "$0")/_/husky.sh"')
    expect(def.content).toContain('#!/usr/bin/env sh')
  })

  it('omits shebang in v9+ mode content', () => {
    const def = resolveHookDefinition(tmpDir, 'pre-commit', HUSKY_V9, false)
    expect(def.content).not.toContain('#!/usr/bin/env sh')
    expect(def.content).toContain('ASDM — managed pre-commit hook')
  })

  it('includes the ASDM marker for both hook types in all modes', () => {
    for (const hookType of ['pre-commit', 'post-merge'] as const) {
      for (const huskyInfo of [NO_HUSKY, HUSKY_V9, HUSKY_V8]) {
        const def = resolveHookDefinition(tmpDir, hookType, huskyInfo, false)
        expect(def.content).toContain(def.marker)
      }
    }
  })
})

// ── installHook — git mode ────────────────────────────────────────────────────

describe('installHook — git mode', () => {
  it('creates pre-commit in .git/hooks/', async () => {
    await installHook(tmpDir, 'pre-commit', NO_HUSKY, false)

    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit')
    expect(await exists(hookPath)).toBe(true)
  })

  it('pre-commit content has shebang and verify command', async () => {
    await installHook(tmpDir, 'pre-commit', NO_HUSKY, false)

    const content = await fs.readFile(
      path.join(tmpDir, '.git', 'hooks', 'pre-commit'),
      'utf-8',
    )
    expect(content).toContain('#!/usr/bin/env sh')
    expect(content).toContain('npx asdm verify --strict --quiet')
    expect(content).toContain('ASDM — managed pre-commit hook')
  })

  it('creates post-merge in .git/hooks/', async () => {
    await installHook(tmpDir, 'post-merge', NO_HUSKY, false)

    const content = await fs.readFile(
      path.join(tmpDir, '.git', 'hooks', 'post-merge'),
      'utf-8',
    )
    expect(content).toContain('#!/usr/bin/env sh')
    expect(content).toContain('ASDM MANAGED — post-merge hook')
  })

  it('is idempotent — second install is a no-op', async () => {
    await installHook(tmpDir, 'pre-commit', NO_HUSKY, false)
    const stat1 = await fs.stat(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))

    // Wait a tick to ensure mtime would differ if file were rewritten
    await new Promise(r => setTimeout(r, 10))
    await installHook(tmpDir, 'pre-commit', NO_HUSKY, false)
    const stat2 = await fs.stat(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))

    expect(stat1.mtimeMs).toBe(stat2.mtimeMs)
  })
})

// ── installHook — Husky v9+ mode ──────────────────────────────────────────────

describe('installHook — Husky v9+ mode', () => {
  it('creates pre-commit in .husky/', async () => {
    await installHook(tmpDir, 'pre-commit', HUSKY_V9, false)
    expect(await exists(path.join(tmpDir, '.husky', 'pre-commit'))).toBe(true)
  })

  it('does NOT write to .git/hooks/', async () => {
    await installHook(tmpDir, 'pre-commit', HUSKY_V9, false)
    expect(await exists(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(false)
  })

  it('hook content has no shebang (v9+ format)', async () => {
    await installHook(tmpDir, 'pre-commit', HUSKY_V9, false)

    const content = await fs.readFile(
      path.join(tmpDir, '.husky', 'pre-commit'),
      'utf-8',
    )
    expect(content).not.toContain('#!/usr/bin/env sh')
    expect(content).toContain('npx asdm verify --strict --quiet')
    expect(content).toContain('ASDM — managed pre-commit hook')
  })

  it('creates .husky/ directory automatically if absent', async () => {
    // Confirm .husky/ does not exist yet
    expect(await exists(path.join(tmpDir, '.husky'))).toBe(false)

    await installHook(tmpDir, 'pre-commit', HUSKY_V9, false)

    const stat = await fs.stat(path.join(tmpDir, '.husky'))
    expect(stat.isDirectory()).toBe(true)
  })
})

// ── installHook — Husky v8 mode ───────────────────────────────────────────────

describe('installHook — Husky v8 mode', () => {
  it('includes husky.sh source line in pre-commit', async () => {
    await installHook(tmpDir, 'pre-commit', HUSKY_V8, false)

    const content = await fs.readFile(
      path.join(tmpDir, '.husky', 'pre-commit'),
      'utf-8',
    )
    expect(content).toContain('#!/usr/bin/env sh')
    expect(content).toContain('. "$(dirname -- "$0")/_/husky.sh"')
    expect(content).toContain('npx asdm verify --strict --quiet')
  })
})

// ── installHook — --no-husky override ────────────────────────────────────────

describe('installHook — --no-husky override', () => {
  it('writes to .git/hooks/ even when HUSKY_V9 info is passed with noHusky=true', async () => {
    await installHook(tmpDir, 'pre-commit', HUSKY_V9, true)

    expect(await exists(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(true)
    expect(await exists(path.join(tmpDir, '.husky', 'pre-commit'))).toBe(false)
  })

  it('git-mode content (shebang) when noHusky=true', async () => {
    await installHook(tmpDir, 'pre-commit', HUSKY_V9, true)

    const content = await fs.readFile(
      path.join(tmpDir, '.git', 'hooks', 'pre-commit'),
      'utf-8',
    )
    expect(content).toContain('#!/usr/bin/env sh')
  })
})

// ── uninstallHook ─────────────────────────────────────────────────────────────

describe('uninstallHook', () => {
  it('removes ASDM-managed hook from .git/hooks/', async () => {
    await installHook(tmpDir, 'pre-commit', NO_HUSKY, false)
    expect(await exists(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(true)

    await uninstallHook(tmpDir, 'pre-commit')

    expect(await exists(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(false)
  })

  it('removes ASDM-managed hook from .husky/', async () => {
    await installHook(tmpDir, 'pre-commit', HUSKY_V9, false)
    expect(await exists(path.join(tmpDir, '.husky', 'pre-commit'))).toBe(true)

    await uninstallHook(tmpDir, 'pre-commit')

    expect(await exists(path.join(tmpDir, '.husky', 'pre-commit'))).toBe(false)
  })

  it('removes hooks from both .git/hooks/ and .husky/ when both exist', async () => {
    // Simulate leftover from a mode switch: install in git mode first,
    // then install in husky mode (different file, same hook type)
    await installHook(tmpDir, 'pre-commit', NO_HUSKY, false)
    await installHook(tmpDir, 'pre-commit', HUSKY_V9, false)

    await uninstallHook(tmpDir, 'pre-commit')

    expect(await exists(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(false)
    expect(await exists(path.join(tmpDir, '.husky', 'pre-commit'))).toBe(false)
  })

  it('is a no-op (does not throw) when no hook exists', async () => {
    await expect(uninstallHook(tmpDir, 'pre-commit')).resolves.toBeUndefined()
  })

  it('removes post-merge hook from .git/hooks/', async () => {
    await installHook(tmpDir, 'post-merge', NO_HUSKY, false)
    await uninstallHook(tmpDir, 'post-merge')

    expect(await exists(path.join(tmpDir, '.git', 'hooks', 'post-merge'))).toBe(false)
  })

  it('does not remove a hook that was not installed by ASDM', async () => {
    // Write a non-ASDM hook to .git/hooks/
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit')
    await fs.writeFile(hookPath, '#!/bin/sh\necho "custom hook"', 'utf-8')

    await uninstallHook(tmpDir, 'pre-commit')

    // File should still be there
    expect(await exists(hookPath)).toBe(true)
  })
})
