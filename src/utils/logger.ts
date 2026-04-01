/**
 * Structured console output for ASDM CLI.
 * Uses ANSI codes directly — zero external dependencies.
 */

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'

const FG_RED = '\x1b[31m'
const FG_GREEN = '\x1b[32m'
const FG_YELLOW = '\x1b[33m'
const FG_BLUE = '\x1b[34m'
const FG_CYAN = '\x1b[36m'
const FG_WHITE = '\x1b[37m'
const FG_GRAY = '\x1b[90m'

const ICONS = {
  success: '✓',
  error: '✗',
  warn: '⚠',
  info: 'ℹ',
  pending: '○',
  arrow: '→',
  bullet: '•',
  badge_asdm: 'asdm',
}

let _quiet = false
let _verbose = false

export const logger = {
  setQuiet(q: boolean) { _quiet = q },
  setVerbose(v: boolean) { _verbose = v },

  /** Brand prefix for main operations */
  asdm(msg: string) {
    if (_quiet) return
    console.log(`${BOLD}${FG_CYAN}${ICONS.badge_asdm}${RESET} ${msg}`)
  },

  success(msg: string) {
    if (_quiet) return
    console.log(`${FG_GREEN}${ICONS.success}${RESET} ${msg}`)
  },

  error(msg: string, suggestion?: string) {
    console.error(`${FG_RED}${ICONS.error}${RESET} ${msg}`)
    if (suggestion) {
      console.error(`  ${FG_GRAY}${ICONS.arrow} ${suggestion}${RESET}`)
    }
  },

  warn(msg: string) {
    if (_quiet) return
    console.warn(`${FG_YELLOW}${ICONS.warn}${RESET} ${msg}`)
  },

  info(msg: string) {
    if (_quiet) return
    console.log(`${FG_BLUE}${ICONS.info}${RESET} ${msg}`)
  },

  dim(msg: string) {
    if (_quiet) return
    console.log(`${DIM}  ${msg}${RESET}`)
  },

  verbose(msg: string) {
    if (!_verbose) return
    console.log(`${FG_GRAY}  [verbose] ${msg}${RESET}`)
  },

  bullet(msg: string, indent = 0) {
    if (_quiet) return
    const pad = '  '.repeat(indent)
    console.log(`${pad}${FG_GRAY}${ICONS.bullet}${RESET} ${msg}`)
  },

  divider() {
    if (_quiet) return
    console.log(`${DIM}${'─'.repeat(50)}${RESET}`)
  },

  /** Print a table of key-value pairs */
  table(rows: Array<[string, string]>, keyWidth = 20) {
    if (_quiet) return
    for (const [key, value] of rows) {
      const padded = key.padEnd(keyWidth)
      console.log(`  ${FG_GRAY}${padded}${RESET} ${value}`)
    }
  },

  /** Status line: ✓ ok / ✗ fail / ⚠ warn */
  status(label: string, status: 'ok' | 'fail' | 'warn' | 'skip', detail?: string) {
    if (_quiet) return
    const icons: Record<string, string> = {
      ok: `${FG_GREEN}${ICONS.success}${RESET}`,
      fail: `${FG_RED}${ICONS.error}${RESET}`,
      warn: `${FG_YELLOW}${ICONS.warn}${RESET}`,
      skip: `${FG_GRAY}-${RESET}`,
    }
    const icon = icons[status] ?? icons['skip']
    const labelPad = label.padEnd(40)
    const detailStr = detail ? `  ${FG_GRAY}${detail}${RESET}` : ''
    console.log(`  ${icon} ${labelPad}${detailStr}`)
  },

  /** Highlight text in cyan bold */
  highlight(text: string): string {
    return `${BOLD}${FG_CYAN}${text}${RESET}`
  },

  bold(text: string): string {
    return `${BOLD}${text}${RESET}`
  },

  white(text: string): string {
    return `${FG_WHITE}${text}${RESET}`
  },
}
