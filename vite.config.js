import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/notams-proxy': {
        target: 'https://notams.aim.faa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/notams-proxy/, '/notamSearch')
      }
    }
  }
})
