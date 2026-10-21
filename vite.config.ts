import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ['buffer', 'stream', 'events', 'crypto', 'util', 'process'], globals: { Buffer: true, process: true, global: true } })],
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  worker: { format: 'es' },
  clearScreen: false,
  server: { port: 1420, strictPort: true }
})
