import { defineConfig, devices } from '@playwright/test'

// Overridable because `reuseExistingServer` below will happily attach to
// whatever is already on this port — including a different app. That is not
// hypothetical: a sibling checkout serving :3000 once made all 41 specs fail
// with "element not found" against someone else's markup. `PW_PORT=3100 npx
// playwright test` gets a clean server of our own.
const PORT = Number(process.env.PW_PORT ?? 3000)
const BASE_URL = `http://localhost:${PORT}`

// E2E config. Specs live in tests/e2e only — tests/unit is Vitest's, and the
// two runners must not glob into each other. Playwright is scoped by testDir
// here; Vitest excludes tests/e2e in vitest.config.ts. See CLAUDE.md.
export default defineConfig({
  testDir: './tests/e2e',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  // Chromium only. The plan does not ask for cross-browser coverage, and the
  // behaviours under test (band geometry, carousel label stability) are layout
  // facts, not engine differences.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // The suite starts the app itself. `nuxt dev` binds :3000 by default and
  // nuxt.config.ts does not override devServer. reuseExistingServer keeps a
  // dev server you already have running usable locally, but never on CI.
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
