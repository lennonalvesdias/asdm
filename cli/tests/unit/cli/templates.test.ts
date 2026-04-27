/**
 * Unit tests for the templates command scaffold helpers.
 *
 * Tests cover:
 *   - generateAgentTemplate: correct frontmatter fields and body sections
 *   - generateSkillTemplate: correct frontmatter fields and body sections
 *   - generateCommandTemplate: correct frontmatter fields and body sections
 *   - writeTemplateFile: creates the file with correct name
 *   - writeTemplateFile: errors when file exists and force=false
 *   - writeTemplateFile: overwrites when file exists and force=true
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
} from '../../../src/cli/commands/templates.js'
import { exists } from '../../../src/utils/fs.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-templates-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ── generateAgentTemplate ─────────────────────────────────────────────────────

describe('generateAgentTemplate', () => {
  it('includes the name in frontmatter', () => {
    const content = generateAgentTemplate('my-agent')
    expect(content).toContain('name: my-agent')
  })

  it('sets type to agent', () => {
    const content = generateAgentTemplate('my-agent')
    expect(content).toContain('type: agent')
  })

  it('includes a version field', () => {
    const content = generateAgentTemplate('my-agent')
    expect(content).toContain('version: "1.0.0"')
  })

  it('includes providers section with opencode, claude-code, and copilot', () => {
    const content = generateAgentTemplate('my-agent')
    expect(content).toContain('opencode:')
    expect(content).toContain('claude-code:')
    expect(content).toContain('copilot:')
  })

  it('includes Role, Instructions, and Guidelines sections in body', () => {
    const content = generateAgentTemplate('my-agent')
    expect(content).toContain('## Role')
    expect(content).toContain('## Instructions')
    expect(content).toContain('## Guidelines')
  })

  it('uses the name as the markdown heading', () => {
    const content = generateAgentTemplate('code-reviewer')
    expect(content).toContain('# code-reviewer')
  })
})

// ── generateSkillTemplate ─────────────────────────────────────────────────────

describe('generateSkillTemplate', () => {
  it('includes the name in frontmatter', () => {
    const content = generateSkillTemplate('my-skill')
    expect(content).toContain('name: my-skill')
  })

  it('sets type to skill', () => {
    const content = generateSkillTemplate('my-skill')
    expect(content).toContain('type: skill')
  })

  it('includes a version field', () => {
    const content = generateSkillTemplate('my-skill')
    expect(content).toContain('version: "1.0.0"')
  })

  it('does NOT include a providers section', () => {
    const content = generateSkillTemplate('my-skill')
    expect(content).not.toContain('providers:')
  })

  it('includes Overview, Usage, and Examples sections in body', () => {
    const content = generateSkillTemplate('my-skill')
    expect(content).toContain('## Overview')
    expect(content).toContain('## Usage')
    expect(content).toContain('## Examples')
  })

  it('uses the name as the markdown heading', () => {
    const content = generateSkillTemplate('typescript-expert')
    expect(content).toContain('# typescript-expert')
  })
})

// ── generateCommandTemplate ───────────────────────────────────────────────────

describe('generateCommandTemplate', () => {
  it('includes the name in frontmatter', () => {
    const content = generateCommandTemplate('my-command')
    expect(content).toContain('name: my-command')
  })

  it('sets type to command', () => {
    const content = generateCommandTemplate('my-command')
    expect(content).toContain('type: command')
  })

  it('includes a version field', () => {
    const content = generateCommandTemplate('my-command')
    expect(content).toContain('version: "1.0.0"')
  })

  it('uses slash-prefixed name as the markdown heading', () => {
    const content = generateCommandTemplate('review')
    expect(content).toContain('# /review')
  })

  it('includes a Usage section with slash-prefixed command', () => {
    const content = generateCommandTemplate('deploy')
    expect(content).toContain('## Usage')
    expect(content).toContain('/deploy')
  })

  it('includes Description and Examples sections', () => {
    const content = generateCommandTemplate('my-command')
    expect(content).toContain('## Description')
    expect(content).toContain('## Examples')
  })
})

// ── writeTemplateFile ─────────────────────────────────────────────────────────

describe('writeTemplateFile', () => {
  it('creates the file with the correct filename', async () => {
    const content = generateAgentTemplate('test-agent')
    await writeTemplateFile(tmpDir, 'test-agent', content, false)

    const expectedPath = path.join(tmpDir, 'test-agent.md')
    expect(await exists(expectedPath)).toBe(true)
  })

  it('writes the provided content to disk', async () => {
    const content = generateSkillTemplate('my-skill')
    await writeTemplateFile(tmpDir, 'my-skill', content, false)

    const written = await fs.readFile(path.join(tmpDir, 'my-skill.md'), 'utf-8')
    expect(written).toBe(content)
  })

  it('sets exit code 1 and does NOT overwrite when file exists and force=false', async () => {
    const originalContent = 'original content'
    await fs.writeFile(path.join(tmpDir, 'existing.md'), originalContent, 'utf-8')

    const previousExitCode = process.exitCode
    await writeTemplateFile(tmpDir, 'existing', 'new content', false)

    // File should be unchanged
    const still = await fs.readFile(path.join(tmpDir, 'existing.md'), 'utf-8')
    expect(still).toBe(originalContent)
    expect(process.exitCode).toBe(1)

    // Restore exit code so other tests are unaffected
    process.exitCode = previousExitCode
  })

  it('overwrites existing file when force=true', async () => {
    await fs.writeFile(path.join(tmpDir, 'overwrite-me.md'), 'old content', 'utf-8')

    const newContent = generateCommandTemplate('overwrite-me')
    await writeTemplateFile(tmpDir, 'overwrite-me', newContent, true)

    const written = await fs.readFile(path.join(tmpDir, 'overwrite-me.md'), 'utf-8')
    expect(written).toBe(newContent)
  })

  it('creates parent directories if they do not exist', async () => {
    const nestedDir = path.join(tmpDir, 'agents', 'subdir')
    const content = generateAgentTemplate('nested-agent')

    await writeTemplateFile(nestedDir, 'nested-agent', content, false)

    const expectedPath = path.join(nestedDir, 'nested-agent.md')
    expect(await exists(expectedPath)).toBe(true)
  })
})
