import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    // Prove business-date helpers do not depend on the device timezone.
    env: { TZ: 'Pacific/Honolulu' },
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
