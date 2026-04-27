/**
 * asdm setup — Validate and configure the ASDM environment.
 *
 * Checks:
 *   1. Node.js version meets requirements (>=18)
 *   2. gh CLI is installed
 *   3. gh CLI is authenticated
 *
 * If any check fails, guides the user through fixing it.
 * On success, all prerequisites are satisfied to use ASDM.
 */

import { defineCommand } from 'citty'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import os from 'node:os'
import { logger } from '../../utils/logger.js'

const execFileAsync = promisify(execFile)

interface SetupCheck {
  label: string
  status: 'ok' | 'fail' | 'warn'
  detail?: string
}

async function checkNodeVersion(): Promise<SetupCheck> {
  const version = process.version  // e.g. "v20.11.0"
  const major = parseInt(version.slice(1).split('.')[0] ?? '0', 10)
  if (major >= 18) {
    return { label: `Node.js version (${version})`, status: 'ok' }
  }
  return {
    label: `Node.js version (${version})`,
    status: 'fail',
    detail: 'ASDM requires Node.js >=18. Download from https://nodejs.org',
  }
}

async function checkGhInstalled(): Promise<SetupCheck> {
  try {
    const { stdout } = await execFileAsync('gh', ['--version'], {
      timeout: 5000,
      windowsHide: true,
    })
    const versionLine = stdout.trim().split('\n')[0] ?? 'gh'
    return { label: `gh CLI installed (${versionLine})`, status: 'ok' }
  } catch {
    const installInstructions = getGhInstallInstructions()
    return {
      label: 'gh CLI installed',
      status: 'fail',
      detail: `Not found. ${installInstructions}`,
    }
  }
}

function getGhInstallInstructions(): string {
  const platform = process.platform
  if (platform === 'darwin') {
    return 'Install with: brew install gh'
  }
  if (platform === 'win32') {
    return 'Install with: winget install --id GitHub.cli  (or choco install gh)'
  }
  // Linux
  return 'Install from: https://github.com/cli/cli/blob/trunk/docs/install_linux.md'
}

async function checkGhAuth(): Promise<SetupCheck> {
  try {
    const { stdout, stderr } = await execFileAsync('gh', ['auth', 'status'], {
      timeout: 10000,
      windowsHide: true,
    })
    const output = (stdout + stderr).toLowerCase()
    if (output.includes('logged in') || output.includes('token')) {
      // Extract the account name if possible
      const accountMatch = (stdout + stderr).match(/Logged in to [^\s]+ account ([^\s]+)/)
      const account = accountMatch ? ` as ${accountMatch[1]}` : ''
      return { label: `gh CLI authenticated${account}`, status: 'ok' }
    }
    return {
      label: 'gh CLI authenticated',
      status: 'fail',
      detail: 'Not authenticated. Run: gh auth login',
    }
  } catch {
    return {
      label: 'gh CLI authenticated',
      status: 'fail',
      detail: 'Not authenticated. Run: gh auth login',
    }
  }
}

async function runGhAuthLogin(): Promise<boolean> {
  try {
    // Run gh auth login interactively
    await execFileAsync('gh', ['auth', 'login'], {
      timeout: 120_000,
      // stdio must inherit for interactive prompts
    })
    return true
  } catch {
    return false
  }
}

export default defineCommand({
  meta: {
    name: 'setup',
    description: 'Validate and configure the ASDM environment',
  },
  args: {
    fix: {
      type: 'boolean',
      description: 'Attempt to fix issues automatically (runs gh auth login if needed)',
      default: false,
    },
  },
  async run(ctx) {
    logger.asdm('ASDM Setup')
    logger.divider()
    logger.info(`Platform: ${os.type()} ${os.release()} (${process.platform})`)
    logger.divider()

    const checks: SetupCheck[] = []
    let anyFailed = false

    // Check 1: Node.js version
    const nodeCheck = await checkNodeVersion()
    checks.push(nodeCheck)
    if (nodeCheck.status === 'fail') anyFailed = true

    // Check 2: gh CLI installed
    const ghInstallCheck = await checkGhInstalled()
    checks.push(ghInstallCheck)
    const ghInstalled = ghInstallCheck.status === 'ok'
    if (!ghInstalled) anyFailed = true

    // Check 3: gh CLI authenticated (only if installed)
    let ghAuthCheck: SetupCheck
    if (ghInstalled) {
      ghAuthCheck = await checkGhAuth()
      checks.push(ghAuthCheck)
      if (ghAuthCheck.status === 'fail') anyFailed = true
    } else {
      ghAuthCheck = { label: 'gh CLI authenticated', status: 'fail', detail: 'Skipped — gh not installed' }
      checks.push(ghAuthCheck)
    }

    // Print results
    for (const check of checks) {
      logger.status(check.label, check.status, check.detail)
    }

    logger.divider()

    if (!anyFailed) {
      logger.success('All checks passed — ASDM is ready to use!')
      logger.info("Run 'asdm init' to configure a global profile, then 'asdm sync' to install agents.")
      return
    }

    // Guidance for failures
    console.log()
    logger.warn('Some checks failed. Follow the steps below:')
    console.log()

    if (nodeCheck.status === 'fail') {
      console.log('  1. Update Node.js to v18 or later:')
      console.log('     https://nodejs.org/en/download')
      console.log()
    }

    if (!ghInstalled) {
      console.log('  • Install the GitHub CLI (gh):')
      console.log(`    ${getGhInstallInstructions()}`)
      console.log('    https://cli.github.com')
      console.log()
    }

    if (ghInstalled && ghAuthCheck.status === 'fail') {
      console.log('  • Authenticate with GitHub:')
      console.log('    Run: gh auth login')
      console.log()

      if (ctx.args.fix && process.stdin.isTTY && process.stdout.isTTY) {
        logger.info('Running `gh auth login`…')
        const success = await runGhAuthLogin()
        if (success) {
          logger.success('Authentication successful!')
        } else {
          logger.error('Authentication failed. Run `gh auth login` manually.')
          process.exitCode = 1
          return
        }
      }
    }

    if (!ctx.args.fix) {
      logger.info('Tip: Run `asdm setup --fix` to attempt automatic fixes.')
    }

    process.exitCode = 1
  },
})
