import { describe, it, expect } from 'vitest'
import { diffManifest, getProfileAssetPaths, validateManifest } from '../../../src/core/manifest.js'
import type { AsdmManifest } from '../../../src/core/manifest.js'

const MANIFEST: AsdmManifest = {
  version: '1.0.0',
  policy: {
    allowed_profiles: ['base', 'fullstack-engineer'],
    allowed_providers: ['opencode', 'claude-code', 'copilot'],
    min_cli_version: '0.1.0',
  },
  profiles: {
    base: { agents: ['code-reviewer'] },
    'fullstack-engineer': { extends: ['base'], agents: ['tdd-guide'] },
  },
  assets: {
    'agents/code-reviewer.asdm.md': { sha256: 'abc123' + 'a'.repeat(58), size: 1000, version: '1.0.0' },
    'agents/tdd-guide.asdm.md': { sha256: 'def456' + 'b'.repeat(58), size: 1200, version: '1.0.0' },
    'skills/react-best-practices/SKILL.asdm.md': { sha256: 'ghi789' + 'c'.repeat(58), size: 800, version: '1.0.0' },
  },
}

describe('diffManifest', () => {
  it('marks all as added when no local files', () => {
    const diff = diffManifest(MANIFEST, {}, ['agents/code-reviewer.asdm.md', 'agents/tdd-guide.asdm.md'])
    expect(diff.added).toContain('agents/code-reviewer.asdm.md')
    expect(diff.added).toContain('agents/tdd-guide.asdm.md')
    expect(diff.updated).toHaveLength(0)
    expect(diff.unchanged).toHaveLength(0)
  })

  it('marks as unchanged when sha matches', () => {
    const localShas = {
      'agents/code-reviewer.asdm.md': 'abc123' + 'a'.repeat(58),
    }
    const diff = diffManifest(MANIFEST, localShas, ['agents/code-reviewer.asdm.md'])
    expect(diff.unchanged).toContain('agents/code-reviewer.asdm.md')
    expect(diff.added).toHaveLength(0)
    expect(diff.updated).toHaveLength(0)
  })

  it('marks as updated when sha differs', () => {
    const localShas = {
      'agents/code-reviewer.asdm.md': 'old-sha-' + '0'.repeat(56),
    }
    const diff = diffManifest(MANIFEST, localShas, ['agents/code-reviewer.asdm.md'])
    expect(diff.updated).toContain('agents/code-reviewer.asdm.md')
  })
})

describe('getProfileAssetPaths', () => {
  it('returns paths for agents', () => {
    const paths = getProfileAssetPaths(MANIFEST, ['code-reviewer', 'tdd-guide'], [], [])
    expect(paths).toContain('agents/code-reviewer.asdm.md')
    expect(paths).toContain('agents/tdd-guide.asdm.md')
  })

  it('returns paths for skills', () => {
    const paths = getProfileAssetPaths(MANIFEST, [], ['react-best-practices'], [])
    expect(paths).toContain('skills/react-best-practices/SKILL.asdm.md')
  })

  it('skips assets not in manifest', () => {
    const paths = getProfileAssetPaths(MANIFEST, ['nonexistent-agent'], [], [])
    expect(paths).toHaveLength(0)
  })
})

describe('validateManifest', () => {
  it('returns true for valid manifest', () => {
    expect(validateManifest(MANIFEST)).toBe(true)
  })

  it('returns false for null', () => {
    expect(validateManifest(null)).toBe(false)
  })

  it('returns false for missing required fields', () => {
    expect(validateManifest({ version: '1.0.0' })).toBe(false)
  })
})
