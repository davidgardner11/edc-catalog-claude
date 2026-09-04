import { configDefaults, defineConfig } from 'vitest/config'

// Vitest 4's default `include` is `**/*.{test,spec}.?(c|m)[jt]s?(x)`, which
// matches tests/e2e/*.spec.ts — so without this file `pnpm test` would try to
// run the Playwright specs in the Vitest runner and fail. The include stays
// broad (a colocated *.test.ts anywhere still runs); only tests/e2e is carved
// out, plus build output that Vitest 4 no longer excludes by default.
export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude, // **/node_modules/**, **/.git/**
      'tests/e2e/**',
      '**/.nuxt/**',
      '**/.output/**',
      'dist/**',
      '.ingest-cache/**',
    ],
  },
})
