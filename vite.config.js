import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
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

