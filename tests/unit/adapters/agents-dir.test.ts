import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createAgentsDirAdapter } from '../../../src/adapters/agents-dir.js'
import type { ParsedAsset } from '../../../src/core/parser.js'
import type { ResolvedProfile } from '../../../src/core/profile-resolver.js'

const SAMPLE_AGENT: ParsedAsset = {
  name: 'code-reviewer',
  type: 'agent',
  version: '1.3.0',
  description: 'Revisa PRs com foco em segurança, performance e clean code',
  frontmatter: { name: 'code-reviewer', type: 'agent', version: '1.3.0', description: 'desc' },
  providerConfig: { model: 'anthropic/claude-sonnet-4', permissions: ['read', 'write'] },
  body: '# Code Reviewer\n\nVocê é um code reviewer sênior.',
  sourcePath: 'agents/code-reviewer.asdm.md',
  sha256: 'a'.repeat(64),
}

const SAMPLE_SKILL: ParsedAsset = {
  name: 'react-best-practices',
  type: 'skill',
  version: '2.0.0',
  description: 'React best practices for the company',
  frontmatter: { name: 'react-best-practices', type: 'skill', version: '2.0.0', description: 'desc' },
  providerConfig: { location: 'skills/react-best-practices/' },
  body: '# React Best Practices\n\nUse functional components.',
  sourcePath: 'skills/react-best-practices/SKILL.asdm.md',
  sha256: 'b'.repeat(64),
}

const SAMPLE_COMMAND: ParsedAsset = {
  name: 'review',
  type: 'command',
  version: '1.1.0',
  description: 'Inicia uma revisão de código no branch atual',
  frontmatter: { name: 'review', type: 'command', version: '1.1.0', description: 'desc' },
  providerConfig: { slash_command: '/review', agent: 'code-reviewer' },
  body: '# /review\n\nExecuta uma revisão completa.',
  sourcePath: 'commands/review.asdm.md',
  sha256: 'c'.repeat(64),
}

const SAMPLE_PROFILE: ResolvedProfile = {
  name: 'fullstack-engineer',
  agents: ['code-reviewer'],
  skills: ['react-best-practices'],
  commands: ['review'],
  providers: ['agents-dir'],
  provider_config: {},
  resolvedFrom: ['base', 'fullstack-engineer'],
}

describe('AgentsDirAdapter', () => {
  const adapter = createAgentsDirAdapter()

  it('has name "agents-dir"', () => {
    expect(adapter.name).toBe('agents-dir')
  })

  describe('emitAgent', () => {
    it('emits to .agents/agents/{name}.md', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.agents/agents/code-reviewer.md')
    })

    it('includes agent body content', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.content).toContain('Code Reviewer')
      expect(files[0]?.content).toContain('code reviewer sênior')
    })

    it('includes managed-file header', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('sets provider to agents-dir in the header', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.content).toContain('Provider: agents-dir')
    })

    it('does not include YAML frontmatter', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      const content = files[0]?.content as string
      // No YAML frontmatter delimiters (unlike the copilot adapter)
      expect(content).not.toMatch(/^---\n/m)
    })

    it('sets correct sha256 (64 hex chars)', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.sha256).toHaveLength(64)
    })

    it('sets adapter name to agents-dir', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.adapter).toBe('agents-dir')
    })

    it('sets sourcePath from parsed asset', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.sourcePath).toBe('agents/code-reviewer.asdm.md')
    })
  })

  describe('emitSkill', () => {
    it('emits to .agents/skills/{name}/SKILL.md', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.agents/skills/react-best-practices/SKILL.md')
    })

    it('includes skill body content', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('React Best Practices')
      expect(files[0]?.content).toContain('functional components')
    })

    it('includes managed-file header', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('sets adapter name to agents-dir', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.adapter).toBe('agents-dir')
    })

    it('sets sourcePath from parsed asset', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.sourcePath).toBe('skills/react-best-practices/SKILL.asdm.md')
    })
  })

  describe('emitCommand', () => {
    it('emits to .agents/commands/{name}.md', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.agents/commands/review.md')
    })

    it('includes command body content', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.content).toContain('/review')
      expect(files[0]?.content).toContain('revisão completa')
    })

    it('includes managed-file header', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('sets adapter name to agents-dir', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.adapter).toBe('agents-dir')
    })

    it('sets sourcePath from parsed asset', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.sourcePath).toBe('commands/review.asdm.md')
    })
  })

  describe('emitRootInstructions', () => {
    it('returns empty array (not applicable for agents-dir)', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files).toHaveLength(0)
      expect(files).toEqual([])
    })
  })

  describe('emitConfig', () => {
    it('returns empty array (no config file for agents-dir)', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      expect(files).toHaveLength(0)
      expect(files).toEqual([])
    })
  })

  describe('clean', () => {
    let tmpDir: string

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-agents-dir-test-'))
    })

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('returns empty array when .agents/ does not exist', async () => {
      const removed = await adapter.clean(tmpDir)
      expect(removed).toEqual([])
    })

    it('removes managed files from .agents/agents/', async () => {
      const agentsDir = path.join(tmpDir, '.agents', 'agents')
      await fs.mkdir(agentsDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n# Provider: agents-dir\n\n# Code Reviewer\n\nContent.'
      const managedFile = path.join(agentsDir, 'code-reviewer.md')
      await fs.writeFile(managedFile, managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
      await expect(fs.access(managedFile)).rejects.toThrow()
    })

    it('does not remove non-managed files in .agents/', async () => {
      const agentsDir = path.join(tmpDir, '.agents', 'agents')
      await fs.mkdir(agentsDir, { recursive: true })

      const customFile = path.join(agentsDir, 'custom.md')
      await fs.writeFile(customFile, '# My Custom Agent\n\nNot managed by ASDM.')

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(0)
      await expect(fs.access(customFile)).resolves.toBeUndefined()
    })

    it('removes managed files from .agents/skills/ subdirectory', async () => {
      const skillsDir = path.join(tmpDir, '.agents', 'skills', 'react-best-practices')
      await fs.mkdir(skillsDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# React\n\nContent.'
      await fs.writeFile(path.join(skillsDir, 'SKILL.md'), managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
    })

    it('removes managed files from .agents/commands/', async () => {
      const commandsDir = path.join(tmpDir, '.agents', 'commands')
      await fs.mkdir(commandsDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# /review\n\nContent.'
      const managedFile = path.join(commandsDir, 'review.md')
      await fs.writeFile(managedFile, managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
      await expect(fs.access(managedFile)).rejects.toThrow()
    })

    it('removes multiple managed files across subdirectories', async () => {
      const agentsDir = path.join(tmpDir, '.agents', 'agents')
      const skillsDir = path.join(tmpDir, '.agents', 'skills', 'react')
      const commandsDir = path.join(tmpDir, '.agents', 'commands')
      await fs.mkdir(agentsDir, { recursive: true })
      await fs.mkdir(skillsDir, { recursive: true })
      await fs.mkdir(commandsDir, { recursive: true })

      const managed = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# Content'
      await fs.writeFile(path.join(agentsDir, 'agent.md'), managed)
      await fs.writeFile(path.join(skillsDir, 'SKILL.md'), managed)
      await fs.writeFile(path.join(commandsDir, 'review.md'), managed)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(3)
    })

    it('leaves non-managed files untouched when mixed with managed files', async () => {
      const agentsDir = path.join(tmpDir, '.agents', 'agents')
      await fs.mkdir(agentsDir, { recursive: true })

      const managed = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# Managed'
      const custom = '# Custom Agent\n\nNot managed.'

      const managedFile = path.join(agentsDir, 'managed.md')
      const customFile = path.join(agentsDir, 'custom.md')
      await fs.writeFile(managedFile, managed)
      await fs.writeFile(customFile, custom)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
      await expect(fs.access(managedFile)).rejects.toThrow()
      await expect(fs.access(customFile)).resolves.toBeUndefined()
    })
  })
})
