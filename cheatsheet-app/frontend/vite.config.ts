import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the local backend so the frontend can use
    // same-origin relative paths (`/api/...`). This mirrors the nginx
    // setup in production — no CORS dance needed in either environment.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
