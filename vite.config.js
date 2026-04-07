import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UIBITS_DIR = path.join(__dirname, 'public', 'uibits')

function generateUibitsGallery() {
  if (!fs.existsSync(UIBITS_DIR)) {
    fs.mkdirSync(UIBITS_DIR, { recursive: true })
  }

  const dirs = fs
    .readdirSync(UIBITS_DIR, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        fs.existsSync(path.join(UIBITS_DIR, d.name, 'index.html')),
    )

  const experiments = dirs.map((d) => {
    const slug = d.name
    const abs = path.join(UIBITS_DIR, slug, 'index.html')
    const html = fs.readFileSync(abs, 'utf8')
    const titleMatch = html.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i)
    const title = (titleMatch?.[1] || slug).replace(/\s+/g, ' ').trim()
    const descMatch =
      html.match(
        /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i,
      )
    const description = descMatch?.[1]?.trim() || ''
    return { slug, href: `/uibits/${slug}/`, title, description }
  })

  experiments.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  )

  const payload = { generated: new Date().toISOString(), experiments }
  fs.writeFileSync(
    path.join(UIBITS_DIR, 'gallery.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
  )
}

function uibitsGalleryPlugin() {
  return {
    name: 'uibits-gallery',
    buildStart() {
      generateUibitsGallery()
    },
    configureServer(server) {
      generateUibitsGallery()
      server.watcher.add(UIBITS_DIR)
      const touch = (file) => {
        const norm = path.normalize(file)
        if (norm.startsWith(UIBITS_DIR) && norm.endsWith('.html')) {
          generateUibitsGallery()
        }
      }
      server.watcher.on('change', touch)
      server.watcher.on('add', touch)
      server.watcher.on('unlink', touch)

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url || !url.startsWith('/uibits/')) return next()

        const bare = url.endsWith('/') ? url.slice(0, -1) : url
        const slug = bare.replace('/uibits/', '')

        if (!slug || path.extname(slug)) return next()

        const indexPath = path.join(UIBITS_DIR, slug, 'index.html')
        if (!fs.existsSync(indexPath)) return next()

        if (!url.endsWith('/')) {
          res.writeHead(301, { Location: url + '/' })
          res.end()
          return
        }

        req.url = `/uibits/${slug}/index.html`
        next()
      })
    },
  }
}

export default defineConfig({
  appType: 'mpa',
  plugins: [uibitsGalleryPlugin()],
})
