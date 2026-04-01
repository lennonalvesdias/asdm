import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    // Match the version injected by tsup at build time
    __ASDM_VERSION__: JSON.stringify('0.0.0-test'),
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/cli/index.ts'],
    },
  },
})
