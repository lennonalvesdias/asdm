import { describe, it, expect } from 'vitest'
import { resolveProfileFromManifest } from '../../../src/core/profile-resolver.js'
import { ConfigError } from '../../../src/utils/errors.js'

const MANIFEST_PROFILES = {
  base: {
    extends: [],
    agents: ['code-reviewer', 'security-scanner'],
    skills: [],
    commands: ['review'],
    providers: ['opencode'],
  },
  'fullstack-engineer': {
    extends: ['base'],
    agents: ['tdd-guide', 'architect'],
    skills: ['react-best-practices', 'api-design', 'sql'],
    commands: ['test', 'deploy-preview'],
    providers: ['opencode', 'claude-code', 'copilot'],
  },
  mobile: {
    extends: ['base'],
    agents: ['mobile-architect'],
    skills: ['react-native'],
    commands: [],
    providers: ['opencode', 'claude-code'],
  },
  'mobile-ios': {
    extends: ['mobile'],
    agents: [],
    skills: ['swift-ui'],
    commands: [],
    providers: ['opencode', 'claude-code'],
  },
}

describe('resolveProfileFromManifest', () => {
  it('resolves base profile', () => {
    const resolved = resolveProfileFromManifest(MANIFEST_PROFILES, 'base')
    expect(resolved.agents).toContain('code-reviewer')
    expect(resolved.agents).toContain('security-scanner')
    expect(resolved.commands).toContain('review')
    expect(resolved.resolvedFrom).toEqual(['base'])
  })

  it('resolves fullstack-engineer with base inheritance', () => {
    const resolved = resolveProfileFromManifest(MANIFEST_PROFILES, 'fullstack-engineer')
    // Should have base agents + fullstack agents
    expect(resolved.agents).toContain('code-reviewer')
    expect(resolved.agents).toContain('security-scanner')
    expect(resolved.agents).toContain('tdd-guide')
    expect(resolved.agents).toContain('architect')
    // Skills from fullstack only
    expect(resolved.skills).toContain('react-best-practices')
    // Commands merged
    expect(resolved.commands).toContain('review')
    expect(resolved.commands).toContain('test')
    expect(resolved.resolvedFrom).toEqual(['base', 'fullstack-engineer'])
  })

  it('resolves mobile-ios with 2-level inheritance', () => {
    const resolved = resolveProfileFromManifest(MANIFEST_PROFILES, 'mobile-ios')
    // base agents
    expect(resolved.agents).toContain('code-reviewer')
    // mobile agents
    expect(resolved.agents).toContain('mobile-architect')
    // mobile-ios skills
    expect(resolved.skills).toContain('swift-ui')
    // mobile skills
    expect(resolved.skills).toContain('react-native')
    expect(resolved.resolvedFrom).toEqual(['base', 'mobile', 'mobile-ios'])
  })

  it('deduplicates agents from multiple inheritance levels', () => {
    const resolved = resolveProfileFromManifest(MANIFEST_PROFILES, 'fullstack-engineer')
    const codeReviewerCount = resolved.agents.filter(a => a === 'code-reviewer').length
    expect(codeReviewerCount).toBe(1)
  })

  it('throws ConfigError for unknown profile', () => {
    expect(() =>
      resolveProfileFromManifest(MANIFEST_PROFILES, 'nonexistent')
    ).toThrow(ConfigError)
  })

  it('throws ConfigError for circular inheritance', () => {
    const cyclicProfiles = {
      a: { extends: ['b'], agents: [], skills: [], commands: [] },
      b: { extends: ['a'], agents: [], skills: [], commands: [] },
    }
    expect(() =>
      resolveProfileFromManifest(cyclicProfiles as any, 'a')
    ).toThrow(ConfigError)
  })

  it('supports removal syntax (-agent-name)', () => {
    const profiles = {
      base: { agents: ['agent-a', 'agent-b'], skills: [], commands: [] },
      child: {
        extends: ['base'],
        agents: ['-agent-b', 'agent-c'],  // Remove agent-b, add agent-c
        skills: [],
        commands: [],
      },
    }
    const resolved = resolveProfileFromManifest(profiles as any, 'child')
    expect(resolved.agents).toContain('agent-a')
    expect(resolved.agents).not.toContain('agent-b')
    expect(resolved.agents).toContain('agent-c')
  })

  it('propagates provider_config from manifest profiles', () => {
    const profiles = {
      base: {
        agents: [],
        skills: [],
        commands: [],
        providers: ['opencode'],
        provider_config: {
          opencode: {
            theme: 'dark',
            mcp_servers: [{ name: 'postgres', command: 'npx', args: ['-y', '@mcp/server-postgres'] }],
          },
        },
      },
      child: {
        extends: ['base'],
        agents: [],
        skills: [],
        commands: [],
        provider_config: {
          opencode: { model: 'claude-sonnet' },
        },
      },
    }
    const resolved = resolveProfileFromManifest(profiles, 'child')
    expect(resolved.provider_config['opencode']?.['theme']).toBe('dark')
    expect(resolved.provider_config['opencode']?.['model']).toBe('claude-sonnet')
    const mcpServers = resolved.provider_config['opencode']?.['mcp_servers'] as Array<{ name: string }>
    expect(mcpServers).toHaveLength(1)
    expect(mcpServers[0]?.name).toBe('postgres')
  })

  it('merges provider_config arrays without duplication across inheritance', () => {
    const profiles = {
      base: {
        agents: [],
        skills: [],
        commands: [],
        provider_config: {
          opencode: {
            mcp_servers: [{ name: 'pg', command: 'npx' }],
          },
        },
      },
      child: {
        extends: ['base'],
        agents: [],
        skills: [],
        commands: [],
        provider_config: {
          opencode: {
            mcp_servers: [{ name: 'redis', command: 'npx' }],
          },
        },
      },
    }
    const resolved = resolveProfileFromManifest(profiles, 'child')
    const servers = resolved.provider_config['opencode']?.['mcp_servers'] as Array<{ name: string }>
    expect(servers.some(s => s.name === 'pg')).toBe(true)
    expect(servers.some(s => s.name === 'redis')).toBe(true)
  })
})
