/**
 * Agents Dir Emit Adapter
 *
 * Emits assets to the ~/.agents cross-provider standard directory.
 * This is a provider-agnostic standard location recognised by multiple
 * AI coding tools (opencode, copilot, claude-code, cursor, etc.).
 *
 * Emission mapping:
 *   Agent   → .agents/agents/{name}.md
 *   Skill   → .agents/skills/{name}/SKILL.md
 *   Command → .agents/commands/{name}.md
 *   Root    → (not applicable — no single root instructions file)
 *   Config  → (not applicable — no provider config file)
 */

import path from 'node:path'
import { exists, listFiles, readFile, removeFile } from '../utils/fs.js'
import type { EmitAdapter, EmittedFile } from './base.js'
import { createEmittedFile, managedFileHeader } from './base.js'
import type { ParsedAsset } from '../core/parser.js'
import type { ResolvedProfile } from '../core/profile-resolver.js'

const ADAPTER_NAME = 'agents-dir'

/** Format an agent as a plain markdown file — header + body, no provider YAML */
function formatAgentContent(parsed: ParsedAsset): string {
  return [managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

/** Format a skill as a plain markdown SKILL.md file — header + body */
function formatSkillContent(parsed: ParsedAsset): string {
  return [managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

/** Format a command as a plain markdown file — header + body */
function formatCommandContent(parsed: ParsedAsset): string {
  return [managedFileHeader(ADAPTER_NAME), '', parsed.body].join('\n')
}

export class AgentsDirAdapter implements EmitAdapter {
  readonly name = ADAPTER_NAME

  emitAgent(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.agents/agents/${parsed.name}.md`
    const content = formatAgentContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitSkill(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.agents/skills/${parsed.name}/SKILL.md`
    const content = formatSkillContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitCommand(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.agents/commands/${parsed.name}.md`
    const content = formatCommandContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitRootInstructions(_profile: ResolvedProfile, _targetDir: string): EmittedFile[] {
    // No single root instructions file for the agents-dir provider
    return []
  }

  emitConfig(_profile: ResolvedProfile, _targetDir: string): EmittedFile[] {
    // No provider config file for the agents-dir provider
    return []
  }

  /**
   * Remove all ASDM-managed files from .agents/ in the given project root.
   * Returns the list of absolute paths that were removed.
   */
  async clean(projectRoot: string): Promise<string[]> {
    const agentsDir = path.join(projectRoot, '.agents')

    if (!await exists(agentsDir)) return []

    const allFiles = await listFiles(agentsDir)
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

export function createAgentsDirAdapter(): AgentsDirAdapter {
  return new AgentsDirAdapter()
}
