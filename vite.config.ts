import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages serves the app under /sellbook/ (deploy workflow sets BASE_PATH); local dev and
  // a future custom domain use /.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    // Prove business-date helpers do not depend on the device timezone.
    env: { TZ: 'Pacific/Honolulu' },
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
