import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createClaudeCodeAdapter } from '../../../src/adapters/claude-code.js'
import type { ParsedAsset } from '../../../src/core/parser.js'
import type { ResolvedProfile } from '../../../src/core/profile-resolver.js'

const SAMPLE_AGENT: ParsedAsset = {
  name: 'code-reviewer',
  type: 'agent',
  version: '1.3.0',
  description: 'Revisa PRs com foco em segurança, performance e clean code',
  frontmatter: { name: 'code-reviewer', type: 'agent', version: '1.3.0', description: 'desc' },
  providerConfig: { model: 'claude-sonnet-4-20250514', allowedTools: ['Read', 'Write', 'Bash'] },
  body: '# Code Reviewer\n\nVocê é um code reviewer sênior.',
  sourcePath: 'agents/code-reviewer.md',
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
  sourcePath: 'skills/react-best-practices/SKILL.md',
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
  sourcePath: 'commands/review.md',
  sha256: 'c'.repeat(64),
}

const SAMPLE_PROFILE: ResolvedProfile = {
  name: 'fullstack-engineer',
  agents: ['code-reviewer'],
  skills: ['react-best-practices'],
  commands: ['review'],
  providers: ['claude-code'],
  provider_config: {
    'claude-code': {
      permissions: { allow: ['Read(**)', 'Write(src/**)'] },
    },
  },
  resolvedFrom: ['base', 'fullstack-engineer'],
}

describe('ClaudeCodeAdapter', () => {
  const adapter = createClaudeCodeAdapter()

  describe('emitAgent', () => {
    it('emits to .claude/agents/{name}.md', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.claude/agents/code-reviewer.md')
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

    it('sets correct sha256 (64 hex chars)', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.sha256).toHaveLength(64)
    })

    it('sets adapter name to claude-code', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.adapter).toBe('claude-code')
    })

    it('sets sourcePath from parsed asset', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.sourcePath).toBe('agents/code-reviewer.md')
    })
  })

  describe('emitSkill', () => {
    it('emits to .claude/skills/{name}/SKILL.md', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.claude/skills/react-best-practices/SKILL.md')
    })

    it('includes skill body content', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('React Best Practices')
    })

    it('includes managed-file header', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('sets adapter name to claude-code', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.adapter).toBe('claude-code')
    })
  })

  describe('emitCommand', () => {
    it('emits to .claude/commands/{name}.md', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.claude/commands/review.md')
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
  })

  describe('emitRootInstructions', () => {
    it('emits .claude/CLAUDE.md', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.claude/CLAUDE.md')
    })

    it('includes available_skills XML block with skill names', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('<available_skills>')
      expect(files[0]?.content).toContain('<name>react-best-practices</name>')
    })

    it('includes skill location paths', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('.claude/skills/react-best-practices/SKILL.md')
    })

    it('includes agent references', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('code-reviewer')
      expect(files[0]?.content).toContain('.claude/agents/code-reviewer.md')
    })

    it('includes command references', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('/review')
      expect(files[0]?.content).toContain('.claude/commands/review.md')
    })

    it('includes managed-file header', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('sets adapter name to claude-code', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.adapter).toBe('claude-code')
    })

    it('handles profile with no agents, skills, or commands', () => {
      const emptyProfile: ResolvedProfile = {
        name: 'empty',
        agents: [],
        skills: [],
        commands: [],
        providers: [],
        provider_config: {},
        resolvedFrom: ['empty'],
      }
      const files = adapter.emitRootInstructions(emptyProfile, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.content).toContain('AI Assistant Configuration')
      expect(files[0]?.content).not.toContain('<available_skills>')
    })
  })

  describe('emitConfig', () => {
    it('returns empty array (no config file for Claude Code in Phase 2)', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      expect(files).toHaveLength(0)
    })
  })

  describe('clean', () => {
    let tmpDir: string

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-claude-test-'))
    })

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('returns empty array when .claude/ does not exist', async () => {
      const removed = await adapter.clean(tmpDir)
      expect(removed).toEqual([])
    })

    it('removes managed files from .claude/agents/', async () => {
      const agentsDir = path.join(tmpDir, '.claude', 'agents')
      await fs.mkdir(agentsDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n# Provider: claude-code\n\n# Code Reviewer\n\nContent.'
      const managedFile = path.join(agentsDir, 'code-reviewer.md')
      await fs.writeFile(managedFile, managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
      await expect(fs.access(managedFile)).rejects.toThrow()
    })

    it('does not remove non-managed files in .claude/', async () => {
      const agentsDir = path.join(tmpDir, '.claude', 'agents')
      await fs.mkdir(agentsDir, { recursive: true })

      const customFile = path.join(agentsDir, 'custom.md')
      await fs.writeFile(customFile, '# My Custom Agent\n\nNot managed by ASDM.')

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(0)
      await expect(fs.access(customFile)).resolves.toBeUndefined()
    })

    it('identifies managed files in nested .claude/skills/ subdirectory', async () => {
      const skillsDir = path.join(tmpDir, '.claude', 'skills', 'react-best-practices')
      await fs.mkdir(skillsDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# React\n\nContent.'
      await fs.writeFile(path.join(skillsDir, 'SKILL.md'), managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
    })

    it('removes managed CLAUDE.md', async () => {
      const claudeDir = path.join(tmpDir, '.claude')
      await fs.mkdir(claudeDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# AI Assistant Configuration'
      const claudeMd = path.join(claudeDir, 'CLAUDE.md')
      await fs.writeFile(claudeMd, managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
      await expect(fs.access(claudeMd)).rejects.toThrow()
    })

    it('removes multiple managed files across subdirectories', async () => {
      const agentsDir = path.join(tmpDir, '.claude', 'agents')
      const skillsDir = path.join(tmpDir, '.claude', 'skills', 'react')
      const commandsDir = path.join(tmpDir, '.claude', 'commands')
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
  })
})
