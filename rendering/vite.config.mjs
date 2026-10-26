import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    {
      name: 'copy-assets-dir',
      closeBundle() {
        if (!fs.existsSync('dist/assets')) {
          fs.mkdirSync('dist/assets', { recursive: true });
        }
        fs.cpSync('assets', 'dist/assets', { recursive: true });
      }
    }
  ]
});
