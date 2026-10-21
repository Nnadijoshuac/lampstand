import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Tests run in Node, which has its own Buffer, so the browser polyfills from vite.config.ts are left out.
export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } }
})
