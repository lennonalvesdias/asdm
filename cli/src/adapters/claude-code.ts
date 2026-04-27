/**
 * Claude Code Emit Adapter
 *
 * Emits assets in Claude Code-native format.
 *
 * Emission mapping:
 *   Agent   → .claude/agents/{name}.md
 *   Skill   → .claude/skills/{name}/SKILL.md
 *   Command → .claude/commands/{name}.md
 *   Root    → .claude/CLAUDE.md (agent list + available_skills XML block)
 *   Config  → (none in Phase 2)
 */

import path from 'node:path'
import { exists, listFiles, readFile, removeFile } from '../utils/fs.js'
import type { EmitAdapter, EmittedFile } from './base.js'
import { createEmittedFile, managedFileHeader } from './base.js'
import type { ParsedAsset } from '../core/parser.js'
import type { ResolvedProfile } from '../core/profile-resolver.js'

const ADAPTER_NAME = 'claude-code'

/** Format an agent as a Claude Code .md agent file */
function formatAgentContent(parsed: ParsedAsset): string {
  return [managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

/** Format a skill as a Claude Code SKILL.md file */
function formatSkillContent(parsed: ParsedAsset): string {
  return [managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

/** Format a command as a Claude Code command file */
function formatCommandContent(parsed: ParsedAsset): string {
  return [managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

/** Generate .claude/CLAUDE.md with agent list + available_skills XML block */
function generateClaudeMd(profile: ResolvedProfile): string {
  const lines: string[] = [
    managedFileHeader(ADAPTER_NAME),
    '',
    '# AI Assistant Configuration',
    '',
  ]

  if (profile.agents.length > 0) {
    lines.push('## Active Agents', '')
    for (const agent of profile.agents) {
      lines.push(`- **${agent}**: See \`.claude/agents/${agent}.md\``)
    }
    lines.push('')
  }

  if (profile.skills.length > 0) {
    lines.push('## Available Skills', '')
    lines.push('The following skills are available:', '')
    lines.push('<available_skills>')
    for (const skill of profile.skills) {
      lines.push(`  <skill>`)
      lines.push(`    <name>${skill}</name>`)
      lines.push(`    <location>.claude/skills/${skill}/SKILL.md</location>`)
      lines.push(`  </skill>`)
    }
    lines.push('</available_skills>')
    lines.push('')
  }

  if (profile.commands.length > 0) {
    lines.push('## Slash Commands', '')
    for (const cmd of profile.commands) {
      lines.push(`- \`/${cmd}\`: See \`.claude/commands/${cmd}.md\``)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export class ClaudeCodeAdapter implements EmitAdapter {
  readonly name = ADAPTER_NAME

  emitAgent(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.claude/agents/${parsed.name}.md`
    const content = formatAgentContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitSkill(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.claude/skills/${parsed.name}/SKILL.md`
    const content = formatSkillContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitCommand(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.claude/commands/${parsed.name}.md`
    const content = formatCommandContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitRootInstructions(profile: ResolvedProfile, _targetDir: string): EmittedFile[] {
    const content = generateClaudeMd(profile)
    return [createEmittedFile('.claude/CLAUDE.md', content, ADAPTER_NAME, 'root')]
  }

  emitConfig(_profile: ResolvedProfile, _targetDir: string): EmittedFile[] {
    return []
  }

  /**
   * Remove all ASDM-managed files from .claude/ in the given project root.
   * Returns the list of absolute paths that were removed.
   */
  async clean(projectRoot: string): Promise<string[]> {
    const claudeDir = path.join(projectRoot, '.claude')

    if (!await exists(claudeDir)) return []

    const allFiles = await listFiles(claudeDir)
    const removedPaths: string[] = []

    for (const filePath of allFiles) {
      const content = await readFile(filePath)
      if (content && content.includes('ASDM MANAGED FILE')) {
        await removeFile(filePath)
        removedPaths.push(filePath)
      }
    }

    return removedPaths
  }
}

export function createClaudeCodeAdapter(): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter()
}
