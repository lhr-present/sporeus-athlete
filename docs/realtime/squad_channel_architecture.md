# Squad Channel Architecture — E11

## Overview

E11 introduces real-time multiplayer between coaches and athletes using Supabase Realtime's three-channel model.

## Channel Topology

```
Coach Dashboard                      Athlete Session View
      │                                      │
      │  useSquadChannel(coachId)            │  useSessionComments(sessionId)
      │  ────────────────────                │  ──────────────────────────────
      │                                      │
      ▼                                      ▼
 channel: squad:{coachId}           channel: session:{sessionId}
  ├── postgres_changes               ├── postgres_changes
  │    training_log (all)            │    session_comments
  │    session_comments (all)        │    (filter: session_id=eq.X)
  │    session_views (all)           │
  └── presence                      ├── broadcast (typing)
       { userId, role, viewing }     └── (no presence — badge reads DB)
```

## Table Design

### session_comments

| Column       | Type        | Notes                                      |
|-------------|-------------|---------------------------------------------|
| id           | uuid PK     | gen_random_uuid()                           |
| session_id   | uuid FK     | → training_log(id) ON DELETE CASCADE        |
| author_id    | uuid FK     | → profiles(id) ON DELETE CASCADE            |
| parent_id    | uuid FK     | self-ref for threading (NULL = top-level)   |
| body         | text        | 1–2000 chars (CHECK constraint)             |
| edited_at    | timestamptz | NULL until first edit                       |
| deleted_at   | timestamptz | NULL = visible; soft delete only            |
| created_at   | timestamptz | DEFAULT now()                               |

**REPLICA IDENTITY FULL** — required for UPDATE/DELETE postgres_changes events.

### session_views

| Column     | Type        | Notes                             |
|-----------|-------------|-----------------------------------|
| user_id    | uuid FK     | → profiles(id) ON DELETE CASCADE  |
| session_id | uuid FK     | → training_log(id) ON DELETE CASCADE |
| viewed_at  | timestamptz | DEFAULT now(); upserted on visit  |

PK: `(user_id, session_id)`

**REPLICA IDENTITY FULL** — required for UPDATE events to carry viewed_at.

## RLS Rules

### session_comments

| Operation | Who can                                        |
|-----------|-----------------------------------------------|
| SELECT    | author_id = user OR session owner OR coach of owner |
| INSERT    | author_id = user AND (owns session OR linked coach) |
| UPDATE    | author_id = user (edit own; soft delete)      |
| DELETE    | Nobody — soft delete only via `deleted_at`    |

### session_views

| Operation | Who can                                               |
|-----------|------------------------------------------------------|
| SELECT    | own rows OR linked coach/athlete sees each other's    |
| INSERT    | own rows only (user_id = auth.uid())                  |
| UPDATE    | own rows only                                         |

## Reconnect Strategy

All realtime channels use `computeBackoff(attempt, 30000)`:

```
attempt 0 → 1s
attempt 1 → 2s
attempt 2 → 4s
attempt 3 → 8s
attempt 4 → 16s
attempt 5+ → 30s (MAX_RETRY cap varies by hook)
```

Status is reported to `realtimeStatus.js` registry so ConnectionBanner can aggregate it.

## Optimistic Updates (useSessionComments)

1. On `postComment(body)`: insert a `_optimistic: true` row immediately
2. Send to Supabase
3. On success: replace optimistic row with confirmed row (ID match)
4. On error: remove optimistic row
5. On `queued: true` (offline): leave optimistic row until Realtime echoes the INSERT

## Privacy

- Push notifications via `comment-notification` edge function contain **no comment body** — only "X added a comment"
- Coach presence (session_views) is visible to the linked athlete only — RLS enforces this
- `session_views.viewed_at` does not expose what the coach saw, only that they opened the session
