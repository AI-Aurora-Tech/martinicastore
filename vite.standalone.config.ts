import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Gera um único arquivo HTML autocontido (CSS + JS embutidos), que pode ser
// aberto direto no navegador (duplo clique), sem servidor.
// Uso: npm run build:standalone  ->  dist-standalone/index.html
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-standalone',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
})
