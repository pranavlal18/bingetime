// Concurrency + spacing queue for TMDb.
//
// TMDb allows ~40 req/10s sustained. This queue enforces:
//   - maxConcurrent 2 in-flight requests
//   - minInterval 250ms between dispatches (~4 req/s sustained)
//   - 8s fetch timeout (a hung request can't hold a slot forever)
//   - 429 retry OUTSIDE the concurrency slot: release, sleep with
//     Retry-After + jitter, re-enqueue fresh (no head-of-line blocking)

const MAX_CONCURRENT = 2
const MIN_INTERVAL = 250 // ms between dispatches
const FETCH_TIMEOUT = 8000 // ms

class TmdbQueue {
  private queue: Array<() => void> = []
  private active = 0
  private lastDispatchAt = 0

  private schedule() {
    if (this.active >= MAX_CONCURRENT) return
    const task = this.queue.shift()
    if (!task) return

    // Reserve this task's slot on the timeline BEFORE the timeout so N queued
    // tasks stagger at t, t+interval, t+2*interval… instead of all computing
    // the same `wait` and bursting simultaneously.
    const now = Date.now()
    const wait = Math.max(0, this.lastDispatchAt + MIN_INTERVAL - now)
    this.lastDispatchAt = now + wait
    this.active++
    setTimeout(() => task(), wait)
  }

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.active--
            this.schedule()
          })
      }
      this.queue.push(run)
      this.schedule()
    })
  }
}

export const tmdbQueue = new TmdbQueue()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** fetch with hard timeout — AbortSignal.timeout is unavailable in Hermes */
async function fetchWithTimeout(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Enqueued fetch with automatic 429 backoff.
 * Retry sleeps OUTSIDE the queue slot, then re-enqueues as a fresh task.
 */
export async function throttledFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let attempts = 2
  for (;;) {
    const res = await tmdbQueue.enqueue(() => fetchWithTimeout(input, init))
    if (res.status !== 429 || attempts <= 1) return res
    attempts--
    // TMDb may send fractional seconds ("0.5") — parseFloat, not parseInt
    const retryAfter = parseFloat(res.headers.get('Retry-After') ?? '')
    const base = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1200
    await sleep(base * (1 + Math.random() * 0.3)) // ±30% jitter avoids thundering herd
  }
}
