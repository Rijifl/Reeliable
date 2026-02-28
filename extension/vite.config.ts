import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public', // manifest.json copied to dist/ automatically
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        popup: resolve(__dirname, 'popup.html'),
        panel: resolve(__dirname, 'panel.html'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
