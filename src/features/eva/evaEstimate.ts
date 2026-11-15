import type { GridCell, RouteResult } from '../routing'

/**
 * User scenario inputs. A simple planning estimate, not a physiological model:
 * no fatigue, suit, terrain-dependent speed, or life-support constraints.
 */
export interface EvaAssumptions {
  /** Usable primary oxygen at departure, per astronaut; legacy plans omit it. */
  readonly oxygenCapacityKg?: number
  /** Average walking speed, km/h. */
  readonly walkingSpeedKmh: number
  /** Time spent at each waypoint after the start, minutes. */
  readonly stopMinutes: number
}

export interface DurationEstimate {
  readonly walkingMinutes: number
  readonly stopCount: number
  readonly stopMinutes: number
  readonly totalMinutes: number
}

/**
 * Walking time from the route's real path length plus stop time at every
 * waypoint after the start (stops and destination). Null for incomplete routes.
 */
export function estimateDuration(
  result: RouteResult,
  { walkingSpeedKmh, stopMinutes }: EvaAssumptions,
): DurationEstimate | null {
  if (!Number.isFinite(walkingSpeedKmh) || walkingSpeedKmh <= 0) {
    throw new RangeError('walkingSpeedKmh must be a finite number above zero')
  }
  if (!Number.isFinite(stopMinutes) || stopMinutes < 0) {
    throw new RangeError('stopMinutes must be a finite, non-negative number')
  }
  if (!result.complete || result.totalDistanceMeters === null) return null

  const metresPerMinute = (walkingSpeedKmh * 1000) / 60
  const walkingMinutes = result.totalDistanceMeters / metresPerMinute
  // Outbound legs each end at a stop or the destination; the return leg ends at the start.
  const stopCount = result.legs.filter((leg) => leg.kind === 'outbound').length
  const totalStopMinutes = stopCount * stopMinutes
  return {
    walkingMinutes,
    stopCount,
    stopMinutes: totalStopMinutes,
    totalMinutes: walkingMinutes + totalStopMinutes,
  }
}

export interface ProfilePoint {
  readonly distanceMeters: number
  readonly elevationMeters: number
}

/**
 * Elevation against cumulative path distance over all legs. Null if the route
 * is incomplete or any cell lacks elevation, so gaps are never drawn as data.
 */
export function elevationProfile(
  result: RouteResult,
  elevationAt: (cell: GridCell) => number | null,
  cellSizeMeters: number,
): ProfilePoint[] | null {
  if (!result.complete) return null
  const points: ProfilePoint[] = []
  let distance = 0
  let previous: GridCell | null = null
  for (const leg of result.legs) {
    if (leg.status !== 'ok') return null
    leg.path.forEach((cell, index) => {
      // Each leg starts where the previous one ended; skip the repeated cell.
      if (index === 0 && previous !== null) return
      if (previous !== null) {
        const diagonal = cell.row !== previous.row && cell.col !== previous.col
        distance += diagonal ? cellSizeMeters * Math.SQRT2 : cellSizeMeters
      }
      points.push({ distanceMeters: distance, elevationMeters: elevationAt(cell) ?? Number.NaN })
      previous = cell
    })
  }
  return points.some((point) => Number.isNaN(point.elevationMeters)) ? null : points
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—'
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded} min`
  return `${Math.floor(rounded / 60)} h ${rounded % 60} min`
}
