import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(projectRoot, 'src/main/index.ts') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(projectRoot, 'src/preload/index.ts') } }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: { alias: { '@renderer': resolve(projectRoot, 'src/renderer') } },
    build: { rollupOptions: { input: resolve(projectRoot, 'index.html') } }
  }
})
