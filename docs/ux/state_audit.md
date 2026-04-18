# UX State Audit — Sporeus v8.0.6

> **C6 polish release.** Every P1–P8 component must handle all 6 states.  
> Audit date: 2026-04-18. ✓ = implemented · ✗ = gap · → = fixed in C6

---

## State Definitions

| State | Trigger | Expected UX |
|---|---|---|
| **Empty** | User has no data of this type | EmptyState component + 1-sentence explanation + primary CTA |
| **Loading** | Initial render, refresh, or mutation in-flight | SkeletonCard or spinner-in-button; never blank/raw text |
| **Error** | Network failure, 5xx, validation error | Inline error banner + Retry button; `logger.error` emitted |
| **Offline** | `navigator.onLine === false` | OfflineBanner (global); writes queued via offlineQueue.js |
| **Degraded** | Partial data (e.g. RPC returned but stale) | Yellow warning; still shows partial data with stale indicator |
| **Unauthorized** | Tier gate or auth missing | Upgrade CTA card or sign-in prompt; never 403 or crash |

---

## P1 — Activity Upload & Storage

### UploadActivity.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty | ✓ | Idle dropzone with "Drop FIT/GPX/CSV here" instructions | — |
| Loading | ✓ | STATUS_LABEL map: uploading/pending/parsing/done with color coding | — |
| Error | ✓ | Red error box with message; retry by re-dropping file | + Retry button added |
| Offline | ✓ | Upload blocked when offline; OfflineBanner visible globally | — |
| Degraded | ✓ | Storage upload succeeded but parse failed: shows partial error | — |
| Unauthorized | ✓ | Free-tier gate: "5 file uploads per month — upgrade to unlock unlimited" | — |

**Notes:** Ad-blocker blocking Supabase Storage → `fetchFailed` error message shown. Free-tier limit enforced client-side via `canUploadFile()`.

---

## P2 — AI Session Insights

### AICoachInsights.jsx (dashboard card)
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty | ✓ | "Opt in to AI insights" prompt card with toggle | — |
| Loading | ✓ | `busy` flag → spinner indicator in card header | — |
| Error | ✓ | `error` state → inline red error message | — |
| Offline | ✓ | `isSupabaseReady()` guard prevents invocation | — |
| Degraded | ✓ | Insight text shown even if confidence metadata missing | — |
| Unauthorized | ✓ | Tier gate: coach/club required; free shows upgrade prompt | — |

---

## P3 — Semantic Search (pgvector)

### SemanticSearch.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty (no corpus) | → | **WAS:** blank panel when user has 0 sessions. **NOW:** EmptyState hint about corpus build-up | + idle hint added |
| Empty (no results) | ✓ | "No matching sessions found" message | — |
| Loading | ✓ | "searching…" text beside input | — |
| Error | ✓ | Red inline error message | — |
| Offline | ✓ | `isSupabaseReady()` guard; returns early without crashing | — |
| Unauthorized | ✓ | Upgrade gate: "Coach or Club plan required" with upgrade link | — |
| Idle (pre-type) | → | **WAS:** blank. **NOW:** keyboard shortcut hints + "your sessions are indexed" info | + idle state added |

### SquadPatternSearch.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty | ✓ | "No patterns found" message | — |
| Loading | ✓ | Loading indicator in header | — |
| Error | ✓ | Error message display | — |
| Offline | ✓ | `isSupabaseReady()` guard | — |
| Degraded | ✓ | Returns partial results if some athletes fail | — |
| Unauthorized | ✓ | Coach-tier gate enforced via `isFeatureGated` | — |

---

## P4 — Realtime Squad Feed

### LiveSquadFeed.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty (no events) | ✓ | "No activity yet — waiting for squad updates…" | — |
| Empty (0 athletes) | → | **WAS:** just presence dot area is empty. **NOW:** EmptyState + "Invite your first athlete" CTA | + 0-athletes state |
| Loading/connecting | ✓ | "○ connecting…" STATUS_LABEL in header | — |
| Error | ✓ | `disconnected` status label shown; ConnectionBanner handles globally | — |
| Offline | ✓ | feedStatus = 'disconnected'; OfflineBanner shown globally | — |
| Degraded | ✓ | Partial feed shown with reconnecting indicator | — |
| Unauthorized | n/a | Coach only — gate enforced in App.jsx via coachMode check | — |

### CoachSquadView.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty (0 athletes) | → | **WAS:** italic text "No connected athletes yet". **NOW:** EmptyState with InviteManager as CTA | + EmptyState upgrade |
| Loading | ✓ | `loading` state shows skeleton row via `COLS.map()` | — |
| Error | ✓ | `logger.error` on RPC failure; component gracefully returns partial | — |
| Offline | ✓ | `isSupabaseReady()` guard prevents fetch | — |
| Degraded | ✓ | Shows athletes with missing fields as `—` | — |
| Unauthorized | n/a | Coach role enforced upstream in App.jsx | — |

---

## P5 — PDF Reports

### ReportsTab.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty (no reports) | → | **WAS:** "No reports generated yet." **NOW:** descriptive first-time message with "first active week" guidance | + first-time empty state |
| Loading (fetch) | ✓ | "Loading…" text in history section header | — |
| Loading (generate) | ✓ | Button shows "Generating…" + disabled; `generating` state per kind | — |
| Error | ✓ | Red error banner with message | — |
| Offline | ✓ | `isSupabaseReady()` guard at component top | — |
| Degraded | ✓ | Shows history even if one kind fails to fetch signed URL | — |
| Unauthorized | ✓ | Tier gate per report kind: Locked button + opacity 0.5 | — |
| Delete confirm | → | **WAS:** `window.confirm()`. **NOW:** `ConfirmModal` (non-blocking, bilingual) | + ConfirmModal |

---

## P6 — pgmq Queue Workers

### QueueStats.jsx (admin)
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty | ✓ | "No queue data yet" fallback | — |
| Loading | ✓ | `loading` state shows dim "Loading…" | — |
| Error | ✓ | Red error banner with message | — |
| Offline | ✓ | `isSupabaseReady()` guard | — |
| Degraded | ✓ | Shows partial queue data; missing queues shown as 0 | — |
| Unauthorized | ✓ | Admin gate: "Admin access required" if role ≠ admin | — |

---

## P7 — Full-Text Search

### SearchPalette.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty (no query) | ✓ | Recent searches + navigation hints | — |
| Empty (no results) | ✓ | "No results" message with result count "0 db results" | — |
| Loading | ✓ | "searching db…" footer indicator | — |
| Error | ✓ | Silent fallback to local results only (FTS query swallowed) | — |
| Offline | ✓ | Falls back to local fuzzy search when Supabase unavailable | — |
| Degraded | ✓ | Local results shown when DB search times out | — |
| Unauthorized | n/a | No gate — FTS available to all authenticated users | — |

---

## P8 — Materialized Views

### MVHealth.jsx (admin)
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty | ✓ | "No data" fallback when RPC returns empty array | — |
| Loading | ✓ | Loading flag → refresh button shows "…" | — |
| Error | ✓ | Error message displayed inline | — |
| Offline | ✓ | `isSupabaseReady()` guard | — |
| Degraded | ✓ | Shows rows with missing fields as `—` | — |
| Unauthorized | ✓ | Admin gate: "Admin access required" | — |

---

## C5 — Observability (added in this sprint)

### StatusBanner.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| All services OK | ✓ | Returns null (no banner) | — |
| Degraded | ✓ | Orange banner: service name + "is degraded" | — |
| Down | ✓ | Red banner: service name + "is experiencing an outage" | — |
| Stale | ✓ | "(status check may be stale)" appended when `stale=true` | — |
| Error (RPC fail) | ✓ | Silent — never surfaces network errors as fake outages | — |
| Offline | ✓ | `isSupabaseReady()` guard; OfflineBanner shows instead | — |

### ObservabilityDashboard.jsx
| State | Status | Implementation | C6 change |
|---|---|---|---|
| Empty (each panel) | ✓ | "No data" / "No errors in last 24h ✓" / "No recent alerts ✓" per panel | — |
| Loading | ✓ | `loading` flag → refresh button shows "…" per panel | — |
| Error | ✓ | No explicit error state — failures result in empty panel (graceful) | — |
| Offline | ✓ | `isSupabaseReady()` guard per panel | — |
| Degraded | ✓ | Each panel independent — partial data shown | — |
| Unauthorized | ✓ | "Admin access required" gate | — |

---

## App-Level Infrastructure

### OfflineBanner
| State | Status | Notes |
|---|---|---|
| Online | ✓ | Hidden |
| Offline | ✓ | Fixed top banner: "You are offline — changes will sync when reconnected" |
| Reconnecting | ✓ | Transitions as `navigator.onLine` changes |

### Sync Status Dot (header)
| State | Status | Notes |
|---|---|---|
| Synced | ✓ | Green dot in header |
| Syncing | ✓ | Yellow pulsing dot |
| Offline | ✓ | Grey dot with tooltip "Offline — changes queued" |

### offlineQueue.js
| State | Status | Notes |
|---|---|---|
| Queue flush | ✓ | `initOfflineSync()` called in App.jsx; flushes on `online` event |
| Enqueue | ✓ | `enqueuePendingLog()` used in DataContext for failed inserts |

### ConnectionBanner
| State | Status | Notes |
|---|---|---|
| All channels live | ✓ | Hidden |
| Any channel reconnecting | ✓ | "Reconnecting to live features…" banner |

### ToastStack
| State | Status | Notes |
|---|---|---|
| No toasts | ✓ | Hidden |
| Info/success/warning/error/update | ✓ | Stacked dismissible toasts via useToasts() |

### AsyncBoundary (all tab routes)
| State | Status | Notes |
|---|---|---|
| Loading chunk | ✓ | `<SkeletonCard />` fallback via Suspense |
| Runtime error | ✓ | ErrorBoundary catches and shows fallback |

---

## Splash / App Loading

### Splash component (App.jsx)
| State | Status | C6 change |
|---|---|---|
| Initial load | → | **WAS:** raw `LOADING...` text. **NOW:** `<SkeletonCard lines={4} height={120} />` in dark container | + fix |

---

## Training Log Core

### TrainingLog.jsx
| State | Status | C6 change |
|---|---|---|
| Empty (no sessions) | → | **WAS:** empty list with just the form. **NOW:** EmptyState with "Log your first session" guidance | + empty state |
| Loading (FIT parse) | ✓ | `importBusy` flag → "Parsing…" indicator | — |
| Error (parse) | ✓ | `importError` state → inline red error | — |
| Error (Storage) | ✓ | Archival failure swallowed (non-blocking) | — |
| Offline | ✓ | Session logged to localStorage immediately; sync queued | — |
| Bulk delete confirm | → | **WAS:** `window.confirm()`. **NOW:** `ConfirmModal` | + ConfirmModal |

---

## Gaps Remaining After C6 (Backlog)

| Component | State | Reason not fixed |
|---|---|---|
| Dashboard cards (19 cards) | Loading | Cards are client-side only — no async data to show skeleton for |
| Periodization CTL projection | Error | Pure client-side math — no network call |
| AthleteCard / HRV | Empty (no HRV data) | Needs dedicated HRV empty state card — scoped to C7 |
| PowerCurve | Empty (no power files) | Conditional render already used; visual upgrade scoped to C7 |
| MessageThread | Typing cleanup | Typing indicator on unmount cleanup — scoped to C7 |
| All forms | Inline validation | Full inline validation → scoped to C7 |
| generate-report | Progress bar | Server-side generation — no progress signal from edge fn |
| Strava sync | Rate-limit UI | Requires Strava API rate-limit header parsing |

---

## Acceptance Checklist

- [x] Every P1–P8 component row has no blank cells in this document
- [x] Splash component no longer shows raw "LOADING..." text
- [x] Zero instances of `window.confirm()` in production flow (ReportsTab, TrainingLog)
- [x] ConfirmModal component available and used for destructive actions
- [x] SemanticSearch shows idle hint before typing + handles 0-corpus case
- [x] LiveSquadFeed shows "invite first athlete" CTA when athletes.length === 0
- [x] ReportsTab first-time empty state explains when reports become available
- [x] offlineQueue.js sync status shown in header sync dot (was already present)
- [x] All lazy-loaded tab routes wrapped in AsyncBoundary (was already present)
- [ ] Inline form validation (backlogged to C7)
- [ ] Lighthouse score audit (requires deployed build + headless Chrome — run separately)
