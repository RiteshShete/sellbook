import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Short git SHA of the commit being built, or "dev" outside a git checkout. */
function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  // GitHub Pages serves the app under /sellbook/ (deploy workflow sets BASE_PATH); local dev and
  // a future custom domain use /.
  base: process.env.BASE_PATH ?? '/',
  // Shown in More, so a stale cached copy is easy to spot: "<short sha> · <build date, UTC>".
  define: {
    __APP_VERSION__: JSON.stringify(`${gitSha()} · ${new Date().toISOString().slice(0, 16)}Z`),
  },
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    // Prove business-date helpers do not depend on the device timezone.
    env: { TZ: 'Pacific/Honolulu' },
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
