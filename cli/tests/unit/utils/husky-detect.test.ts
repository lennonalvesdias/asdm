/**
 * Unit tests for src/utils/husky-detect.ts
 *
 * Verifies detection logic across all relevant filesystem states:
 *   - No package.json
 *   - package.json without husky
 *   - package.json with husky in devDependencies (v8 and v9+)
 *   - package.json with husky in dependencies
 *   - Only .husky/ dir present (no package.json entry)
 *   - .husky/ dir + .husky/_/husky.sh (v8 fingerprint)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { detectHusky } from '../../../src/utils/husky-detect.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-husky-detect-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ── helpers ───────────────────────────────────────────────────────────────────

async function writePackageJson(content: Record<string, unknown>): Promise<void> {
  await fs.writeFile(
    path.join(tmpDir, 'package.json'),
    JSON.stringify(content),
    'utf-8',
  )
}

async function createHuskyDir(withHushSh = false): Promise<void> {
  const huskyDir = path.join(tmpDir, '.husky')
  await fs.mkdir(huskyDir, { recursive: true })
  if (withHushSh) {
    await fs.mkdir(path.join(huskyDir, '_'), { recursive: true })
    await fs.writeFile(path.join(huskyDir, '_', 'husky.sh'), '# husky', 'utf-8')
  }
}

// ── not detected ──────────────────────────────────────────────────────────────

describe('detectHusky — not detected', () => {
  it('returns not-detected when no package.json and no .husky/ dir', async () => {
    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(false)
    expect(result.version).toBeNull()
    expect(result.huskyDir).toBeNull()
  })

  it('returns not-detected when package.json has no husky entry', async () => {
    await writePackageJson({
      name: 'my-project',
      devDependencies: { typescript: '^5.0.0' },
    })

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(false)
    expect(result.version).toBeNull()
    expect(result.huskyDir).toBeNull()
  })

  it('returns not-detected for an empty package.json', async () => {
    await writePackageJson({})

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(false)
  })
})

// ── detected via package.json ─────────────────────────────────────────────────

describe('detectHusky — package.json devDependencies', () => {
  it('detects v8 from ^8.0.0 in devDependencies', async () => {
    await writePackageJson({ devDependencies: { husky: '^8.0.0' } })

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.version).toBe('v8')
  })

  it('detects v8 from ^8.4.1 in devDependencies', async () => {
    await writePackageJson({ devDependencies: { husky: '^8.4.1' } })

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.version).toBe('v8')
  })

  it('detects v9+ from ^9.0.0 in devDependencies', async () => {
    await writePackageJson({ devDependencies: { husky: '^9.0.0' } })

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.version).toBe('v9+')
  })

  it('detects v9+ from ^9.1.0 in devDependencies', async () => {
    await writePackageJson({ devDependencies: { husky: '^9.1.0' } })

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.version).toBe('v9+')
  })

  it('detects v9+ from a future major (e.g. ^10.0.0)', async () => {
    await writePackageJson({ devDependencies: { husky: '^10.0.0' } })

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.version).toBe('v9+')
  })
})

describe('detectHusky — package.json dependencies (not devDependencies)', () => {
  it('detects husky in dependencies (not devDependencies)', async () => {
    await writePackageJson({ dependencies: { husky: '^9.0.0' } })

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.version).toBe('v9+')
  })

  it('prefers devDependencies over dependencies when both present', async () => {
    await writePackageJson({
      devDependencies: { husky: '^8.0.0' },
      dependencies: { husky: '^9.0.0' },
    })

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    // devDependencies wins — version is v8
    expect(result.version).toBe('v8')
  })
})

describe('detectHusky — huskyDir field', () => {
  it('sets huskyDir when .husky/ directory exists alongside package.json entry', async () => {
    await writePackageJson({ devDependencies: { husky: '^9.0.0' } })
    await createHuskyDir()

    const result = await detectHusky(tmpDir)

    expect(result.huskyDir).not.toBeNull()
    expect(result.huskyDir).toBe(path.join(tmpDir, '.husky'))
  })

  it('sets huskyDir to null when .husky/ is absent even though package.json has husky', async () => {
    await writePackageJson({ devDependencies: { husky: '^9.0.0' } })
    // No .husky/ dir created

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.huskyDir).toBeNull()
  })
})

// ── detected via .husky/ dir only ─────────────────────────────────────────────

describe('detectHusky — .husky/ dir without package.json entry', () => {
  it('detects v9+ when only .husky/ dir exists (no _/husky.sh)', async () => {
    await createHuskyDir(false)

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.version).toBe('v9+')
    expect(result.huskyDir).toBe(path.join(tmpDir, '.husky'))
  })

  it('detects v8 when .husky/ dir exists with _/husky.sh (v8 fingerprint)', async () => {
    await createHuskyDir(true)

    const result = await detectHusky(tmpDir)

    expect(result.detected).toBe(true)
    expect(result.version).toBe('v8')
  })

  it('returns huskyDir path when detected via directory', async () => {
    await createHuskyDir()

    const result = await detectHusky(tmpDir)

    expect(result.huskyDir).toBe(path.join(tmpDir, '.husky'))
  })
})
