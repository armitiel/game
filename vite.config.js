import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 8080,
    open: true
  },
  build: {
    outDir: 'build_out2',
    assetsDir: 'assets',
    emptyOutDir: true
  }
});
