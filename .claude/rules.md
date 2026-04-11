# Sporeus Athlete App — Binding Rules for Claude Code

## RULE 1: READ BEFORE TOUCH
Before editing ANY file, Claude MUST:
1. Read CLAUDE.md (project overview)
2. Read this file (.claude/rules.md)
3. Read the specific file being modified
4. Run `npm test` to confirm green baseline
5. grep for the feature/function name to check if it already exists

## RULE 2: NO SPECULATIVE CHANGES
- Only modify what was explicitly requested
- If you notice a bug or improvement opportunity WHILE working: mention it in chat, do NOT fix it
- Never "clean up" adjacent code unless asked
- Never rename localStorage keys (sporeus_log uses underscore — rename = data loss for all users)
- Never change import paths "for consistency"

## RULE 3: PROTECTED FILES (require explicit permission to modify)
These files are fragile — changing them can break auth, payments, or data:
- supabase/migrations/*.sql (schema changes need manual Supabase execution)
- src/lib/supabase.js (flowType: 'implicit' is required for static hosting)
- src/hooks/useAuth.js (onAuthStateChange ONLY — never getSession())
- .github/workflows/deploy.yml (CI pipeline — test gate must stay)
- vite.config.js (PWA config, test config)
- src/lib/formulas.js lines containing SPOREUS_SALT or MASTER_SALT (coach invite crypto)
- src/sw.js (service worker — injectManifest mode)

## RULE 4: TEST DISCIPLINE
- `npm test` MUST pass before every commit (84+ tests)
- Never delete or weaken a test to make it pass — fix the code instead
- New functions in src/lib/ MUST have tests in src/lib/__tests__/ or *.test.js
- Test against real behavior, not mocked internals

## RULE 5: COMMIT DISCIPLINE
- One logical change per commit
- Commit message format: "feat: v5.X.Y — short description" or "fix: description"
- Run `bash scripts/healthcheck.sh` before pushing
- Never force-push to main

## RULE 6: DEPENDENCY DISCIPLINE
- Current external deps: react, react-dom, @supabase/supabase-js, recharts, @fontsource/ibm-plex-mono, web-push, vite, vitest
- Adding a new dependency requires justification in the commit message
- Prefer pure functions over libraries (the app has 25+ pure math functions — use them)
- Never add a CSS framework (all styles are inline via S{} object)

## RULE 7: BACKWARDS COMPATIBILITY
- All localStorage reads must handle missing/old format data gracefully
- New features must work with empty data (no crashes on first launch)
- Coach features must work with file-based exchange (no Supabase requirement)
- Guest mode must remain fully functional (no auth wall for core features)
- TR/EN: every new user-facing string needs both languages in LangCtx.jsx

## RULE 8: SECURITY CHECKLIST (before every push)
Run: grep -rn "SECRET\|TOKEN\|sk-\|pk_live\|password" src/ | grep -v "cache\|SALT\|formulas\|\.test\."
Result must be empty. If not, do not push.

## RULE 9: PERFORMANCE BUDGET
- Main bundle: < 1600KB raw (currently ~1300KB)
- Gzip: < 400KB (currently ~375KB)
- Heavy components (CoachDashboard, PlanGenerator, Glossary) stay lazy-loaded
- New components > 200 lines should be lazy-loaded

## RULE 10: WHEN IN DOUBT
- Don't change it
- Ask the user
- Suggest the change in chat without implementing
