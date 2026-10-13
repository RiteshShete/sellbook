import { defineConfig } from '@playwright/test'

/**
 * Screenshots + accessibility run against a PRODUCTION build served under the real GitHub Pages
 * base path (/sellbook/). The API is mocked (e2e/mock.ts): nothing reaches a real project.
 *
 *   SHOT_LABEL=after  SHOT_PORT=4173 npx playwright test     (current branch build in ./dist)
 *   SHOT_LABEL=before SHOT_PORT=4174 npx playwright test     (main build; see docs/ui-audit/README.md)
 *
 * The build needs dummy env values, so it never needs the real keys:
 *   VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=test-anon-key-for-screenshots BASE_PATH=/sellbook/ npm run build
 */
const port = Number(process.env.SHOT_PORT ?? 4173)

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    // Uses the Chrome already installed; no browser download.
    channel: process.env.PW_CHANNEL ?? 'chrome',
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort --outDir ${process.env.SHOT_DIST ?? 'dist'}`,
    port,
    reuseExistingServer: true,
    env: { BASE_PATH: '/sellbook/' },
  },
})
