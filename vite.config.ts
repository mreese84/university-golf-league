import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tripSlugs } from './src/tripSlugs'
import { loadHistory, publicHistory } from './scripts/loadHistory'
import type { HistoryData } from './src/history/types'

interface FirestoreField {
  stringValue?: string
  integerValue?: string
}

// The public trip list (app/data, readable without signing in), as the live site uses it
async function fetchTrips(projectId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/app/data`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Firestore responded ${res.status}`)
  const doc = (await res.json()) as {
    fields?: { trips?: { arrayValue?: { values?: { mapValue: { fields: Record<string, FirestoreField> } }[] } } }
  }
  return (doc.fields?.trips?.arrayValue?.values ?? [])
    .map(({ mapValue: { fields: f } }) => ({
      id: f.id?.stringValue ?? '',
      year: Number(f.year?.integerValue),
      month: Number(f.month?.integerValue ?? 0),
      location: f.location?.stringValue ?? '',
    }))
    .filter((trip) => trip.id && trip.location && trip.year)
}

// Copies the built index.html to <path>/index.html, so GitHub Pages serves the app there with a 200
async function writePages(outDir: string, paths: string[]) {
  const html = await readFile(join(outDir, 'index.html'), 'utf8')
  for (const path of paths) {
    await mkdir(join(outDir, path), { recursive: true })
    await writeFile(join(outDir, path, 'index.html'), html)
  }
}

// GitHub Pages only serves files. After building, copy index.html to each trip's guide
// address (e.g. 2026-columbia/guide/index.html) so shared links return 200 and get link
// previews, and to 404.html so any other address still loads the app. Trips added later get
// their page on the next deploy; until then their links still work through 404.html.
function guidePages(): Plugin {
  let outDir = 'dist'
  let projectId: string | undefined
  return {
    name: 'ugl-guide-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      projectId = loadEnv(config.mode, config.root, 'VITE_').VITE_FIREBASE_PROJECT_ID
    },
    async closeBundle() {
      const html = await readFile(join(outDir, 'index.html'), 'utf8')
      await writeFile(join(outDir, '404.html'), html)
      if (!projectId) {
        this.warn('VITE_FIREBASE_PROJECT_ID is not set; skipping guide pages')
        return
      }
      try {
        const slugs = [...tripSlugs(await fetchTrips(projectId)).values()]
        await writePages(outDir, slugs.map((slug) => `${slug}/guide`))
        console.log(`guide pages: ${slugs.map((slug) => `${slug}/guide`).join(', ') || 'none'}`)
      } catch (err) {
        this.warn(`Couldn't load trips for guide pages (links still work via 404.html): ${err}`)
      }
    },
  }
}

// Every history address, for writing their pages (player pages only for those who've played)
function historyPaths({ events }: HistoryData) {
  if (events.length === 0) return []
  const played = new Set(events.flatMap((e) => e.teams.flatMap((t) => t.players)))
  return [
    'history',
    'players',
    'superlatives',
    ...events.flatMap((e) => [`history/${e.id}`, ...e.matches.map((m) => `history/${e.id}/${m.id}`)]),
    ...[...played].map((id) => `players/${id}`),
  ]
}

const HISTORY_MODULE = 'virtual:ugl-history'
const RESOLVED_HISTORY_MODULE = `\0${HISTORY_MODULE}`

// Serves the history/ folder to the app as `virtual:ugl-history`, after checking it (bad data
// stops the build with the problems listed). Sample events show on the local dev server only.
function historyData(): Plugin {
  let dir = 'history'
  let outDir = 'dist'
  let isBuild = false
  let paths: string[] = []
  return {
    name: 'ugl-history',
    configResolved(config) {
      dir = resolve(config.root, 'history')
      outDir = resolve(config.root, config.build.outDir)
      isBuild = config.command === 'build'
    },
    resolveId(id) {
      if (id === HISTORY_MODULE) return RESOLVED_HISTORY_MODULE
    },
    async load(id) {
      if (id !== RESOLVED_HISTORY_MODULE) return
      const { data, errors } = await loadHistory(dir)
      if (errors.length) this.error(`history/ has ${errors.length} problem(s):\n  ${errors.join('\n  ')}`)
      const shown = publicHistory(data, !isBuild)
      paths = historyPaths(shown)
      return `export default ${JSON.stringify(shown)}`
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
    async closeBundle() {
      if (!isBuild) return
      await writePages(outDir, paths)
      if (paths.length) console.log(`history pages: ${paths.length}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/university-golf-league/',
  plugins: [react(), tailwindcss(), guidePages(), historyData()],
})
