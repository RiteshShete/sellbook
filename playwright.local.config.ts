import { defineConfig } from '@playwright/test'

/**
 * Real-stack check of the sign-in screens (S2): drives the actual app in Chrome against the LOCAL Supabase stack
 * (supabase start), reading emailed codes from its mail catcher. Not part of `npm run check` (needs Docker).
 *
 *   $env:E2E_SUPABASE_URL = 'http://127.0.0.1:54321'
 *   $env:E2E_ANON_KEY     = '<local anon key from: npx supabase status -o env>'
 *   $env:E2E_MAIL_API     = 'http://127.0.0.1:54324'
 *   npx playwright test -c playwright.local.config.ts
 *
 * Refuses any URL that is not the local machine, so it can never touch a hosted project.
 */
const url = process.env.E2E_SUPABASE_URL ?? ''
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error('E2E_SUPABASE_URL must be the LOCAL stack (http://127.0.0.1:54321). Nothing was run.')
}

const port = 5199

export default defineConfig({
  testDir: 'e2e-local',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    isMobile: true,
    channel: process.env.PW_CHANNEL ?? 'chrome',
  },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    port,
    reuseExistingServer: false,
    // Values already in the environment win over .env.local, so the dev server talks to the local stack only.
    env: {
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_ANON_KEY: process.env.E2E_ANON_KEY ?? '',
      VITE_STOREFRONT_ENABLED: 'true',
      VITE_TURNSTILE_SITE_KEY: '',
    },
  },
})
