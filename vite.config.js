import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { apiMiddleware } from './src/server/apiMiddleware.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
// Public Supabase settings may be named VITE_*, NEXT_PUBLIC_* or plain SUPABASE_* (never the service role key).
const env = loadEnv(process.env.NODE_ENV || 'production', __dirname, '')
const firstEnv = (...keys) => keys.map(key => env[key]).find(Boolean) || ''

export default defineConfig({
  define: {
    __BATON_SUPABASE_URL__: JSON.stringify(firstEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')),
    __BATON_SUPABASE_ANON_KEY__: JSON.stringify(firstEnv('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'))
  },
  plugins: [
    react(),
    apiMiddleware()
  ],
  resolve: {
    alias: {
      '@designcodeio/threeui/style.css': path.resolve(__dirname, 'src/shaders/threeui.css'),
      '@designcodeio/threeui': path.resolve(__dirname, 'src/shaders/3d-paper/ThreeDPaper.tsx'),
      '@': path.resolve(__dirname, 'src'),
    }
  },
  server: {
    port: 3000,
    open: false,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 5000
  }
})

