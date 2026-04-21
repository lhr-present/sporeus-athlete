# TanStack Query v5 — Pattern Guide

## Why TQ was added (G2)

The previous `useEffect + supabase.from()` pattern fetched on mount only. Switching tabs
and back caused stale reads until re-mount. TQ adds:

- **Request deduplication** — multiple components requesting the same data share one request
- **Background refetch** — stale data triggers a silent refetch on window focus
- **Optimistic updates** — UI reflects mutations instantly; server confirms async
- **Cache invalidation** — explicit invalidation after mutations keeps data fresh
- **DevTools** — visible in dev mode (bottom-right corner), zero production cost

## Three flows migrated (G2 scope)

| Flow | Query key | Hook |
|------|-----------|------|
| Training log | `['training_log', userId]` | `useTrainingLogQuery` |
| Profile | `['profile', userId]` | `useProfileQuery` |
| Session comments | `['session_comments', sessionId]` | TQ cache seeded in `useSessionComments` |

Remaining flows (recovery, injuries, testResults, raceResults) keep the original
`useSyncedTable` pattern. Migrate them when the pattern is proven stable.

## QueryClient setup

`src/App.jsx` creates a single `QueryClient` at module scope:

```js
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
})
```

Wrapped around `DataProvider` (which calls the TQ hooks):

```jsx
<QueryClientProvider client={queryClient}>
  <DataProvider userId={userId}>
    <AppInner />
  </DataProvider>
  {import.meta.env.DEV && <Suspense fallback={null}><ReactQueryDevtools /></Suspense>}
</QueryClientProvider>
```

## The localStorage-first invariant

All three migrated hooks preserve the offline-first design:
1. `initialData: lsData` — localStorage is served immediately, no loading flash
2. `initialDataUpdatedAt: 0` — marks initial data as stale so a server fetch fires on mount
3. On successful fetch, localStorage is updated (`setLsData(serverData)`)
4. On fetch failure, localStorage data remains in TQ cache

This means the app works offline and on first render identically to before.

## Adding a new TQ query

```js
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalStorage } from './useLocalStorage.js'

export const myQueryKey = (userId) => ['my_table', userId ?? 'guest']

export function useMyQuery(userId) {
  const [lsData, setLsData] = useLocalStorage('sporeus-my-table', [])
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: myQueryKey(userId),
    queryFn: async () => {
      if (!isSupabaseReady() || !userId) return lsData
      const { data: rows, error } = await supabase.from('my_table').select('*').eq('user_id', userId)
      if (error) throw error
      setLsData(rows)
      return rows
    },
    initialData: lsData,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  })

  const setData = useCallback((fnOrValue) => {
    const qKey = myQueryKey(userId)
    const prev = qc.getQueryData(qKey) ?? []
    const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue
    qc.setQueryData(qKey, next)
    setLsData(next)
    if (isSupabaseReady() && userId) {
      Promise.resolve().then(async () => {
        // ... Supabase writes
        qc.invalidateQueries({ queryKey: qKey })
      })
    }
  }, [userId, qc, setLsData]) // eslint-disable-line

  return [data ?? lsData, setData]
}
```

## Testing TQ hooks

Tests must provide a `QueryClientProvider` wrapper:

```js
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }) => createElement(QueryClientProvider, { client: qc }, children)
}

const { result } = renderHook(() => useMyQuery(null), { wrapper: makeWrapper() })
```

Hooks called from `useSessionComments` (or similar) that don't need their own wrapper
can mock `useQueryClient`:

```js
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  })),
}))
```
