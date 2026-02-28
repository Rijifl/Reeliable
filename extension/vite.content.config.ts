// Separate build for the content script.
// Content scripts run as classic scripts in Chrome — they cannot use ES module
// imports. This config builds content.tsx as a self-contained IIFE so that
// React, ReactDOM, and the overlay are all inlined into a single content.js.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // main build already populated dist/
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife',
        name: 'ReelCheckContent',
      },
    },
  },
})
