import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  dts: false,
  sourcemap: false,
  splitting: false,
  bundle: true,
  minify: false,
  target: 'node18',
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: [],
  external: [
    // Node.js built-ins are always external
  ],
  define: {
    __ASDM_VERSION__: JSON.stringify(version),
  },
})
