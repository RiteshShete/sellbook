// Fails if a service_role key or JWT-shaped secret appears in tracked-style source files.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'package-lock.json'])
const SKIP_FILES = new Set(['scan-secrets.mjs', 'CLAUDE.md', 'PLAN.md', 'package-lock.json'])
const EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
  '.toml',
  '.sql',
  '.yml',
  '.yaml',
  '.env',
  '.html',
  '.md',
])
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/
const SERVICE = /service_role/i

const hits = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (EXTS.has(extname(p)) || name.startsWith('.env')) {
      const text = readFileSync(p, 'utf8')
      if (JWT.test(text)) hits.push(`${p}: JWT-shaped token`)
      if (SERVICE.test(text)) hits.push(`${p}: mentions service_role`)
    }
  }
}
walk('.')
if (hits.length) {
  console.error('Secret scan FAILED:\n' + hits.join('\n'))
  process.exit(1)
}
console.log('Secret scan passed')
