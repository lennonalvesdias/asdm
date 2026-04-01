/**
 * asdm verify — Check integrity of all managed files against the lockfile.
 *
 * Reads .asdm-lock.json and computes SHA-256 of each tracked file.
 * Works fully offline (RNF-05).
 *
 * Exit codes:
 *   0 = all files intact
 *   1 = files modified (tampering detected)
 *   2 = lockfile absent (needs asdm sync)
 *   3 = manifest version outdated
 */

import { defineCommand } from 'citty'
import { verify, VERIFY_EXIT_CODES } from '../../core/verifier.js'
import { TelemetryWriter } from '../../core/telemetry.js'
import { logger } from '../../utils/logger.js'
import { getGlobalLockfilePath } from '../../utils/fs.js'

export default defineCommand({
  meta: {
    name: 'verify',
    description: 'Verify integrity of managed files against the lockfile',
  },
  args: {
    strict: {
      type: 'boolean',
      description: 'Exit 1 on any violation (used by git hooks)',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Output results as JSON',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress non-error output',
      default: false,
    },
    global: {
      type: 'boolean',
      description: 'Verify files installed to global provider config directories',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()
    const useJson = ctx.args.json
    const quiet = ctx.args.quiet

    if (quiet) logger.setQuiet(true)

    const telemetry = new TelemetryWriter(cwd)
    const lockfilePath = ctx.args.global ? getGlobalLockfilePath() : undefined

    if (ctx.args.strict) {
      const result = await verify(cwd, undefined, true, telemetry, lockfilePath)
      if (useJson) {
        console.log(JSON.stringify({
          status: result.exitCode === VERIFY_EXIT_CODES.OK ? 'ok' : 'error',
          violations: result.violations,
        }))
      } else if (result.exitCode === VERIFY_EXIT_CODES.OK) {
        logger.success('All managed files are intact')
      } else {
        for (const v of result.violations) {
          const icon = v.type === 'missing' ? '❌' : '⚠️'
          logger.error(`${icon} ${v.filePath} (${v.type})`)
        }
      }
      process.exitCode = result.exitCode
      return
    }

    try {
      const result = await verify(cwd, undefined, true, telemetry, lockfilePath)

      if (useJson) {
        console.log(JSON.stringify(result, null, 2))
        process.exitCode = result.exitCode
        return
      }

      if (result.exitCode === VERIFY_EXIT_CODES.NO_LOCK) {
        logger.warn(lockfilePath ? 'No global lockfile found' : 'No lockfile found (.asdm-lock.json)')
        logger.info(lockfilePath ? 'Run `asdm sync --global` to initialize' : 'Run `asdm sync` to initialize')
        process.exitCode = VERIFY_EXIT_CODES.NO_LOCK
        return
      }

      logger.asdm(`Verified ${result.checkedFiles} managed file(s)`)
      logger.divider()

      if (result.violations.length === 0) {
        logger.success('All managed files are intact')
      } else {
        for (const violation of result.violations) {
          if (violation.type === 'missing') {
            logger.status(violation.filePath, 'fail', '❌ MISSING')
          } else if (violation.type === 'modified') {
            logger.status(violation.filePath, 'warn', '⚠️  MODIFIED')
          } else {
            logger.status(violation.filePath, 'warn', `⚠️  ${violation.type.toUpperCase()}`)
          }
        }
        logger.divider()
        logger.warn(`${result.violations.length} violation(s) detected`)
        logger.info('Run `asdm sync --force` to restore managed files')
      }

      if (result.exitCode === VERIFY_EXIT_CODES.OUTDATED) {
        logger.warn(`Manifest is outdated (local: ${result.currentManifestVersion}, latest: ${result.latestManifestVersion})`)
        logger.info('Run `asdm sync` to update')
      }

      process.exitCode = result.exitCode
      return
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(message)
      process.exitCode = 1
      return
    }
  },
})
