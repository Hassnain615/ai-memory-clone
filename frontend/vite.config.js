import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Backend routes live under /api — no rewrite needed
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { d3: ['d3'], react: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
})
