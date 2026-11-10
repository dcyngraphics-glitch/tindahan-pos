import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The app is served from the domain root on Vercel and from a subpath on GitHub
// Pages, so the base has to be decided per platform at build time. VITE_BASE is
// set in the GitHub Actions workflow; Vercel builds without it and gets '/'.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  build: {
    // Without this the build modulepreloads every chunk, so splitting them up
    // does not actually reduce the first download.
    modulePreload: false,
    rollupOptions: {
      output: {
        // Split the big third-party libraries into their own files. They change
        // rarely, so the browser can keep them cached while app code moves on.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts')) return 'charts';
          if (id.includes('dexie')) return 'cloud';
          if (id.includes('html5-qrcode')) return 'scanner';
          if (id.includes('gsap')) return 'animation';
          if (id.includes('react')) return 'react';
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      // Content Security Policy, production builds only. Vite's dev server needs
      // inline scripts and styles for hot reload, so a strict policy would break
      // `npm run dev`.
      name: 'tindahan-csp',
      apply: 'build',
      transformIndexHtml(html) {
        // NOTE: a <meta> policy cannot set frame-ancestors (the anti-clickjacking
        // rule) — that one needs a real server header.
        const policy = [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          // Dexie Cloud is reached over https for sync and wss for live updates.
          "connect-src 'self' https://dexie.cloud https://*.dexie.cloud wss://dexie.cloud wss://*.dexie.cloud",
          "media-src 'self' blob:",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
        ].join('; ');
        return html.replace(
          '</head>',
          `  <meta http-equiv="Content-Security-Policy" content="${policy}">\n</head>`
        );
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icons.svg'],
      manifest: {
        name: 'Tindahan POS',
        short_name: 'Tindahan',
        description: 'Barcode scanner POS for small stores',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#f59e0b',
        icons: [
          { src: './icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: './icons.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}'],
      },
    }),
  ],
})
