import { describe, it, expect } from 'vitest'
import { parseAsset } from '../../../src/core/parser.js'
import { ParseError } from '../../../src/utils/errors.js'

const VALID_AGENT = `---
name: code-reviewer
type: agent
description: "Revisa PRs com foco em segurança, performance e clean code"
version: 1.3.0
tags:
  - review
  - security

providers:
  opencode:
    model: anthropic/claude-sonnet-4
    permissions:
      - read
      - write
  claude-code:
    model: claude-sonnet-4-20250514
---

# Code Reviewer

Você é um code reviewer sênior.
`

describe('parseAsset', () => {
  it('parses a valid agent', () => {
    const asset = parseAsset(VALID_AGENT, 'agents/code-reviewer.asdm.md', 'opencode')
    expect(asset.name).toBe('code-reviewer')
    expect(asset.type).toBe('agent')
    expect(asset.version).toBe('1.3.0')
    expect(asset.body).toBe('# Code Reviewer\n\nVocê é um code reviewer sênior.')
  })

  it('extracts provider-specific config', () => {
    const asset = parseAsset(VALID_AGENT, 'agents/code-reviewer.asdm.md', 'opencode')
    expect(asset.providerConfig).toMatchObject({
      model: 'anthropic/claude-sonnet-4',
      permissions: ['read', 'write'],
    })
  })

  it('extracts claude-code provider config', () => {
    const asset = parseAsset(VALID_AGENT, 'agents/code-reviewer.asdm.md', 'claude-code')
    expect(asset.providerConfig).toMatchObject({
      model: 'claude-sonnet-4-20250514',
    })
  })

  it('returns empty providerConfig for unknown provider', () => {
    const asset = parseAsset(VALID_AGENT, 'agents/code-reviewer.asdm.md', 'cursor')
    expect(asset.providerConfig).toEqual({})
  })

  it('computes sha256', () => {
    const asset = parseAsset(VALID_AGENT, 'test.asdm.md')
    expect(asset.sha256).toHaveLength(64)
    expect(asset.sha256).toMatch(/^[a-f0-9]+$/)
  })

  it('throws ParseError for missing frontmatter', () => {
    expect(() => parseAsset('no frontmatter here', 'test.asdm.md')).toThrow(ParseError)
  })

  it('throws ParseError for missing name', () => {
    const bad = `---
type: agent
description: "desc"
version: 1.0.0
---
body
`
    expect(() => parseAsset(bad, 'test.asdm.md')).toThrow(ParseError)
  })

  it('throws ParseError for invalid type', () => {
    const bad = `---
name: foo
type: invalid
description: "desc"
version: 1.0.0
---
body
`
    expect(() => parseAsset(bad, 'test.asdm.md')).toThrow(ParseError)
  })
})
