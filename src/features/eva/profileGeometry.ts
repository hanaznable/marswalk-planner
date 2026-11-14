import type { ProfilePoint } from './evaEstimate'

/** Nearest profile point to a distance along the route (clamped to the ends). */
export function pointAtDistance(
  profile: readonly ProfilePoint[],
  distanceMeters: number,
): ProfilePoint | null {
  let best: ProfilePoint | null = null
  let bestGap = Infinity
  for (const point of profile) {
    const gap = Math.abs(point.distanceMeters - distanceMeters)
    if (gap < bestGap) {
      best = point
      bestGap = gap
    }
  }
  return best
}

/** Round axis ticks (steps of 1, 2 or 5 × 10^n) inside [min, max]. */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min]
  const raw = (max - min) / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) as number
  const ticks: number[] = []
  for (let tick = Math.ceil(min / step) * step; tick <= max + 1e-9; tick += step) {
    ticks.push(Math.round(tick / step) * step + 0) // + 0 turns -0 into 0
  }
  return ticks
}
