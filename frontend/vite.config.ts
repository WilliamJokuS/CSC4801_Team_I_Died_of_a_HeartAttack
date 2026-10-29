import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, /api is proxied to the backend so the browser sees one origin (no CORS needed).
// Override the target with VITE_API_PROXY if the backend runs elsewhere.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:8080',
    },
  },
})
