// Build config for the MAIN world content script.
// Must be IIFE (not ES module) because Chrome content scripts declared in
// manifest.json run as classic scripts, not modules.
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'reel-extractor-main': resolve(__dirname, 'src/reel-extractor-main.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife',
        name: 'ReelCheckMain',
      },
    },
  },
})
