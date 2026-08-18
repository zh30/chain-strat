import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const localeChunks = [
  'ar_AR',
  'de_DE',
  'es_419',
  'fr_FR',
  'hi_IN',
  'id_ID',
  'ja_JP',
  'ko_KR',
  'ms_MY',
  'pt_BR',
  'ru_RU',
  'th_TH',
  'tr_TR',
  'uk_UA',
  'vi_VN',
  'zh_HK',
  'zh_TW',
]
const platformChunks = [
  'Arc',
  'Brave',
  'Browser',
  'Chrome',
  'Edge',
  'Firefox',
  'Linux',
  'Macos',
  'Opera',
  'Safari',
  'Windows',
]

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'offline.html',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-192-maskable.png',
        'icons/icon-512-maskable.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        id: '/',
        name: '连环计 ChainStrat',
        short_name: '连环计',
        description: 'Monad 上的 1v1 英雄连招对决。设定连环技能，观看确定性战场，结果上链。',
        lang: 'zh-CN',
        dir: 'ltr',
        theme_color: '#07080d',
        background_color: '#07080d',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['games', 'entertainment'],
        handle_links: 'preferred',
        launch_handler: { client_mode: 'navigate-existing' },
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: '大厅', short_name: '大厅', url: '/', description: '回到大厅' },
          { name: '英雄库', short_name: '英雄库', url: '/?screen=library' },
          { name: '天梯', short_name: '天梯', url: '/?screen=ladder' },
          { name: '擂台', short_name: '擂台', url: '/?screen=arena' },
        ],
        screenshots: [
          {
            src: '/screenshots/wide.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: '连环计',
          },
          {
            src: '/screenshots/narrow.jpg',
            sizes: '1080x1920',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: '连环计',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/ws(?:\/|$)/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        globIgnores: [
          '**/screenshots/**',
          ...localeChunks.map((name) => `**/assets/${name}-*.js`),
          ...platformChunks.map((name) => `**/assets/${name}-*.js`),
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/assets\/(?:heroes|arena)\/.*\.(?:jpg|jpeg|png|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'game-art',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname === '/api/health',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  optimizeDeps: {
    include: ['phaser'],
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'http://127.0.0.1:8787', ws: true },
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
