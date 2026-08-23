import { HttpError } from './errors'

const counters = new Map<string, number>()
let currentDay = ''

function resetIfNeeded(): void {
  const day = new Date().toISOString().slice(0, 10)
  if (day !== currentDay) {
    currentDay = day
    counters.clear()
  }
}

export function checkAndIncrement(key: string, limit: number, message: string): void {
  resetIfNeeded()
  const used = counters.get(key) ?? 0
  if (used >= limit) throw new HttpError(429, message)
  counters.set(key, used + 1)
}
