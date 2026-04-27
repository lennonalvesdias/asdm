/**
 * ASDM CLI — Agentic Software Delivery Model
 *
 * Write Once, Emit Many.
 *
 * Entry point: defines the root command, registers all sub-commands,
 * and delegates to citty's runMain.
 */

import { defineCommand, runMain } from 'citty'

import initCommand from './commands/init.js'
import syncCommand from './commands/sync.js'
import verifyCommand from './commands/verify.js'
import statusCommand from './commands/status.js'
import useCommand from './commands/use.js'
import profilesCommand from './commands/profiles.js'
import agentsCommand from './commands/agents.js'
import skillsCommand from './commands/skills.js'
import commandsCommand from './commands/commands.js'
import versionCommand from './commands/version.js'
import doctorCommand from './commands/doctor.js'
import cleanCommand from './commands/clean.js'
import hooksCommand from './commands/hooks.js'
import gitignoreCommand from './commands/gitignore.js'
import telemetryCommand from './commands/telemetry.js'
import templatesCommand from './commands/templates.js'
import updateCommand from './commands/update.js'
import setupCommand from './commands/setup.js'
import { checkForUpdate } from '../core/version-check.js'

const rootCommand = defineCommand({
  meta: {
    name: 'asdm',
    version: __ASDM_VERSION__,
    description: 'Agentic Software Delivery Model — Write Once, Emit Many',
  },
  subCommands: {
    init: initCommand,
    sync: syncCommand,
    verify: verifyCommand,
    status: statusCommand,
    use: useCommand,
    profiles: profilesCommand,
    agents: agentsCommand,
    skills: skillsCommand,
    commands: commandsCommand,
    version: versionCommand,
    doctor: doctorCommand,
    clean: cleanCommand,
    hooks: hooksCommand,
    gitignore: gitignoreCommand,
    telemetry: telemetryCommand,
    templates: templatesCommand,
    update: updateCommand,
    setup: setupCommand,
  },
})

/** Render a bordered update-notification box to stdout */
function printUpdateBox(currentVersion: string, latestVersion: string): void {
  const YELLOW = '\x1b[33m'
  const BOLD = '\x1b[1m'
  const RESET = '\x1b[0m'

  const updateLine = `  Update available: ${currentVersion} \u2192 ${latestVersion}`
  const cmdLine    = `  Run: npm install -g asdm-cli`

  const MIN_WIDTH = 45
  const innerWidth = Math.max(
    Math.max(updateLine.length, cmdLine.length) + 2,
    MIN_WIDTH
  )

  const top = `\u256D${'─'.repeat(innerWidth)}\u256E`
  const r1  = `\u2502${updateLine.padEnd(innerWidth)}\u2502`
  const r2  = `\u2502${cmdLine.padEnd(innerWidth)}\u2502`
  const bot = `\u2570${'─'.repeat(innerWidth)}\u256F`

  console.log(`\n${YELLOW}${BOLD}${top}\n${r1}\n${r2}\n${bot}${RESET}`)
}

async function main(): Promise<void> {
  await runMain(rootCommand)

  // Skip version check if command already set exit code (e.g. error)
  if (process.exitCode !== undefined && process.exitCode !== 0) return

  try {
    const latestVersion = await checkForUpdate(__ASDM_VERSION__)
    if (latestVersion) {
      printUpdateBox(__ASDM_VERSION__, latestVersion)
    }
  } catch {
    // Intentionally silent
  }
}

main().catch(() => {})
