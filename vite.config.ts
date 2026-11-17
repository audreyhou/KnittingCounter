/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const root = dirname(fileURLToPath(import.meta.url))

// pdf.js needs its CMaps, standard fonts and wasm decoders at runtime. Copy
// them from node_modules into public/pdfjs so they are served and precached.
function pdfjsAssets(): Plugin {
  return {
    name: 'copy-pdfjs-assets',
    configResolved() {
      const src = resolve(root, 'node_modules/pdfjs-dist')
      const dest = resolve(root, 'public/pdfjs')
      mkdirSync(dest, { recursive: true })
      for (const dir of ['cmaps', 'standard_fonts', 'iccs']) {
        if (!existsSync(resolve(dest, dir))) cpSync(resolve(src, dir), resolve(dest, dir), { recursive: true })
      }
      const wasmDest = resolve(dest, 'wasm')
      if (!existsSync(wasmDest)) {
        cpSync(resolve(src, 'wasm'), wasmDest, {
          recursive: true,
          filter: (f) => !/quickjs/i.test(f),
        })
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    pdfjsAssets(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Knitting Counter',
        short_name: 'KnitCount',
        description:
          'Row counters, reminders, timers and a smart pattern viewer for knitting and crochet. Everything stays on your device.',
        theme_color: '#29a3f5',
        background_color: '#f2f4f7',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        file_handlers: [
          {
            action: '.',
            accept: {
              'application/pdf': ['.pdf'],
              'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
            },
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest,wasm,bcmap,pfb,ttf,icc}'],
        globIgnores: ['samples/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    // pdf.js is large but is loaded lazily, only when a pattern is opened.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
