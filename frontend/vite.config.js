import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    test: {
      exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_GATEWAY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: path => path.startsWith('/api/') ? path : `/api${path}`,
        },
      },
    },
  }
})
