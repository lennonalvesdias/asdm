import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readOverlays, applyOverlay, type Overlay } from '../../../src/core/overlay.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-overlay-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createOverlayFile(agentId: string, content: string): Promise<void> {
  const overlaysDir = path.join(tmpDir, 'overlays')
  await fs.mkdir(overlaysDir, { recursive: true })
  await fs.writeFile(path.join(overlaysDir, `${agentId}.md`), content, 'utf-8')
}

function makeOverlay(agentId: string, content: string): Overlay {
  return { agentId, content, path: `/project/overlays/${agentId}.md` }
}

// ---------------------------------------------------------------------------
// readOverlays
// ---------------------------------------------------------------------------

describe('readOverlays', () => {
  it('returns empty map when overlays directory does not exist', async () => {
    const overlays = await readOverlays(tmpDir)
    expect(overlays.size).toBe(0)
  })

  it('returns empty map when overlays directory is empty', async () => {
    await fs.mkdir(path.join(tmpDir, 'overlays'))
    const overlays = await readOverlays(tmpDir)
    expect(overlays.size).toBe(0)
  })

  it('reads a single overlay file', async () => {
    await createOverlayFile('code-reviewer', '## My personal note\n')

    const overlays = await readOverlays(tmpDir)

    expect(overlays.size).toBe(1)
    const overlay = overlays.get('code-reviewer')
    expect(overlay).toBeDefined()
    expect(overlay?.agentId).toBe('code-reviewer')
    expect(overlay?.content).toBe('## My personal note\n')
  })

  it('stores the absolute path of the overlay file', async () => {
    await createOverlayFile('code-reviewer', '# Overlay')

    const overlays = await readOverlays(tmpDir)
    const overlay = overlays.get('code-reviewer')

    expect(overlay?.path).toContain('code-reviewer.md')
    expect(path.isAbsolute(overlay?.path ?? '')).toBe(true)
  })

  it('reads multiple overlay files', async () => {
    await createOverlayFile('code-reviewer', '# Reviewer overlay')
    await createOverlayFile('architect', '# Architect overlay')

    const overlays = await readOverlays(tmpDir)

    expect(overlays.size).toBe(2)
    expect(overlays.has('code-reviewer')).toBe(true)
    expect(overlays.has('architect')).toBe(true)
  })

  it('ignores non-.md files in the overlays directory', async () => {
    await createOverlayFile('code-reviewer', '# Overlay')
    const overlaysDir = path.join(tmpDir, 'overlays')
    await fs.writeFile(path.join(overlaysDir, 'notes.txt'), 'ignore me', 'utf-8')
    await fs.writeFile(path.join(overlaysDir, 'README'), 'also ignore', 'utf-8')

    const overlays = await readOverlays(tmpDir)

    expect(overlays.size).toBe(1)
    expect(overlays.has('code-reviewer')).toBe(true)
  })

  it('ignores subdirectories inside overlays/', async () => {
    await createOverlayFile('code-reviewer', '# Overlay')
    await fs.mkdir(path.join(tmpDir, 'overlays', 'subdir'), { recursive: true })

    const overlays = await readOverlays(tmpDir)

    expect(overlays.size).toBe(1)
  })

  it('parses agentId from filename by stripping .md extension', async () => {
    await createOverlayFile('my-custom-agent', '# Custom')

    const overlays = await readOverlays(tmpDir)

    expect(overlays.has('my-custom-agent')).toBe(true)
    expect(overlays.get('my-custom-agent')?.agentId).toBe('my-custom-agent')
  })

  it('keyed map allows O(1) lookup by agentId', async () => {
    await createOverlayFile('tdd-guide', '## TDD rules')

    const overlays = await readOverlays(tmpDir)

    expect(overlays.get('tdd-guide')?.content).toBe('## TDD rules')
  })
})

// ---------------------------------------------------------------------------
// applyOverlay
// ---------------------------------------------------------------------------

describe('applyOverlay', () => {
  it('returns combined string containing both managed and overlay content', () => {
    const managed = '# Managed agent\n\nInstructions here.'
    const overlay = makeOverlay('code-reviewer', '## My personal style\n\nAlways add emoji.')

    const combined = applyOverlay(managed, overlay)

    expect(combined).toContain('# Managed agent')
    expect(combined).toContain('## My personal style')
  })

  it('managed content appears before the separator', () => {
    const managed = '# Managed'
    const overlay = makeOverlay('agent', 'Overlay text')

    const combined = applyOverlay(managed, overlay)
    const separatorIdx = combined.indexOf('---')
    const managedIdx = combined.indexOf('# Managed')

    expect(managedIdx).toBeLessThan(separatorIdx)
  })

  it('overlay content appears after the separator', () => {
    const managed = '# Managed'
    const overlay = makeOverlay('agent', 'Overlay text')

    const combined = applyOverlay(managed, overlay)
    const separatorIdx = combined.indexOf('---')
    const overlayIdx = combined.indexOf('Overlay text')

    expect(overlayIdx).toBeGreaterThan(separatorIdx)
  })

  it('preserves managed content exactly (no mutation)', () => {
    const managed = '# Agent\n\nStrict instructions.'
    const overlay = makeOverlay('agent', 'Some addition.')

    const combined = applyOverlay(managed, overlay)

    expect(combined.startsWith(managed)).toBe(true)
  })

  it('includes the "managed content above" marker comment', () => {
    const combined = applyOverlay('managed', makeOverlay('x', 'overlay'))
    expect(combined).toContain('<!-- managed content above -->')
  })

  it('includes the LOCAL OVERLAY marker comment', () => {
    const combined = applyOverlay('managed', makeOverlay('x', 'overlay'))
    expect(combined).toContain('<!-- LOCAL OVERLAY — this section is not managed by ASDM -->')
  })

  it('includes a markdown HR separator', () => {
    const combined = applyOverlay('managed', makeOverlay('x', 'overlay'))
    expect(combined).toContain('\n---\n')
  })

  it('is a pure function — does not mutate inputs', () => {
    const managed = '# Original'
    const overlay = makeOverlay('x', 'addition')

    applyOverlay(managed, overlay)

    expect(managed).toBe('# Original')
    expect(overlay.content).toBe('addition')
  })

  it('handles empty overlay content', () => {
    const managed = '# Agent'
    const overlay = makeOverlay('agent', '')

    const combined = applyOverlay(managed, overlay)

    expect(combined).toContain('# Agent')
    expect(combined).toContain('<!-- managed content above -->')
  })

  it('handles multiline overlay content', () => {
    const managed = '# Agent'
    const content = '## Section 1\nline a\nline b\n\n## Section 2\nline c'
    const overlay = makeOverlay('agent', content)

    const combined = applyOverlay(managed, overlay)

    expect(combined).toContain('## Section 1')
    expect(combined).toContain('## Section 2')
  })
})
