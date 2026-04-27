/**
 * asdm update — Update the ASDM CLI to the latest version.
 *
 * Checks the current version against the latest on npm and runs
 * `npm install -g asdm-cli` to update.
 */

import { defineCommand } from 'citty'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { logger } from '../../utils/logger.js'

const execFileAsync = promisify(execFile)

const FETCH_TIMEOUT_MS = 10_000

async function getLatestNpmVersion(): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch('https://registry.npmjs.org/asdm-cli/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`npm registry responded with HTTP ${response.status}`)
    const data = await response.json() as { version?: string }
    if (!data.version) throw new Error('No version field in npm response')
    return data.version
  } finally {
    clearTimeout(timer)
  }
}

function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const parts = v.replace(/^v/, '').split('.')
    return [
      parseInt(parts[0] ?? '0', 10),
      parseInt(parts[1] ?? '0', 10),
      parseInt(parts[2] ?? '0', 10),
    ]
  }
  const [cMaj, cMin, cPat] = parse(current)
  const [lMaj, lMin, lPat] = parse(latest)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPat > cPat
}

export default defineCommand({
  meta: {
    name: 'update',
    description: 'Update the ASDM CLI to the latest version',
  },
  args: {
    check: {
      type: 'boolean',
      description: 'Only check for updates without installing',
      default: false,
    },
  },
  async run(ctx) {
    const current = __ASDM_VERSION__

    logger.asdm('Checking for updates…')

    let latest: string
    try {
      latest = await getLatestNpmVersion()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Could not reach npm registry: ${message}`)
      process.exitCode = 1
      return
    }

    logger.table([
      ['Current version', `v${current}`],
      ['Latest version', `v${latest}`],
    ])

    if (!isNewerVersion(current, latest)) {
      logger.success('Already up to date!')
      return
    }

    logger.info(`Update available: v${current} → v${latest}`)

    if (ctx.args.check) {
      logger.info('Run `asdm update` to install the latest version')
      return
    }

    logger.asdm('Installing latest version…')

    try {
      await execFileAsync('npm', ['install', '-g', 'asdm-cli'], {
        timeout: 120_000,
      })
      logger.success(`Updated to v${latest}! Restart your terminal if needed.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Update failed: ${message}`)
      logger.info('Try manually: npm install -g asdm-cli')
      process.exitCode = 1
    }
  },
})
