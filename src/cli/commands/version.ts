/**
 * asdm version — Print CLI version, Node.js version, and OS.
 */

import { defineCommand } from 'citty'
import os from 'node:os'

export default defineCommand({
  meta: {
    name: 'version',
    description: 'Print CLI version and environment info',
  },
  run(_ctx) {
    console.log(`asdm v${__ASDM_VERSION__}`)
    console.log(`node  ${process.version}`)
    console.log(`os    ${os.type()} ${os.release()} (${process.platform})`)
  },
})
