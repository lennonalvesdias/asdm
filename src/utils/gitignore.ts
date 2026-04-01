/**
 * Gitignore utilities for ASDM managed output directories.
 *
 * Many teams deliberately commit emitted files so teammates don't need to run
 * `asdm sync` on every clone. The gitignore helpers are therefore opt-in:
 *   - `getGitignoreEntries` returns lines for a given provider list
 *   - `updateGitignore` wraps them in an ASDM block and appends to .gitignore
 *   - `removeGitignoreBlock` strips the block when no longer needed
 *
 * The managed block is fenced with:
 *   # ASDM MANAGED — start
 *   # ASDM MANAGED — end
 *
 * Re-running updateGitignore is idempotent: if the entries match the existing
 * block, the file is not written.
 */

import path from 'node:path'
import { readFile, writeFile } from './fs.js'

export const ASDM_MARKER_START = '# ASDM MANAGED — start'
export const ASDM_MARKER_END = '# ASDM MANAGED — end'

const PROVIDER_ENTRIES: Readonly<Record<string, string[]>> = {
  opencode: [
    '.opencode/agents/',
    '.opencode/skills/',
    '.opencode/commands/',
  ],
  'claude-code': [
    '.claude/agents/',
    '.claude/skills/',
    '.claude/commands/',
    '.claude/CLAUDE.md',
  ],
  copilot: [
    '.github/agents/',
    '.github/skills/',
    '.github/copilot-instructions.md',
  ],
}

/**
 * Returns the .gitignore lines for the given list of providers.
 * Only includes entries for providers that are recognised.
 */
export function getGitignoreEntries(emit: string[]): string[] {
  const lines: string[] = []
  for (const provider of emit) {
    const entries = PROVIDER_ENTRIES[provider]
    if (entries) lines.push(...entries)
  }
  return lines
}

/** Build the fenced ASDM block string (no trailing newline). */
function buildBlock(entries: string[]): string {
  return [ASDM_MARKER_START, ...entries, ASDM_MARKER_END].join('\n')
}

/** Extract the ASDM block string from file content, or '' if absent. */
function extractExistingBlock(content: string): string {
  const startIdx = content.indexOf(ASDM_MARKER_START)
  const endIdx = content.indexOf(ASDM_MARKER_END)
  if (startIdx === -1 || endIdx === -1) return ''
  return content.slice(startIdx, endIdx + ASDM_MARKER_END.length)
}

/** Replace the existing ASDM block with newBlock, preserving surrounding content. */
function replaceBlock(content: string, newBlock: string): string {
  const startIdx = content.indexOf(ASDM_MARKER_START)
  const endIdx = content.indexOf(ASDM_MARKER_END)
  if (startIdx === -1 || endIdx === -1) return content
  return (
    content.slice(0, startIdx) +
    newBlock +
    content.slice(endIdx + ASDM_MARKER_END.length)
  )
}

/**
 * Appends ASDM entries to .gitignore if not already present (or updates them).
 * Returns true if the file was modified.
 */
export async function updateGitignore(projectRoot: string, emit: string[]): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, '.gitignore')
  const entries = getGitignoreEntries(emit)

  if (entries.length === 0) return false

  const existing = (await readFile(gitignorePath)) ?? ''
  const newBlock = buildBlock(entries)

  if (existing.includes(ASDM_MARKER_START)) {
    const currentBlock = extractExistingBlock(existing)
    if (currentBlock === newBlock) return false

    const newContent = replaceBlock(existing, newBlock)
    await writeFile(gitignorePath, newContent)
    return true
  }

  // No existing block — append after existing content
  const newContent = existing
    ? existing.trimEnd() + '\n\n' + newBlock + '\n'
    : newBlock + '\n'

  await writeFile(gitignorePath, newContent)
  return true
}

/**
 * Removes the ASDM managed block from .gitignore.
 * Returns true if the file was modified.
 */
export async function removeGitignoreBlock(projectRoot: string): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, '.gitignore')
  const existing = await readFile(gitignorePath)

  if (existing === null || !existing.includes(ASDM_MARKER_START)) return false

  const startIdx = existing.indexOf(ASDM_MARKER_START)
  const endIdx = existing.indexOf(ASDM_MARKER_END)
  if (endIdx === -1) return false

  const before = existing.slice(0, startIdx).trimEnd()
  const after = existing.slice(endIdx + ASDM_MARKER_END.length).trimStart()
  const newContent = before + (after ? '\n' + after : '') + '\n'

  await writeFile(gitignorePath, newContent)
  return true
}
