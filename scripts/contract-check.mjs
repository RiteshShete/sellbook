// Runs the SQL-vs-contract test (src/features/storefront/contract.db.test.ts) against the LOCAL stack.
// Needs `supabase start` (Docker). Reads the local anon key from `supabase status`; never prints it.
import { execFileSync, spawnSync } from 'node:child_process'

const out = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8', shell: true })
const anon = /^ANON_KEY="?([^"\r\n]+)"?/m.exec(out)?.[1]
if (!anon) {
  console.error('Could not read the local anon key: is `supabase start` running?')
  process.exit(2)
}
const r = spawnSync('npx', ['vitest', 'run', 'src/features/storefront/contract.db.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CONTRACT_URL: 'http://127.0.0.1:54321', CONTRACT_ANON_KEY: anon },
})
process.exit(r.status ?? 1)
