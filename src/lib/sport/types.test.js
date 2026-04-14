import { describe, it, expect } from 'vitest'

// Structural check: types.js exports the expected typedef names as comments
// (runtime check is just that the file can be imported without error)
describe('types.js', () => {
  it('imports without error', async () => {
    // types.js is comment-only — just verify it can be imported
    await expect(import('./types.js')).resolves.toBeDefined()
  })

  it('types.js file contains all 8 typedef names', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(process.cwd(), 'src/lib/sport/types.js'), 'utf-8')
    const expectedTypes = [
      'TrainingEntry', 'BanisterState', 'ACWRResult', 'LactateTestPoint',
      'TrainingPaces', 'CriticalPowerResult', 'GoalProgress', 'SimulationPlan'
    ]
    for (const t of expectedTypes) {
      expect(src).toContain(t)
    }
  })

  it('types.js has no runtime code (only comments and exports)', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(process.cwd(), 'src/lib/sport/types.js'), 'utf-8')
    // Should not contain any = assignment or function declarations
    const lines = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*') && l.trim() !== '' && l.trim() !== '*/')
    expect(lines.length).toBe(0)
  })
})
