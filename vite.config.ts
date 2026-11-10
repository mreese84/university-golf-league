import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Every address serves the app: Firebase Hosting rewrites them all to index.html (firebase.json),
// and the app reads the path itself (src/routes.ts).

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
})
