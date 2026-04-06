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
  providerConfig: {
    mode: 'subagent',
    model: 'anthropic/claude-sonnet-4',
    permissions: ['read', 'write'],
    tools: ['bash', 'glob', 'grep'],
  },
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
      model: 'github-copilot/claude-sonnet-4.6',
      theme: 'dark',
      mcp: {
        context7: { type: 'remote', url: 'https://mcp.context7.com/mcp', enabled: true },
      },
      plugin: ['@tarquinen/opencode-dcp@1.2.7'],
      permission: { webfetch: 'deny' },
    },
  },
  resolvedFrom: ['base', 'fullstack-engineer'],
}

/** Strip managed-file comment header and parse JSON content */
function parseConfigContent(content: string | Buffer): Record<string, unknown> {
  const json = String(content).replace(/^\/\/.*\n/gm, '').trim()
  return JSON.parse(json) as Record<string, unknown>
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

    it('includes managed-file header as YAML comments inside frontmatter', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      const content = String(files[0]?.content)
      expect(content).toContain('ASDM MANAGED FILE')
      // Header must be inside the opening --- block, not before it
      const firstFenceEnd = content.indexOf('\n---\n', 4)
      const headerIdx = content.indexOf('ASDM MANAGED FILE')
      expect(headerIdx).toBeGreaterThan(0)
      expect(headerIdx).toBeLessThan(firstFenceEnd)
    })

    it('content starts with YAML frontmatter fence', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(String(files[0]?.content)).toMatch(/^---\n/)
    })

    it('contains mode field in frontmatter', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.content).toContain('mode: subagent')
    })

    it('contains model field in frontmatter', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.content).toContain('model:')
    })

    it('body content appears after the closing frontmatter fence', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      const content = String(files[0]?.content)
      // Closing --- fence followed by blank line then body
      expect(content).toContain('---\n\n# Code Reviewer')
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

    it('defaults mode to subagent when providerConfig has no mode', () => {
      const agentWithoutMode: ParsedAsset = {
        ...SAMPLE_AGENT,
        providerConfig: { model: 'anthropic/claude-sonnet-4' },
      }
      const files = adapter.emitAgent(agentWithoutMode, '/project')
      expect(files[0]?.content).toContain('mode: subagent')
    })

    it('uses explicit primary mode when providerConfig.mode is primary', () => {
      const primaryAgent: ParsedAsset = {
        ...SAMPLE_AGENT,
        providerConfig: { mode: 'primary', model: 'anthropic/claude-sonnet-4' },
      }
      const files = adapter.emitAgent(primaryAgent, '/project')
      expect(files[0]?.content).toContain('mode: primary')
      expect(files[0]?.content).not.toContain('mode: subagent')
    })

    it('passes through extra providerConfig fields into frontmatter', () => {
      const agentWithExtra: ParsedAsset = {
        ...SAMPLE_AGENT,
        providerConfig: { model: 'anthropic/claude-sonnet-4', temperature: 0.7 },
      }
      const files = adapter.emitAgent(agentWithExtra, '/project')
      expect(files[0]?.content).toContain('temperature: 0.7')
    })

    it('transforms tools array into a record for OpenCode format', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      const content = String(files[0]?.content)
      // Each tool name must appear as a record key, not as an array element
      expect(content).toContain('bash: true')
      expect(content).toContain('glob: true')
      expect(content).toContain('grep: true')
      // Must NOT appear as a bare array item (- bash)
      expect(content).not.toMatch(/- bash/)
    })

    it('leaves tools record as-is when already a record', () => {
      const agentWithRecordTools: ParsedAsset = {
        ...SAMPLE_AGENT,
        providerConfig: { tools: { bash: {}, glob: {} } },
      }
      const files = adapter.emitAgent(agentWithRecordTools, '/project')
      const content = String(files[0]?.content)
      expect(content).toContain('bash: {}')
      expect(content).toContain('glob: {}')
    })

    it('does not add tools field when tools is absent from providerConfig', () => {
      const agentWithoutTools: ParsedAsset = {
        ...SAMPLE_AGENT,
        providerConfig: { model: 'anthropic/claude-sonnet-4' },
      }
      const files = adapter.emitAgent(agentWithoutTools, '/project')
      const content = String(files[0]?.content)
      expect(content).not.toContain('tools:')
    })

    it('leaves permissions as an array (no transformation)', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      const content = String(files[0]?.content)
      // permissions stays as YAML sequence items
      expect(content).toMatch(/- read/)
      expect(content).toMatch(/- write/)
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

    it('includes managed JSON header', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('includes MCP servers from profile', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('context7')
    })

    it('includes theme from provider_config', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      const parsed = parseConfigContent(files[0]!.content)
      expect(parsed['theme']).toBe('dark')
    })

    it('generates only $schema when provider_config.opencode is empty', () => {
      const emptyProfile: ResolvedProfile = { ...SAMPLE_PROFILE, provider_config: {} }
      const files = adapter.emitConfig(emptyProfile, '/project')
      const parsed = parseConfigContent(files[0]!.content)
      expect(Object.keys(parsed)).toHaveLength(1)
      expect(parsed['$schema']).toBe('https://opencode.ai/config.json')
    })

    it('passthrough: all provider_config.opencode fields appear in output', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      const parsed = parseConfigContent(files[0]!.content)
      expect(parsed['model']).toBe('github-copilot/claude-sonnet-4.6')
      expect((parsed['mcp'] as Record<string, unknown>)['context7']).toBeDefined()
      expect(parsed['plugin']).toEqual(['@tarquinen/opencode-dcp@1.2.7'])
      expect((parsed['permission'] as Record<string, unknown>)['webfetch']).toBe('deny')
    })

    it('$schema always appears first in output', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      const parsed = parseConfigContent(files[0]!.content)
      expect(Object.keys(parsed)[0]).toBe('$schema')
    })
  })
})
