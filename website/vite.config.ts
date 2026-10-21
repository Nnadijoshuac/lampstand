import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served from GitHub Pages under /<repo>/, so assets use relative paths.
export default defineConfig({ base: './', plugins: [react(), tailwindcss()] })
