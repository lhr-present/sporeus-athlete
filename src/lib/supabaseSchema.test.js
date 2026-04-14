import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

describe('Supabase migration integrity', () => {
  it('has at least 17 migration files', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))
    expect(files.length).toBeGreaterThanOrEqual(17)
  })

  it('performance index migration exists', () => {
    const files = readdirSync(MIGRATIONS_DIR)
    expect(files.some(f => f.includes('performance_indexes'))).toBe(true)
  })

  it('core tables appear in migrations', () => {
    const allSql = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .map(f => readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'))
      .join('\n')

    for (const table of ['training_log', 'audit_log', 'coach_athletes']) {
      expect(allSql).toContain(table)
    }
  })
})
