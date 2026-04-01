/**
 * OpenCode Emit Adapter
 * 
 * Emits assets in OpenCode-native format.
 * Detects whether OCX is installed and adjusts config accordingly.
 * 
 * Emission mapping:
 *   Agent   → .opencode/agents/{name}.md
 *   Skill   → .opencode/skills/{name}/SKILL.md
 *   Command → .opencode/commands/{name}.md
 *   Root    → AGENTS.md (with <available_skills> block)
 *   Config  → .opencode/opencode.jsonc
 */

import path from 'node:path'
import { exists } from '../utils/fs.js'
import type { EmitAdapter, EmittedFile } from './base.js'
import { createEmittedFile, managedFileHeader, managedJsonHeader } from './base.js'
import type { ParsedAsset } from '../core/parser.js'
import type { ResolvedProfile } from '../core/profile-resolver.js'

const ADAPTER_NAME = 'opencode'

/** Detect if OCX is installed on the system */
async function detectOcx(): Promise<boolean> {
  const os = await import('node:os')
  const home = os.homedir()

  // Check common OCX config locations
  const ocxPaths = [
    path.join(home, '.config', 'ocx'),
    path.join(home, '.ocx'),
  ]

  for (const p of ocxPaths) {
    if (await exists(p)) return true
  }
  return false
}

/** Format an agent as an OpenCode .md agent file */
function formatAgentContent(parsed: ParsedAsset): string {
  const lines: string[] = [
    managedFileHeader(ADAPTER_NAME),
    '',
  ]

  // OpenCode agents use a simple markdown format
  // The body contains the actual instructions
  lines.push(parsed.body)

  return lines.join('\n')
}

/** Format a skill as an OpenCode SKILL.md file */
function formatSkillContent(parsed: ParsedAsset): string {
  return [
    managedFileHeader(ADAPTER_NAME),
    '',
    parsed.body,
  ].join('\n')
}

/** Format a command as an OpenCode command file */
function formatCommandContent(parsed: ParsedAsset): string {
  return [
    managedFileHeader(ADAPTER_NAME),
    '',
    parsed.body,
  ].join('\n')
}

/** Generate opencode.jsonc config */
function generateOpencodeConfig(
  profile: ResolvedProfile,
  hasOcx: boolean
): string {
  const providerConfig = profile.provider_config['opencode'] as {
    mcp_servers?: Array<{ name: string; command: string; args?: string[] }>
    theme?: string
    model?: string
  } | undefined ?? {}

  const config: Record<string, unknown> = {}

  // Theme
  if (providerConfig.theme) {
    config['theme'] = providerConfig.theme
  }

  // MCP Servers
  if (providerConfig.mcp_servers && providerConfig.mcp_servers.length > 0) {
    config['mcp'] = {
      servers: providerConfig.mcp_servers.reduce((acc, srv) => {
        acc[srv.name] = {
          command: srv.command,
          args: srv.args ?? [],
        }
        return acc
      }, {} as Record<string, unknown>),
    }
  }

  // If OCX is present, add registry reference
  if (hasOcx) {
    config['$schema'] = 'https://opencode.ai/config.json'
  }

  const json = JSON.stringify(config, null, 2)
  return `${managedJsonHeader(ADAPTER_NAME)}\n${json}\n`
}

/** Generate AGENTS.md with available skills section */
function generateAgentsMd(profile: ResolvedProfile): string {
  const lines: string[] = [
    managedFileHeader(ADAPTER_NAME),
    '',
    '# AI Agent Instructions',
    '',
    'This project uses ASDM-managed AI agents and skills.',
    '',
  ]

  if (profile.agents.length > 0) {
    lines.push('## Available Agents', '')
    for (const agent of profile.agents) {
      lines.push(`- **${agent}**: See \`.opencode/agents/${agent}.md\``)
    }
    lines.push('')
  }

  if (profile.skills.length > 0) {
    lines.push('<available_skills>')
    for (const skill of profile.skills) {
      lines.push(`  <skill location=".opencode/skills/${skill}/SKILL.md" />`)
    }
    lines.push('</available_skills>')
    lines.push('')
  }

  if (profile.commands.length > 0) {
    lines.push('## Slash Commands', '')
    for (const cmd of profile.commands) {
      lines.push(`- \`/${cmd}\`: See \`.opencode/commands/${cmd}.md\``)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export class OpenCodeAdapter implements EmitAdapter {
  readonly name = ADAPTER_NAME
  private ocxDetected: boolean | null = null

  private async isOcxAvailable(): Promise<boolean> {
    if (this.ocxDetected === null) {
      this.ocxDetected = await detectOcx()
    }
    return this.ocxDetected
  }

  emitAgent(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.opencode/agents/${parsed.name}.md`
    const content = formatAgentContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitSkill(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.opencode/skills/${parsed.name}/SKILL.md`
    const content = formatSkillContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitCommand(parsed: ParsedAsset, _targetDir: string): EmittedFile[] {
    const relativePath = `.opencode/commands/${parsed.name}.md`
    const content = formatCommandContent(parsed)
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, parsed.sourcePath)]
  }

  emitRootInstructions(profile: ResolvedProfile, _targetDir: string): EmittedFile[] {
    const content = generateAgentsMd(profile)
    return [createEmittedFile('AGENTS.md', content, ADAPTER_NAME, 'root')]
  }

  async emitConfigAsync(profile: ResolvedProfile, _targetDir: string): Promise<EmittedFile[]> {
    const hasOcx = await this.isOcxAvailable()
    const content = generateOpencodeConfig(profile, hasOcx)
    const relativePath = '.opencode/opencode.jsonc'
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, 'config')]
  }

  // Synchronous version (OCX detection skipped — used when sync is not needed)
  emitConfig(profile: ResolvedProfile, _targetDir: string): EmittedFile[] {
    const content = generateOpencodeConfig(profile, false)
    const relativePath = '.opencode/opencode.jsonc'
    return [createEmittedFile(relativePath, content, ADAPTER_NAME, 'config')]
  }
}

export function createOpenCodeAdapter(): OpenCodeAdapter {
  return new OpenCodeAdapter()
}
