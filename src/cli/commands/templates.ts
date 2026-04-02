/**
 * asdm templates — Scaffold new .asdm.md asset files from built-in templates.
 *
 * Sub-commands:
 *   agent    Scaffold an agent definition (.asdm.md)
 *   skill    Scaffold a skill definition (.asdm.md)
 *   command  Scaffold a slash-command definition (.asdm.md)
 *
 * Arguments:
 *   <name>             Required. The asset identifier (used in frontmatter and filename)
 *
 * Options:
 *   --output <dir>     Directory to write the file (default: CWD)
 *   --force            Overwrite existing file without prompting
 */

import { defineCommand } from 'citty'
import path from 'node:path'
import { exists, writeFile } from '../../utils/fs.js'
import { logger } from '../../utils/logger.js'

// ─────────────────────────────────────────────
// Template generators — exported for unit tests
// ─────────────────────────────────────────────

/** Generate frontmatter + body for an agent `.asdm.md` file */
export function generateAgentTemplate(name: string): string {
  return `---
name: ${name}
type: agent
description: "Short description"
version: "1.0.0"
tags:
  - tag1
  - tag2
providers:
  opencode:
    model: claude-sonnet-4-5
    permissions: {}
    tools: []
  claude-code:
    model: claude-opus-4-5
    allowedTools: []
  copilot:
    on:
      push:
        branches: [main]
    permissions:
      contents: read
---

# ${name}

## Role
Describe the agent's primary responsibility here.

## Instructions
- Instruction 1
- Instruction 2

## Guidelines
- Guideline 1
- Guideline 2
`
}

/** Generate frontmatter + body for a skill `.asdm.md` file */
export function generateSkillTemplate(name: string): string {
  return `---
name: ${name}
type: skill
description: "Short description"
version: "1.0.0"
tags:
  - tag1
---

# ${name}

## Overview
Describe the skill purpose.

## Usage
How to use this skill.

## Examples
- Example 1
- Example 2
`
}

/** Generate frontmatter + body for a command `.asdm.md` file */
export function generateCommandTemplate(name: string): string {
  return `---
name: ${name}
type: command
description: "Short description"
version: "1.0.0"
tags:
  - tag1
---

# /${name}

## Description
What this command does.

## Usage
\`/${name} [options]\`

## Examples
- \`/${name}\` — basic usage
`
}

// ─────────────────────────────────────────────
// Shared write helper — exported for unit tests
// ─────────────────────────────────────────────

/** Write a template file to disk, respecting the --force flag */
export async function writeTemplateFile(
  outputDir: string,
  name: string,
  content: string,
  force: boolean,
): Promise<void> {
  const filePath = path.join(outputDir, `${name}.asdm.md`)
  const alreadyExists = await exists(filePath)

  if (alreadyExists && !force) {
    logger.error(
      `File already exists: ${filePath}`,
      'Use --force to overwrite',
    )
    process.exitCode = 1
    return
  }

  await writeFile(filePath, content)
  logger.success(`Created ${filePath}`)
}

// ─────────────────────────────────────────────
// Sub-commands
// ─────────────────────────────────────────────

const agentCommand = defineCommand({
  meta: {
    name: 'agent',
    description: 'Scaffold an agent definition (.asdm.md)',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Agent identifier (used as filename and frontmatter name)',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Output directory (default: current working directory)',
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing file',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const outputDir = ctx.args.output ?? cwd
    await writeTemplateFile(outputDir, ctx.args.name, generateAgentTemplate(ctx.args.name), ctx.args.force)
  },
})

const skillCommand = defineCommand({
  meta: {
    name: 'skill',
    description: 'Scaffold a skill definition (.asdm.md)',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Skill identifier (used as filename and frontmatter name)',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Output directory (default: current working directory)',
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing file',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const outputDir = ctx.args.output ?? cwd
    await writeTemplateFile(outputDir, ctx.args.name, generateSkillTemplate(ctx.args.name), ctx.args.force)
  },
})

const commandCommand = defineCommand({
  meta: {
    name: 'command',
    description: 'Scaffold a slash-command definition (.asdm.md)',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Command identifier (used as filename and frontmatter name)',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Output directory (default: current working directory)',
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing file',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const outputDir = ctx.args.output ?? cwd
    await writeTemplateFile(outputDir, ctx.args.name, generateCommandTemplate(ctx.args.name), ctx.args.force)
  },
})

// ─────────────────────────────────────────────
// Root templates command
// ─────────────────────────────────────────────

export default defineCommand({
  meta: {
    name: 'templates',
    description: 'Scaffold new .asdm.md asset files from built-in templates',
  },
  subCommands: {
    agent: agentCommand,
    skill: skillCommand,
    command: commandCommand,
  },
})
