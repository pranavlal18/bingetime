// Simple concurrency + throttle queue for TMDb
// 5 concurrent, 200ms spacing, respects Retry-After on 429

class TmdbQueue {
  private queue: Array<() => void> = []
  private active = 0
  private readonly maxConcurrent = 5
  private lastRun = 0
  private readonly minInterval = 200 // ms between dispatches

  private schedule() {
    if (this.active >= this.maxConcurrent) return
    const task = this.queue.shift()
    if (!task) return
    const now = Date.now()
    const wait = Math.max(0, this.minInterval - (now - this.lastRun))
    this.active++
    setTimeout(() => {
      this.lastRun = Date.now()
      task()
    }, wait)
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

export async function throttledFetch(input: RequestInfo, init?: RequestInit, retries = 1): Promise<Response> {
  return tmdbQueue.enqueue(async () => {
    const res = await fetch(input, init)
    if (res.status === 429 && retries > 0) {
      const retryAfter = res.headers.get('Retry-After')
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1200
      await new Promise(r => setTimeout(r, delay))
      return throttledFetch(input, init, retries - 1)
    }
    return res
  })
}
