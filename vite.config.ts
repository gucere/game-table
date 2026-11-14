import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the build work on any GitHub Pages path (user.github.io/<repo>/)
export default defineConfig({
  base: './',
  plugins: [react()],
  // ~40 games in one bundle is still only ~170 kB gzipped; no need to split it up
  build: { chunkSizeWarningLimit: 800 },
});
