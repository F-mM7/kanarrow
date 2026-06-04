import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages（https://<user>.github.io/kanarrow/）で公開するため base を設定
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/kanarrow/',
})
