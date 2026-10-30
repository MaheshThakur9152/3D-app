import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  assetsInclude: ['**/*.hdr'],
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
      name: 'serve-assets-dev',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/assets/')) {
            const cleanUrl = req.url.split('?')[0];
            const filePath = path.resolve(process.cwd(), '.' + cleanUrl);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Length', fs.statSync(filePath).size);
              if (cleanUrl.endsWith('.hdr')) {
                res.setHeader('Content-Type', 'application/octet-stream');
              }
              return fs.createReadStream(filePath).pipe(res);
            }
          }
          next();
        });
      }
    },
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
