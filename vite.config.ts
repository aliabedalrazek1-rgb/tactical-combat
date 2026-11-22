import { defineConfig } from 'vite'

export default defineConfig({
  base: '/tactical-combat/',
  build: {
    rollupOptions: {
      output: { manualChunks: { physics: ['@dimforge/rapier3d-compat'], three: ['three'] } },
    },
    // Three and Rapier are deliberately cached separately from game code.
    chunkSizeWarningLimit: 2400,
  },
})
