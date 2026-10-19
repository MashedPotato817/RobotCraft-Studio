import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: id => id.includes('/node_modules/three/examples/') ? 'controls' : id.includes('/node_modules/three/') ? 'three' : undefined,
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
});
