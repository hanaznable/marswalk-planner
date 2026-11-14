import type {
  LegKind,
  LegResult,
  RouteFailureReason,
  RouteProfile,
  RouteResult,
  Waypoint,
} from './model/types'
import { findPath, type PathFailure } from './pathfinding/findPath'
import type { TerrainGrid } from './pathfinding/terrainGrid'

export interface RoutePlanInput {
  /** Ordered: first is the start, last is the target. */
  readonly waypoints: readonly Waypoint[]
  readonly returnToStart: boolean
}

export interface RouteAlternatives {
  readonly distance: RouteResult
  readonly terrain: RouteResult
  /** True when both routes are complete and follow the same cells. */
  readonly identical: boolean
}

/**
 * Plans every leg in order. A failed leg does not stop later legs, so all
 * problems are visible at once. The return leg is its own search, never a
 * doubled outbound distance.
 */
export function planRoute(
  grid: TerrainGrid,
  input: RoutePlanInput,
  profile: RouteProfile,
): RouteResult {
  const { waypoints, returnToStart } = input
  if (waypoints.length < 2) {
    return { profile, legs: [], complete: false, totalDistanceMeters: null }
  }

  const maxSlopeDegrees = profile.kind === 'terrain' ? profile.maxSlopeDegrees : null
  const pairs: [Waypoint, Waypoint, LegKind][] = []
  for (let i = 1; i < waypoints.length; i++) {
    pairs.push([waypoints[i - 1], waypoints[i], 'outbound'])
  }
  if (returnToStart) {
    pairs.push([waypoints[waypoints.length - 1], waypoints[0], 'return'])
  }

  const legs = pairs.map(([from, to, kind]): LegResult => {
    const result = findPath(grid, from.cell, to.cell, { maxSlopeDegrees })
    const base = { kind, fromId: from.id, toId: to.id }
    return result.status === 'ok'
      ? { status: 'ok', ...base, path: result.path, distanceMeters: result.distanceMeters }
      : { status: 'failed', ...base, reason: toRouteFailure(result.reason, from, to) }
  })

  const complete = legs.every((leg) => leg.status === 'ok')
  const totalDistanceMeters = complete
    ? legs.reduce((sum, leg) => sum + (leg.status === 'ok' ? leg.distanceMeters : 0), 0)
    : null
  return { profile, legs, complete, totalDistanceMeters }
}

/** Plans the same input with both profiles. Identical results are reported, not altered. */
export function planAlternatives(
  grid: TerrainGrid,
  input: RoutePlanInput,
  maxSlopeDegrees: number,
): RouteAlternatives {
  const distance = planRoute(grid, input, { kind: 'distance' })
  const terrain = planRoute(grid, input, {
    kind: 'terrain',
    maxSlopeDegrees,
    slopeLimitIsScenarioAssumption: true,
  })
  return { distance, terrain, identical: sameRoute(distance, terrain) }
}

function toRouteFailure(
  failure: PathFailure,
  from: Waypoint,
  to: Waypoint,
): RouteFailureReason {
  if (failure.code === 'NO_PATH') return failure
  return {
    code: 'WAYPOINT_BLOCKED',
    waypointId: failure.endpoint === 'from' ? from.id : to.id,
    cause: failure.cause,
  }
}

function sameRoute(a: RouteResult, b: RouteResult): boolean {
  if (!a.complete || !b.complete || a.legs.length !== b.legs.length) return false
  return a.legs.every((legA, i) => {
    const legB = b.legs[i]
    if (legA.status !== 'ok' || legB.status !== 'ok') return false
    return (
      legA.path.length === legB.path.length &&
      legA.path.every(
        (cell, j) => cell.row === legB.path[j].row && cell.col === legB.path[j].col,
      )
    )
  })
}
