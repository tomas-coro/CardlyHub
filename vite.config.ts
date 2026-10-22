import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serve il sito in /CardlyHub/: senza base i file (carte, script) darebbero 404
  base: '/CardlyHub/',
  plugins: [react()],
})
