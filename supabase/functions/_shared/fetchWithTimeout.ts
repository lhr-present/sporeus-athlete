// _shared/fetchWithTimeout.ts — fetch() with an AbortController timeout.
//
// LLM completion and embedding endpoints occasionally hang. Without a timeout a
// single stalled upstream request ties the edge function up until the platform's
// hard wall-clock limit, burning the whole invocation (and, for queue workers,
// stalling the batch). This wraps fetch with an abort timer and always clears it.
//
// Defaults to 20s — generous enough for Haiku/embeddings but far below the
// platform ceiling. Pass a smaller value for latency-sensitive calls.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20_000,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}
