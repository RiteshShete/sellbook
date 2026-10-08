import { z } from 'zod'

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('must be a full URL, e.g. https://abc.supabase.co'),
  VITE_SUPABASE_ANON_KEY: z.string().min(20, 'looks too short to be an anon key'),
})

export type Env = z.infer<typeof EnvSchema>

export type EnvResult = { ok: true; env: Env } | { ok: false; problems: string[] }

/** Validates raw env values (pass `import.meta.env`). Never throws. */
export function parseEnv(raw: Record<string, unknown>): EnvResult {
  const parsed = EnvSchema.safeParse(raw)
  if (parsed.success) return { ok: true, env: parsed.data }
  const problems = parsed.error.issues.map((issue) => {
    const key = String(issue.path[0] ?? 'env')
    const missing = raw[key] === undefined || raw[key] === ''
    return `${key}: ${missing ? 'is missing' : issue.message}`
  })
  return { ok: false, problems }
}
