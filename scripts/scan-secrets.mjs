// Fails if a service_role key or JWT-shaped secret appears in files git would commit.
// Git-ignored local env files (.env.local) may hold the anon key, but never a service_role key.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'

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
  '.sh',
  '.cjs',
  '.jsx',
  '.txt',
])
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
const SERVICE = /service_role/i
// Supabase's newer secret API keys are not JWTs: sb_secret_...
const SB_SECRET = /sb_secret_[A-Za-z0-9_-]{10,}/

// Other credentials that must never reach a public repo.
const OTHER = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/, 'GitHub fine-grained token'],
  [/\bsbp_[a-f0-9]{30,}/, 'Supabase access token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]{6,}@/, 'database URL with password'],
]

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)
}

/** Reads the JWT payload's `role` claim without verifying it. */
function jwtRole(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')).role
  } catch {
    return undefined // not decodable: treat as unknown, still reported for committable files
  }
}

const wanted = (p) => EXTS.has(extname(p)) || basename(p).startsWith('.env')
const hits = []

// 1. Everything git would commit (tracked + untracked-but-not-ignored): no JWTs, no service_role.
for (const p of git(['ls-files', '--cached', '--others', '--exclude-standard'])) {
  if (SKIP_FILES.has(basename(p)) || !wanted(p) || !existsSync(p)) continue
  const text = readFileSync(p, 'utf8')
  if (text.match(JWT)) hits.push(`${p}: JWT-shaped token`)
  if (SERVICE.test(text)) hits.push(`${p}: mentions service_role`)
  if (SB_SECRET.test(text)) hits.push(`${p}: contains an sb_secret_ key`)
  for (const [re, label] of OTHER) if (re.test(text)) hits.push(`${p}: ${label}`)
}

// 2. Git-ignored local env files: the anon key is fine, a service_role key is not.
for (const p of git(['ls-files', '--others', '--ignored', '--exclude-standard', '--directory'])) {
  if (!basename(p).startsWith('.env') || !existsSync(p)) continue
  const text = readFileSync(p, 'utf8')
  if (SERVICE.test(text)) hits.push(`${p}: mentions service_role`)
  if (SB_SECRET.test(text)) hits.push(`${p}: contains an sb_secret_ key`)
  for (const token of text.match(JWT) ?? []) {
    if (jwtRole(token) === 'service_role') hits.push(`${p}: contains a service_role JWT`)
  }
}

if (hits.length) {
  console.error('Secret scan FAILED:\n' + hits.join('\n'))
  process.exit(1)
}
console.log('Secret scan passed')
