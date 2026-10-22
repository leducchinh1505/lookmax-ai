/// <reference types="vitest" />
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Production-only CSP: the app may only talk to its own origin, so photos and
// data cannot be sent anywhere even by accident. (Dev server needs HMR, so skipped.)
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const cspPlugin: Plugin = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

// Optional HTTPS for iPhone-over-Wi-Fi testing (camera + service worker need a
// secure context). Create the files with mkcert — see docs/IPHONE.md.
const certDir = fileURLToPath(new URL('./certs/', import.meta.url));
const lanHttps = existsSync(certDir + 'lan.pem') && existsSync(certDir + 'lan-key.pem')
  ? { cert: readFileSync(certDir + 'lan.pem'), key: readFileSync(certDir + 'lan-key.pem') }
  : undefined;

export default defineConfig({
  // Relative base so the same build works under Tauri, a LAN server and the PWA.
  base: './',
  plugins: [
    react(),
    cspPlugin,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lookmax AI',
        short_name: 'Lookmax',
        description: 'Local-first personal appearance analysis. Photos never leave your device.',
        theme_color: '#0b0b12',
        background_color: '#0b0b12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Pre-cache the app shell, the WASM runtime and the model for offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,task}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: { port: 5173, strictPort: true, https: lanHttps },
  preview: { port: 4173, strictPort: true, https: lanHttps },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
