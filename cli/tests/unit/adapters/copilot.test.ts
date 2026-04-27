import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createCopilotAdapter, CopilotAdapter } from '../../../src/adapters/copilot.js'
import type { ParsedAsset } from '../../../src/core/parser.js'
import type { ResolvedProfile } from '../../../src/core/profile-resolver.js'

const SAMPLE_AGENT: ParsedAsset = {
  name: 'code-reviewer',
  type: 'agent',
  version: '1.3.0',
  description: 'Revisa PRs com foco em segurança, performance e clean code',
  frontmatter: { name: 'code-reviewer', type: 'agent', version: '1.3.0', description: 'desc' },
  providerConfig: { on: 'pull_request', permissions: { pull_requests: 'write' } },
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
  providerConfig: { applyTo: '**/*.tsx,**/*.jsx' },
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
  providers: ['copilot'],
  provider_config: {},
  resolvedFrom: ['base', 'fullstack-engineer'],
}

describe('CopilotAdapter', () => {
  const adapter = createCopilotAdapter()

  describe('emitAgent', () => {
    it('emits to .github/agents/{name}.agent.md', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.github/agents/code-reviewer.agent.md')
    })

    it('includes YAML frontmatter with name', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.content).toContain('name: code-reviewer')
    })

    it('includes YAML frontmatter with description', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.content).toContain('description: Revisa PRs com foco em segurança')
    })

    it('wraps frontmatter in --- delimiters', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      const content = files[0]?.content as string
      expect(content).toContain('---')
    })

    it('starts with --- on line 1 (frontmatter before managed header)', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      const content = files[0]?.content as string
      expect(content.startsWith('---')).toBe(true)
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

    it('sets adapter name to copilot', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.adapter).toBe('copilot')
    })

    it('sets sourcePath from parsed asset', () => {
      const files = adapter.emitAgent(SAMPLE_AGENT, '/project')
      expect(files[0]?.sourcePath).toBe('agents/code-reviewer.md')
    })
  })

  describe('emitSkill', () => {
    it('emits to .github/skills/{name}/SKILL.md', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.github/skills/react-best-practices/SKILL.md')
    })

    it('includes skill body content', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('React Best Practices')
    })

    it('includes YAML frontmatter with name', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('name: react-best-practices')
    })

    it('includes YAML frontmatter with description', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('description: React best practices for the company')
    })

    it('wraps frontmatter in --- delimiters', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('---')
    })

    it('starts with --- on line 1 (frontmatter before managed header)', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      const content = files[0]?.content as string
      expect(content.startsWith('---')).toBe(true)
    })

    it('includes managed-file header', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('sets adapter name to copilot', () => {
      const files = adapter.emitSkill(SAMPLE_SKILL, '/project')
      expect(files[0]?.adapter).toBe('copilot')
    })
  })

  describe('emitCommand', () => {
    it('emits exactly one file', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files).toHaveLength(1)
    })

    it('writes to .github/skills/{name}/SKILL.md', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.relativePath).toBe('.github/skills/review/SKILL.md')
    })

    it('includes YAML frontmatter with name and description', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.content).toContain('name: review')
      expect(files[0]?.content).toContain('description: Inicia uma revisão de código no branch atual')
    })

    it('includes managed-file header', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('includes the command body', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.content).toContain('Executa uma revisão completa.')
    })

    it('starts with --- on line 1 (frontmatter before managed header)', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      const content = files[0]?.content as string
      expect(content.startsWith('---')).toBe(true)
    })

    it('sets the correct adapter name', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.adapter).toBe('copilot')
    })

    it('sets sourcePath from parsed asset', () => {
      const files = adapter.emitCommand(SAMPLE_COMMAND, '/project')
      expect(files[0]?.sourcePath).toBe('commands/review.md')
    })
  })

  describe('emitRootInstructions', () => {
    it('emits .github/copilot-instructions.md', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files).toHaveLength(1)
      expect(files[0]?.relativePath).toBe('.github/copilot-instructions.md')
    })

    it('includes agent references with .agent.md paths', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('code-reviewer')
      expect(files[0]?.content).toContain('.github/agents/code-reviewer.agent.md')
    })

    it('includes commands list', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('review')
      expect(files[0]?.content).toContain('Commands Available')
    })

    it('includes skill references with SKILL.md paths', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('react-best-practices')
      expect(files[0]?.content).toContain('.github/skills/react-best-practices/SKILL.md')
    })

    it('includes managed-file header', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.content).toContain('ASDM MANAGED FILE')
    })

    it('sets adapter name to copilot', () => {
      const files = adapter.emitRootInstructions(SAMPLE_PROFILE, '/project')
      expect(files[0]?.adapter).toBe('copilot')
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
      expect(files[0]?.content).toContain('GitHub Copilot Instructions')
      expect(files[0]?.content).not.toContain('## Active Agents')
    })
  })

  describe('emitConfig', () => {
    it('returns empty array (no config file for Copilot)', () => {
      const files = adapter.emitConfig(SAMPLE_PROFILE, '/project')
      expect(files).toHaveLength(0)
    })
  })

  describe('clean', () => {
    let tmpDir: string

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-copilot-test-'))
    })

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('returns empty array when .github/ does not exist', async () => {
      const removed = await adapter.clean(tmpDir)
      expect(removed).toEqual([])
    })

    it('removes managed files from .github/agents/', async () => {
      const agentsDir = path.join(tmpDir, '.github', 'agents')
      await fs.mkdir(agentsDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n# Provider: copilot\n\n# Code Reviewer\n\nContent.'
      const managedFile = path.join(agentsDir, 'code-reviewer.agent.md')
      await fs.writeFile(managedFile, managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
      await expect(fs.access(managedFile)).rejects.toThrow()
    })

    it('does not remove non-managed files in .github/', async () => {
      const workflowsDir = path.join(tmpDir, '.github', 'workflows')
      await fs.mkdir(workflowsDir, { recursive: true })

      const ciFile = path.join(workflowsDir, 'ci.yml')
      await fs.writeFile(ciFile, 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest')

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(0)
      await expect(fs.access(ciFile)).resolves.toBeUndefined()
    })

    it('identifies managed files in .github/skills/ subdirectory', async () => {
      const skillsDir = path.join(tmpDir, '.github', 'skills', 'react-best-practices')
      await fs.mkdir(skillsDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# React\n\nContent.'
      await fs.writeFile(path.join(skillsDir, 'SKILL.md'), managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
    })

    it('removes managed copilot-instructions.md', async () => {
      const githubDir = path.join(tmpDir, '.github')
      await fs.mkdir(githubDir, { recursive: true })

      const managedContent = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# GitHub Copilot Instructions'
      const instructionsFile = path.join(githubDir, 'copilot-instructions.md')
      await fs.writeFile(instructionsFile, managedContent)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(1)
      await expect(fs.access(instructionsFile)).rejects.toThrow()
    })

    it('does not remove non-managed copilot-instructions.md', async () => {
      const githubDir = path.join(tmpDir, '.github')
      await fs.mkdir(githubDir, { recursive: true })

      const customFile = path.join(githubDir, 'copilot-instructions.md')
      await fs.writeFile(customFile, '# Custom Copilot Instructions\n\nManually written.')

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(0)
      await expect(fs.access(customFile)).resolves.toBeUndefined()
    })

    it('removes multiple managed files across subdirectories', async () => {
      const agentsDir = path.join(tmpDir, '.github', 'agents')
      const skillsDir = path.join(tmpDir, '.github', 'skills', 'react')
      const githubDir = path.join(tmpDir, '.github')
      await fs.mkdir(agentsDir, { recursive: true })
      await fs.mkdir(skillsDir, { recursive: true })

      const managed = '# ⚠️  ASDM MANAGED FILE — DO NOT EDIT MANUALLY\n\n# Content'
      await fs.writeFile(path.join(agentsDir, 'agent.agent.md'), managed)
      await fs.writeFile(path.join(skillsDir, 'SKILL.md'), managed)
      await fs.writeFile(path.join(githubDir, 'copilot-instructions.md'), managed)

      const removed = await adapter.clean(tmpDir)

      expect(removed).toHaveLength(3)
    })
  })
})

const makeAsset = (overrides: Partial<ParsedAsset> = {}): ParsedAsset => ({
  name: 'audit-deps',
  description: 'Audits project dependencies for security vulnerabilities',
  body: 'Run npm audit and report critical vulnerabilities.',
  type: 'command',
  version: '1.0.0',
  sourcePath: 'commands/audit-deps.md',
  frontmatter: {},
  providerConfig: {},
  sha256: 'a'.repeat(64),
  ...overrides,
})

describe('CopilotAdapter.emitCommand', () => {
  const adapter = new CopilotAdapter()

  it('emits exactly one file', () => {
    const files = adapter.emitCommand(makeAsset(), '/tmp')
    expect(files).toHaveLength(1)
  })

  it('writes to .github/skills/{name}/SKILL.md', () => {
    const files = adapter.emitCommand(makeAsset(), '/tmp')
    expect(files[0]?.relativePath).toBe('.github/skills/audit-deps/SKILL.md')
  })

  it('includes YAML frontmatter with name and description', () => {
    const files = adapter.emitCommand(makeAsset(), '/tmp')
    expect(files[0]?.content).toContain('name: audit-deps')
    expect(files[0]?.content).toContain('description: Audits project dependencies for security vulnerabilities')
  })

  it('includes managedFileHeader', () => {
    const files = adapter.emitCommand(makeAsset(), '/tmp')
    expect(files[0]?.content).toContain('ASDM MANAGED FILE')
  })

  it('includes the command body', () => {
    const files = adapter.emitCommand(makeAsset(), '/tmp')
    expect(files[0]?.content).toContain('Run npm audit and report critical vulnerabilities.')
  })

  it('sets the correct adapter name', () => {
    const files = adapter.emitCommand(makeAsset(), '/tmp')
    expect(files[0]?.adapter).toBe('copilot')
  })

  it('uses name from asset for path', () => {
    const files = adapter.emitCommand(makeAsset({ name: 'analyze-schema' }), '/tmp')
    expect(files[0]?.relativePath).toBe('.github/skills/analyze-schema/SKILL.md')
  })

  it('starts with --- on line 1 (frontmatter before managed header)', () => {
    const files = adapter.emitCommand(makeAsset(), '/tmp')
    const content = files[0]?.content as string
    expect(content.startsWith('---')).toBe(true)
  })
})
