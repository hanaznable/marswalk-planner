import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Relative asset paths in the production build, so the same files work at the
  // root of a domain, under a GitHub Pages sub-path, or from any static host.
  base: command === 'build' ? './' : '/',
  build: {
    // The largest chunk is the 3D view (Three.js, about 600 kB). It already
    // loads only when 3D terrain is opened, so the default 500 kB warning is noise.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        planner: fileURLToPath(new URL('./index.html', import.meta.url)),
        layerLab: fileURLToPath(new URL('./layer-lab.html', import.meta.url)),
      },
    },
  },
}))
