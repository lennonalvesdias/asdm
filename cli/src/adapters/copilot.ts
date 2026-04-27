/**
 * GitHub Copilot Emit Adapter
 *
 * Emits assets in GitHub Copilot-native format.
 *
 * Emission mapping:
 *   Agent   → .github/agents/{name}.agent.md (with YAML frontmatter)
 *   Skill   → .github/skills/{name}/SKILL.md
 *   Command → .github/skills/{name}/SKILL.md (as a Copilot skill / CLI slash command)
 *   Root    → .github/copilot-instructions.md (agents + commands + skills summary)
 *   Config  → (none)
 */

import path from 'node:path'
import { exists, listFiles, readFile, removeFile } from '../utils/fs.js'
import type { EmitAdapter, EmittedFile } from './base.js'
import { createEmittedFile, managedFileHeader } from './base.js'
import type { ParsedAsset } from '../core/parser.js'
import type { ResolvedProfile } from '../core/profile-resolver.js'

const ADAPTER_NAME = 'copilot'

/** Format an agent as a Copilot .agent.md file with YAML frontmatter */
function formatAgentContent(parsed: ParsedAsset): string {
  const frontmatter = [
    '---',
    `name: ${parsed.name}`,
    `description: ${parsed.description}`,
    '---',
    '',
  ].join('\n')

  return [frontmatter, '', managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

/** Format a command as a Copilot SKILL.md file (slash-command equivalent for CLI) */
function formatCommandAsSkill(parsed: ParsedAsset): string {
  const frontmatter = [
    '---',
    `name: ${parsed.name}`,
    `description: ${parsed.description}`,
    '---',
    '',
  ].join('\n')

  return [frontmatter, '', managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

/** Format a skill as a Copilot SKILL.md file */
function formatSkillContent(parsed: ParsedAsset): string {
  const frontmatter = [
    '---',
    `name: ${parsed.name}`,
    `description: ${parsed.description}`,
    '---',
  ].join('\n')

  return [frontmatter, '', managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

/** Generate .github/copilot-instructions.md aggregating agents, commands, and skills */
function generateCopilotInstructions(profile: ResolvedProfile): string {
  const lines: string[] = [
    managedFileHeader(ADAPTER_NAME),
    '',
    '# GitHub Copilot Instructions',
    '',
  ]

  if (profile.agents.length > 0) {
    lines.push('## Active Agents', '')
    for (const agent of profile.agents) {
      lines.push(`- **${agent}**: See \`.github/agents/${agent}.agent.md\``)
    }
    lines.push('')
  }

  if (profile.commands.length > 0) {
    lines.push('## Commands Available', '')
    lines.push('The following commands are available as Copilot skills.')
    lines.push('Invoke with `/command-name` or describe the task naturally.', '')
    for (const cmd of profile.commands) {
      lines.push(`- **${cmd}**: See \`.github/skills/${cmd}/SKILL.md\``)
    }
    lines.push('')
  }

  if (profile.skills.length > 0) {
    lines.push('## Skills', '')
    lines.push('The following skills are configured for this workspace:')
    for (const skill of profile.skills) {
      lines.push(`- **${skill}**: See \`.github/skills/${skill}/SKILL.md\``)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export class CopilotAdapter implements EmitAdapter {
  readonly name = ADAPTER_NAME

  emitAgent(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.github/agents/${parsed.name}.agent.md`
    const content = formatAgentContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitSkill(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.github/skills/${parsed.name}/SKILL.md`
    const content = formatSkillContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitCommand(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    // NOTE: Copilot has no native commands directory. Commands are mapped to the
    // skills namespace (.github/skills/) so they are invocable as /command-name
    // in Copilot CLI. If a skill and a command share the same name, the command
    // takes precedence (syncer emits skills before commands, so command overwrites).
    const relativePath = `.github/skills/${parsed.name}/SKILL.md`
    const content = formatCommandAsSkill(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitRootInstructions(profile: ResolvedProfile, _targetDir: string): EmittedFile[] {
    const content = generateCopilotInstructions(profile)
    return [
      createEmittedFile('.github/copilot-instructions.md', content, ADAPTER_NAME, 'root'),
    ]
  }

  emitConfig(_profile: ResolvedProfile, _targetDir: string): EmittedFile[] {
    return []
  }

  /**
   * Remove all ASDM-managed files from .github/ in the given project root.
   * Returns the list of absolute paths that were removed.
   */
  async clean(projectRoot: string): Promise<string[]> {
    const githubDir = path.join(projectRoot, '.github')

    if (!await exists(githubDir)) return []

    const allFiles = await listFiles(githubDir)
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

export function createCopilotAdapter(): CopilotAdapter {
  return new CopilotAdapter()
}
