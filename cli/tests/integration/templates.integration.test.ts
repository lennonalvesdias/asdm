/**
 * Integration tests for the `asdm templates` scaffold helpers.
 *
 * Unlike the unit tests (which test generate + write in isolation), these tests
 * verify the full round-trip: generate content → write to real filesystem →
 * read back → parse with parseAsset(). This confirms that every template
 * produces a syntactically valid .md file that ASDM's own parser accepts.
 *
 * Scenarios:
 *   - All three asset types parse successfully through parseAsset()
 *   - Write + read back produces identical content (no encoding mangling)
 *   - Multiple templates can coexist in the same directory
 *   - writeTemplateFile force flag controls overwrite behaviour
 *   - Nested output directories are created automatically
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  generateAgentTemplate,
  generateSkillTemplate,
  generateCommandTemplate,
  writeTemplateFile,
} from '../../src/cli/commands/templates.js'
import { parseAsset } from '../../src/core/parser.js'
import { exists } from '../../src/utils/fs.js'

// ── Test setup ────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-templates-int-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ── Agent template round-trip ─────────────────────────────────────────────────

describe('agent template — parse validity', () => {
  it('generates content that parseAsset() accepts without throwing', () => {
    const content = generateAgentTemplate('my-agent')

    expect(() => parseAsset(content, 'agents/my-agent.md', 'opencode')).not.toThrow()
  })

  it('parsed asset has correct name, type, and version', () => {
    const content = generateAgentTemplate('my-agent')
    const parsed = parseAsset(content, 'agents/my-agent.md', 'opencode')

    expect(parsed.name).toBe('my-agent')
    expect(parsed.type).toBe('agent')
    expect(parsed.version).toBe('1.0.0')
  })

  it('parsed asset has a non-empty description', () => {
    const content = generateAgentTemplate('my-agent')
    const parsed = parseAsset(content, 'agents/my-agent.md', 'opencode')

    expect(typeof parsed.description).toBe('string')
    expect(parsed.description.length).toBeGreaterThan(0)
  })

  it('parsed asset body contains the agent heading', () => {
    const content = generateAgentTemplate('my-agent')
    const parsed = parseAsset(content, 'agents/my-agent.md', 'opencode')

    expect(parsed.body).toContain('# my-agent')
  })

  it('write + read back produces identical content', async () => {
    const content = generateAgentTemplate('my-agent')
    await writeTemplateFile(tmpDir, 'my-agent', content, false)

    const written = await fs.readFile(path.join(tmpDir, 'my-agent.md'), 'utf-8')

    expect(written).toBe(content)
  })
})

// ── Skill template round-trip ─────────────────────────────────────────────────

describe('skill template — parse validity', () => {
  it('generates content that parseAsset() accepts without throwing', () => {
    const content = generateSkillTemplate('my-skill')

    expect(() => parseAsset(content, 'skills/my-skill/SKILL.md', 'opencode')).not.toThrow()
  })

  it('parsed asset has correct name, type, and version', () => {
    const content = generateSkillTemplate('my-skill')
    const parsed = parseAsset(content, 'skills/my-skill/SKILL.md', 'opencode')

    expect(parsed.name).toBe('my-skill')
    expect(parsed.type).toBe('skill')
    expect(parsed.version).toBe('1.0.0')
  })

  it('parsed asset body contains Overview, Usage, and Examples sections', () => {
    const content = generateSkillTemplate('my-skill')
    const parsed = parseAsset(content, 'skills/my-skill/SKILL.md', 'opencode')

    expect(parsed.body).toContain('## Overview')
    expect(parsed.body).toContain('## Usage')
    expect(parsed.body).toContain('## Examples')
  })

  it('write + read back produces identical content', async () => {
    const content = generateSkillTemplate('my-skill')
    await writeTemplateFile(tmpDir, 'my-skill', content, false)

    const written = await fs.readFile(path.join(tmpDir, 'my-skill.md'), 'utf-8')

    expect(written).toBe(content)
  })
})

// ── Command template round-trip ───────────────────────────────────────────────

describe('command template — parse validity', () => {
  it('generates content that parseAsset() accepts without throwing', () => {
    const content = generateCommandTemplate('my-command')

    expect(() => parseAsset(content, 'commands/my-command.md', 'opencode')).not.toThrow()
  })

  it('parsed asset has correct name, type, and version', () => {
    const content = generateCommandTemplate('my-command')
    const parsed = parseAsset(content, 'commands/my-command.md', 'opencode')

    expect(parsed.name).toBe('my-command')
    expect(parsed.type).toBe('command')
    expect(parsed.version).toBe('1.0.0')
  })

  it('parsed asset body contains the slash-prefixed command heading', () => {
    const content = generateCommandTemplate('my-command')
    const parsed = parseAsset(content, 'commands/my-command.md', 'opencode')

    expect(parsed.body).toContain('# /my-command')
  })

  it('write + read back produces identical content', async () => {
    const content = generateCommandTemplate('my-command')
    await writeTemplateFile(tmpDir, 'my-command', content, false)

    const written = await fs.readFile(path.join(tmpDir, 'my-command.md'), 'utf-8')

    expect(written).toBe(content)
  })
})

// ── Multi-asset coexistence ───────────────────────────────────────────────────

describe('multiple templates in the same directory', () => {
  it('all three asset types can be written without conflicting', async () => {
    await writeTemplateFile(tmpDir, 'my-agent', generateAgentTemplate('my-agent'), false)
    await writeTemplateFile(tmpDir, 'my-skill', generateSkillTemplate('my-skill'), false)
    await writeTemplateFile(tmpDir, 'my-command', generateCommandTemplate('my-command'), false)

    expect(await exists(path.join(tmpDir, 'my-agent.md'))).toBe(true)
    expect(await exists(path.join(tmpDir, 'my-skill.md'))).toBe(true)
    expect(await exists(path.join(tmpDir, 'my-command.md'))).toBe(true)
  })

  it('each file contains type-specific content', async () => {
    await writeTemplateFile(tmpDir, 'a', generateAgentTemplate('a'), false)
    await writeTemplateFile(tmpDir, 'b', generateSkillTemplate('b'), false)
    await writeTemplateFile(tmpDir, 'c', generateCommandTemplate('c'), false)

    const agentContent = await fs.readFile(path.join(tmpDir, 'a.md'), 'utf-8')
    const skillContent = await fs.readFile(path.join(tmpDir, 'b.md'), 'utf-8')
    const commandContent = await fs.readFile(path.join(tmpDir, 'c.md'), 'utf-8')

    expect(agentContent).toContain('type: agent')
    expect(skillContent).toContain('type: skill')
    expect(commandContent).toContain('type: command')
  })

  it('all three files are independently parseable', () => {
    const agentContent = generateAgentTemplate('a')
    const skillContent = generateSkillTemplate('b')
    const commandContent = generateCommandTemplate('c')

    const agentParsed = parseAsset(agentContent, 'agents/a.md', 'opencode')
    const skillParsed = parseAsset(skillContent, 'skills/b/SKILL.md', 'opencode')
    const commandParsed = parseAsset(commandContent, 'commands/c.md', 'opencode')

    expect(agentParsed.name).toBe('a')
    expect(skillParsed.name).toBe('b')
    expect(commandParsed.name).toBe('c')
  })
})

// ── Nested output directory ───────────────────────────────────────────────────

describe('writeTemplateFile — directory creation', () => {
  it('creates nested output directories automatically', async () => {
    const nestedDir = path.join(tmpDir, 'registry', 'agents')
    const content = generateAgentTemplate('nested-agent')

    await writeTemplateFile(nestedDir, 'nested-agent', content, false)

    expect(await exists(path.join(nestedDir, 'nested-agent.md'))).toBe(true)
  })
})

// ── Force flag ────────────────────────────────────────────────────────────────

describe('writeTemplateFile — force flag', () => {
  it('force=true overwrites an existing file with the new content', async () => {
    await fs.writeFile(path.join(tmpDir, 'my-agent.md'), 'old content', 'utf-8')

    const newContent = generateAgentTemplate('my-agent')
    await writeTemplateFile(tmpDir, 'my-agent', newContent, true)

    const written = await fs.readFile(path.join(tmpDir, 'my-agent.md'), 'utf-8')
    expect(written).toBe(newContent)
  })

  it('force=false preserves an existing file and sets process.exitCode to 1', async () => {
    const originalContent = 'do not overwrite this'
    await fs.writeFile(path.join(tmpDir, 'protected.md'), originalContent, 'utf-8')

    const prevExitCode = process.exitCode
    await writeTemplateFile(tmpDir, 'protected', 'new content', false)

    const after = await fs.readFile(path.join(tmpDir, 'protected.md'), 'utf-8')
    expect(after).toBe(originalContent)
    expect(process.exitCode).toBe(1)

    // Restore to avoid contaminating other tests
    process.exitCode = prevExitCode
  })
})
