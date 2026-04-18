/**
 * tests/e2e/global-teardown.ts — Playwright globalTeardown
 *
 * Reads .e2e-users.json and deletes all test users (CASCADE handles DB rows).
 * Also removes the state file.
 */
import * as fs   from 'fs'
import * as path from 'path'
import { deleteTestUser } from './helpers/db.js'

const STATE_FILE = path.join(__dirname, '.e2e-users.json')

export default async function globalTeardown() {
  if (!fs.existsSync(STATE_FILE)) return

  let state: any
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return
  }

  console.log('\n[e2e teardown] Deleting test users…')
  const ids = [state.athleteA?.id, state.coachA?.id, state.athleteB?.id].filter(Boolean)
  await Promise.allSettled(ids.map(id => deleteTestUser(id)))

  fs.rmSync(STATE_FILE, { force: true })
  console.log('[e2e teardown] Done.\n')
}
