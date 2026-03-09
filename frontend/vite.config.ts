import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        auth: resolve(__dirname, 'src/auth.ts')
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es'
      }
    }
  },
  server: {
    port: 3000
  }
});
