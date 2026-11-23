import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
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

/**
 * Production-only Content-Security-Policy (GitHub Pages cannot send headers, so it is a <meta> tag;
 * dev is skipped because Vite's HMR needs inline scripts). Allows only this origin and the project's
 * Supabase host; style-src keeps 'unsafe-inline' because React/Recharts set inline style attributes.
 */
function csp(): Plugin {
  let host = ''
  return {
    name: 'sellbook-csp',
    apply: 'build',
    // Vite's resolved env includes .env.local; process.env alone only has CI variables, which
    // made local builds/previews block every Supabase call.
    configResolved(config) {
      try {
        host = new URL(config.env.VITE_SUPABASE_URL ?? '').origin
      } catch {
        // env missing at build time: the app shows its env error screen anyway
      }
    },
    transformIndexHtml() {
      const ws = host.replace(/^http/, 'ws')
      const policy = [
        "default-src 'self'",
        "script-src 'self' https://challenges.cloudflare.com",
        "frame-src https://challenges.cloudflare.com",
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob: ${host}`.trim(),
        "font-src 'self' data:",
        `connect-src 'self' ${host} ${ws} https://challenges.cloudflare.com`.trim(),
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "manifest-src 'self'",
      ].join('; ')
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
        { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
      ]
    },
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
  plugins: [react(), tailwindcss(), csp()],
  test: {
    environment: 'jsdom',
    // Prove business-date helpers do not depend on the device timezone.
    env: { TZ: 'Pacific/Honolulu' },
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
