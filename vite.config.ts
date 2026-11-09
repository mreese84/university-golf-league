import { resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadHistory, publicHistory } from './scripts/loadHistory'

// Every address serves the app: Firebase Hosting rewrites them all to index.html (firebase.json),
// and the app reads the path itself (src/routes.ts).

const HISTORY_MODULE = 'virtual:ugl-history'
const RESOLVED_HISTORY_MODULE = `\0${HISTORY_MODULE}`

// Serves the history/ folder to the app as `virtual:ugl-history`, after checking it (bad data
// stops the build with the problems listed). Sample events show on the local dev server only.
function historyData(): Plugin {
  let dir = 'history'
  let isBuild = false
  return {
    name: 'ugl-history',
    configResolved(config) {
      dir = resolve(config.root, 'history')
      isBuild = config.command === 'build'
    },
    resolveId(id) {
      if (id === HISTORY_MODULE) return RESOLVED_HISTORY_MODULE
    },
    async load(id) {
      if (id !== RESOLVED_HISTORY_MODULE) return
      const { data, errors } = await loadHistory(dir)
      if (errors.length) this.error(`history/ has ${errors.length} problem(s):\n  ${errors.join('\n  ')}`)
      return `export default ${JSON.stringify(publicHistory(data, !isBuild))}`
    },
    // Editing a history file reloads the page with the new data
    configureServer(server) {
      server.watcher.add(dir)
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(dir + sep)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_HISTORY_MODULE)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), historyData()],
})
