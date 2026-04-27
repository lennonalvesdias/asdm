/**
 * Parser for canonical ASDM format (.md files).
 *
 * Each .md file has:
 *   - YAML frontmatter between --- delimiters
 *   - Markdown body with agent/skill/command instructions
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { hashString } from './hash.js'
import { ParseError } from '../utils/errors.js'

export type AssetType = 'agent' | 'skill' | 'command'

export interface ParsedAsset {
  name: string
  type: AssetType
  version: string
  description: string
  frontmatter: Record<string, unknown>
  providerConfig: Record<string, unknown>
  body: string
  sourcePath: string
  sha256: string
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

/**
 * Parse a .md file content into a structured ParsedAsset.
 *
 * @param content - Raw file content (frontmatter + markdown body)
 * @param sourcePath - Relative path of the source file (for error messages)
 * @param provider - Active provider name to extract provider-specific config
 */
export function parseAsset(
  content: string,
  sourcePath: string,
  provider = 'opencode'
): ParsedAsset {
  const match = content.match(FRONTMATTER_REGEX)

  if (!match) {
    throw new ParseError(
      `Failed to parse frontmatter in ${sourcePath}`,
      'Ensure the file has valid YAML frontmatter between --- delimiters'
    )
  }

  const [, frontmatterRaw, body] = match

  let frontmatter: Record<string, unknown>
  try {
    frontmatter = parseYaml(frontmatterRaw) as Record<string, unknown>
  } catch (err) {
    throw new ParseError(
      `Invalid YAML frontmatter in ${sourcePath}: ${(err as Error).message}`,
      'Validate the frontmatter with a YAML linter'
    )
  }

  const name = frontmatter['name']
  const type = frontmatter['type']
  const version = frontmatter['version']
  const description = frontmatter['description']

  if (typeof name !== 'string') {
    throw new ParseError(`Missing required field 'name' in ${sourcePath}`)
  }
  if (type !== 'agent' && type !== 'skill' && type !== 'command') {
    throw new ParseError(
      `Invalid type '${String(type)}' in ${sourcePath}`,
      "Type must be one of: 'agent', 'skill', 'command'"
    )
  }
  if (typeof version !== 'string') {
    throw new ParseError(`Missing required field 'version' in ${sourcePath}`)
  }
  if (typeof description !== 'string') {
    throw new ParseError(`Missing required field 'description' in ${sourcePath}`)
  }

  const providers = frontmatter['providers'] as Record<string, unknown> | undefined ?? {}
  const providerConfig = (providers[provider] as Record<string, unknown>) ?? {}

  const sha256 = hashString(content)

  return {
    name,
    type: type as AssetType,
    version,
    description,
    frontmatter,
    providerConfig,
    body: body.trim(),
    sourcePath,
    sha256,
  }
}

/**
 * Serialize frontmatter and body back to .md format.
 * Useful for tests and round-trip verification.
 */
export function serializeAsset(frontmatter: Record<string, unknown>, body: string): string {
  return `---\n${stringifyYaml(frontmatter)}---\n\n${body}\n`
}
