import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages deployment: serve from /tindahan-pos/ subpath
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icons.svg'],
      manifest: {
        name: 'Tindahan POS',
        short_name: 'Tindahan',
        description: 'Barcode scanner POS for small stores',
        start_url: '/tindahan-pos/',
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
  base: '/tindahan-pos/',
})
