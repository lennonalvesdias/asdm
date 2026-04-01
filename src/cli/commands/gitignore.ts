/**
 * asdm gitignore — Manage ASDM entries in .gitignore.
 *
 * Reads the current project config to determine which providers are emitted,
 * then adds (or removes) an ASDM-managed block in .gitignore.
 *
 * Options:
 *   --dry-run   Print what would be added without modifying the file.
 *   --remove    Remove the ASDM block from .gitignore.
 */

import { defineCommand } from 'citty'
import { readProjectConfig } from '../../core/config.js'
import {
  getGitignoreEntries,
  updateGitignore,
  removeGitignoreBlock,
  ASDM_MARKER_START,
  ASDM_MARKER_END,
} from '../../utils/gitignore.js'
import { logger } from '../../utils/logger.js'

export default defineCommand({
  meta: {
    name: 'gitignore',
    description: 'Add or remove ASDM managed entries in .gitignore',
  },
  args: {
    'dry-run': {
      type: 'boolean',
      description: 'Print what would be added without modifying the file',
      default: false,
    },
    remove: {
      type: 'boolean',
      description: 'Remove the ASDM block from .gitignore',
      default: false,
    },
  },
  async run(ctx) {
    const cwd = process.cwd()

    let providers: string[]
    try {
      const config = await readProjectConfig(cwd)
      providers = config.providers ?? ['opencode']
    } catch {
      logger.error('No .asdm.json found', 'Run `asdm init` first')
      process.exit(1)
      return
    }

    if (ctx.args.remove) {
      const removed = await removeGitignoreBlock(cwd)
      if (removed) {
        logger.success('Removed ASDM block from .gitignore')
      } else {
        logger.info('No ASDM block found in .gitignore — nothing to remove')
      }
      return
    }

    const entries = getGitignoreEntries(providers)

    if (ctx.args['dry-run']) {
      logger.asdm('Would add to .gitignore:')
      logger.dim(ASDM_MARKER_START)
      for (const entry of entries) {
        logger.bullet(entry)
      }
      logger.dim(ASDM_MARKER_END)
      return
    }

    const updated = await updateGitignore(cwd, providers)
    if (updated) {
      logger.success(`Updated .gitignore with ${entries.length} ASDM entr${entries.length === 1 ? 'y' : 'ies'}`)
    } else {
      logger.info('.gitignore is already up to date')
    }
  },
})
