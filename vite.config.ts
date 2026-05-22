import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist/renderer',
  },
  resolve: {
    alias: {
      '@pitwall/core': path.resolve(__dirname, 'src/core'),
      '@pitwall/ui': path.resolve(__dirname, 'src/ui'),
    },
  },
  server: {
    port: 5173,
  },
});
