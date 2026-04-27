/**
 * Interactive terminal prompt utilities using Node.js readline.
 *
 * Returns sensible defaults (undefined / []) when stdin/stdout is not a TTY,
 * enabling callers to fall back to CLI arg defaults in CI environments.
 */

import readline from 'node:readline'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const FG_CYAN = '\x1b[36m'

export interface PromptOption<T> {
  label: string
  value: T
}

function renderOptions<T>(options: Array<PromptOption<T>>): void {
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${DIM}${i + 1}.${RESET} ${options[i]!.label}`)
  }
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, (answer: string) => resolve(answer))
  })
}

/**
 * Show a numbered list and prompt the user to enter one number.
 * Re-prompts on invalid input. Returns undefined when stdin is not a TTY.
 */
export async function selectOne<T>(
  question: string,
  options: Array<PromptOption<T>>,
): Promise<T | undefined> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return undefined
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  console.log(`\n${BOLD}${FG_CYAN}${question}${RESET} ${DIM}(enter number)${RESET}`)
  renderOptions(options)

  while (true) {
    const answer = await ask(rl, '❯ ')
    const num = parseInt(answer.trim(), 10)

    if (!isNaN(num) && num >= 1 && num <= options.length) {
      rl.close()
      return options[num - 1]!.value
    }

    console.log(`  ${DIM}Enter a number between 1 and ${options.length}.${RESET}`)
  }
}

/**
 * Show a numbered list with checkboxes and prompt for comma-separated numbers.
 * Re-prompts until at least one valid item is selected. Returns [] when stdin is not a TTY.
 */
export async function selectMany<T>(
  question: string,
  options: Array<PromptOption<T>>,
): Promise<T[]> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return []
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  console.log(`\n${BOLD}${FG_CYAN}${question}${RESET} ${DIM}(comma-separated numbers, e.g: 1,2)${RESET}`)
  renderOptions(options)

  while (true) {
    const answer = await ask(rl, '❯ ')
    const parts = answer.split(',').map(s => s.trim()).filter(Boolean)
    const nums = parts.map(p => parseInt(p, 10))
    const allValid = nums.length > 0 && nums.every(n => !isNaN(n) && n >= 1 && n <= options.length)

    if (allValid) {
      rl.close()
      return nums.map(n => options[n - 1]!.value)
    }

    console.log(`  ${DIM}Select at least one. Enter numbers between 1 and ${options.length}.${RESET}`)
  }
}
