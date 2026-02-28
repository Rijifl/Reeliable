import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Wraps reel-extractor-main.js in an IIFE so its const/let declarations live
 * in a local function scope instead of the shared global lexical scope.
 * Without this, Vite's minified variable names (p, q, …) collide with
 * Instagram's minified code when both run as classic scripts in the MAIN world.
 */
function wrapMainWorldIIFE(): Plugin {
  return {
    name: 'wrap-main-world-iife',
    renderChunk(code, chunk) {
      if (chunk.name === 'reel-extractor-main') {
        return { code: `;(function(){\n${code}\n})();`, map: null }
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [react(), wrapMainWorldIIFE()],
  publicDir: 'public', // manifest.json copied to dist/ automatically
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        offscreen: resolve(__dirname, 'offscreen.html'),
        popup: resolve(__dirname, 'popup.html'),
        panel: resolve(__dirname, 'panel.html'),
        // Runs in MAIN world to access React fiber expando properties
        'reel-extractor-main': resolve(__dirname, 'src/reel-extractor-main.ts'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
