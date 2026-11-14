import type { BlockCause, GridCell, RouteFailureReason, RouteResult } from './model/types'

export interface RouteSummary {
  /** Null unless the route is complete. Unknown values are never zero. */
  readonly distanceMeters: number | null
  readonly elevationGainMeters: number | null
  readonly elevationLossMeters: number | null
}

/** Totals over every leg. Elevation is empty if any cell on the route lacks it. */
export function summarizeRoute(
  result: RouteResult,
  elevationAt: (cell: GridCell) => number | null,
): RouteSummary {
  const empty = { distanceMeters: null, elevationGainMeters: null, elevationLossMeters: null }
  if (!result.complete) return empty

  let gain = 0
  let loss = 0
  let elevationKnown = true
  for (const leg of result.legs) {
    if (leg.status !== 'ok') return empty
    let previous: number | null = null
    for (const cell of leg.path) {
      const elevation = elevationAt(cell)
      if (elevation === null) {
        elevationKnown = false
        break
      }
      if (previous !== null) {
        const change = elevation - previous
        if (change > 0) gain += change
        else loss -= change
      }
      previous = elevation
    }
  }
  return {
    distanceMeters: result.totalDistanceMeters,
    elevationGainMeters: elevationKnown ? gain : null,
    elevationLossMeters: elevationKnown ? loss : null,
  }
}

const WAYPOINT_CAUSE: Record<BlockCause, string> = {
  outOfCoverage: 'is outside the terrain area',
  noData: 'has no terrain data',
  hazard: 'is on a known hazard',
  slope: 'is steeper than the slope limit',
}

const PATH_CAUSE: Record<BlockCause, string> = {
  outOfCoverage: 'The terrain edge cuts off every way through.',
  noData: 'Missing terrain data cuts off every way through.',
  hazard: 'Known hazards cut off every way through.',
  slope: 'Every way through is steeper than the slope limit.',
}

export function describeFailure(
  reason: RouteFailureReason,
  roleOf: (waypointId: string) => string,
): string {
  if (reason.code === 'WAYPOINT_BLOCKED') {
    return `${roleOf(reason.waypointId)} ${WAYPOINT_CAUSE[reason.cause]}.`
  }
  if (reason.blockedBy.length === 0) return 'No way through the terrain.'
  return reason.blockedBy.map((cause) => PATH_CAUSE[cause]).join(' ')
}

export function formatDistance(meters: number | null): string {
  if (meters === null) return '—'
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`
}
