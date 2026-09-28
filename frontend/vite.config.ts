/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Tests never talk to a real server; this value only satisfies the config check in api.ts.
    env: { VITE_API_BASE_URL: 'http://api.test' },
    css: false,
  },
})
