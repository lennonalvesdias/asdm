import { describe, it, expect } from 'vitest'
import { createOpenCodeAdapter } from '../../../src/adapters/opencode.js'
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
  providers: ['opencode'],
  provider_config: {
    opencode: {
      theme: 'dark',
      mcp_servers: [
        { name: 'postgres', command: 'npx', args: ['-y', '@mcp/server-postgres'] }
      ]
    }
  },
  resolvedFrom: ['base', 'fullstack-engineer'],
}

describe('OpenCodeAdapter', () => {
  const adapter = createOpenCodeAdapter()

  describe('emitAgent', () => {
    it('emits to .opencode/agents/{name}.md', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.opencode/agents/code-reviewer.md')
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

    it('sets correct sha256', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.sha256).toHaveLength(64)
    })

    it('sets adapter name', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.adapter).toBe('opencode')
    })

    it('sets sourcePath', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.sourcePath).toBe('agents/code-reviewer.asdm.md')
    })
  })

  describe('emitSkill', () => {
    it('emits to .opencode/skills/{name}/SKILL.md', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.relativePath).toBe('.opencode/skills/react-best-practices/SKILL.md')
    })

    it('includes skill body', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('React Best Practices')
    })
  })

  describe('emitCommand', () => {
    it('emits to .opencode/commands/{name}.md', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.relativePath).toBe('.opencode/commands/review.md')
    })
  })

  describe('emitRootInstructions', () => {
    it('emits AGENTS.md', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.relativePath).toBe('AGENTS.md')
    })

    it('includes available_skills block', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('<available_skills>')
      expect(files[0]?.content).toContain('react-best-practices')
    })

    it('includes agent references', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('code-reviewer')
    })
  })

  describe('emitConfig', () => {
    it('emits .opencode/opencode.jsonc', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      expect(files[0]?.relativePath).toBe('.opencode/opencode.jsonc')
    })

    it('includes MCP servers from profile', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('postgres')
    })

    it('includes managed JSON header', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })
  })
})
