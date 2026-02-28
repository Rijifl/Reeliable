import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ext': resolve(__dirname, '../../extension/src'),
    },
  },
  server: {
    fs: { allow: ['../..'] },
  },
})
