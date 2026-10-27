import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  plugins: [
    react(),
    {
      name: 'copy-assets-dir',
      closeBundle() {
        if (!fs.existsSync('dist/assets')) {
          fs.mkdirSync('dist/assets', { recursive: true });
        }
        if (fs.existsSync('assets')) {
          fs.cpSync('assets', 'dist/assets', { recursive: true });
        }
      }
    }
  ]
});
