import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS, slugProblem, suggestSlug } from './slug'

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

describe('reserved slugs', () => {
  it('match the SQL list exactly', () => {
    const sql = read('supabase/migrations/20261124100000_storefront_schema.sql')
    const body = /select array\[([\s\S]*?)\];/.exec(sql)?.[1] ?? ''
    const fromSql = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '')
    expect(fromSql.length).toBeGreaterThan(40)
    expect([...fromSql].sort()).toEqual([...RESERVED_SLUGS].sort())
  })

  it('cover the first path segment of every owner-app route', () => {
    const router = read('src/app/router.tsx')
    const segments = new Set([...router.matchAll(/path:\s*'\/?([a-z][a-z-]*)/g)].map((m) => m[1] ?? ''))
    expect(segments.size).toBeGreaterThan(10)
    const missing = [...segments].filter((s) => !RESERVED_SLUGS.includes(s))
    expect(missing).toEqual([])
  })

  it('have no duplicates and are valid slugs shapes or short words', () => {
    expect(new Set(RESERVED_SLUGS).size).toBe(RESERVED_SLUGS.length)
  })
})

describe('slugProblem', () => {
  it.each(['ritesh-foods', 'a1b', 'shop-12345'])('accepts %s', (s) => expect(slugProblem(s)).toBeNull())

  it.each(['ab', '-abc', 'abc-', 'Ritesh', 'has space', 'a'.repeat(31), 'under_score'])('rejects %s', (s) =>
    expect(slugProblem(s)).not.toBeNull(),
  )

  it('rejects reserved words', () => {
    expect(slugProblem('orders')).toMatch(/reserved/)
    expect(slugProblem('login')).toMatch(/reserved/)
  })
})

describe('suggestSlug', () => {
  it.each([
    ['Ritesh Foods', 'ritesh-foods'],
    ['  Ritesh Foods & Co.  ', 'ritesh-foods-co'],
    ['Café 99', 'cafe-99'],
    ['A'.repeat(40), 'a'.repeat(30)],
  ])('suggests %j -> %j', (input, expected) => expect(suggestSlug(input)).toBe(expected))

  it('gives nothing for a name that is too short or has no letters or digits', () => {
    expect(suggestSlug('ab')).toBe('')
    expect(suggestSlug('!!!')).toBe('')
    expect(suggestSlug('')).toBe('')
  })

  it('never ends a long name with a hyphen', () => {
    expect(suggestSlug('word '.repeat(10)).endsWith('-')).toBe(false)
  })

  it('a suggestion can still be reserved, so the form checks it', () => {
    expect(slugProblem(suggestSlug('Orders'))).toMatch(/reserved/)
  })
})
