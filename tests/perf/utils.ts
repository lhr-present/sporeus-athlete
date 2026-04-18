// tests/perf/utils.ts — shared helpers for perf scenarios
import { performance } from 'perf_hooks';

/** Return the Nth percentile (0–1) of a sorted array of millisecond durations. */
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx    = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

/**
 * Time a single async operation.
 * Returns [duration_ms, result].
 */
export async function timed<T>(fn: () => Promise<T>): Promise<[number, T]> {
  const t0  = performance.now();
  const val = await fn();
  return [Math.round(performance.now() - t0), val];
}

/**
 * Run `fn` N times sequentially and return an array of durations in ms.
 * Throws on first error so failures aren't silently swallowed.
 */
export async function runN(n: number, fn: () => Promise<void>): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    await fn();
    times.push(Math.round(performance.now() - t0));
  }
  return times;
}

/** Sleep for `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
