import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 8080,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  // Serve/copy static PWA assets (sw.js, manifest, firebase-config files, etc.)
  // Using 'public' would be cleaner long-term, but for minimal disruption we include root static files.
  // Vite will still process index.html + imported JS (renderer.js + src/firebase.js).
  publicDir: 'public',
})