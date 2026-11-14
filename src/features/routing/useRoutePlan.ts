import { useMemo } from 'react'
import { elevationAt, type TerrainPackage } from '../datasets/terrainPackage'
import type { Waypoint } from './model/types'
import { terrainPackageToGrid } from './adapters/terrainPackageGrid'
import { planAlternatives, type RouteAlternatives, type SlopeAssumptions } from './planRoute'
import { summarizeRoute, type RouteSummary } from './routeStats'

export interface RoutePlan {
  readonly alternatives: RouteAlternatives
  readonly distanceSummary: RouteSummary
  readonly terrainSummary: RouteSummary
}

/**
 * Recomputes both route alternatives whenever the waypoints or planning
 * assumptions change. Null until there are at least two waypoints.
 */
export function useRoutePlan(
  terrain: TerrainPackage | null,
  waypoints: readonly Waypoint[],
  assumptions: SlopeAssumptions,
  returnToStart: boolean,
): RoutePlan | null {
  const grid = useMemo(() => (terrain ? terrainPackageToGrid(terrain) : null), [terrain])

  return useMemo(() => {
    if (!terrain || !grid || waypoints.length < 2) return null
    const alternatives = planAlternatives(grid, { waypoints, returnToStart }, assumptions)
    const elevation = (cell: Waypoint['cell']) => elevationAt(terrain, cell)
    return {
      alternatives,
      distanceSummary: summarizeRoute(alternatives.distance, elevation),
      terrainSummary: summarizeRoute(alternatives.terrain, elevation),
    }
  }, [terrain, grid, waypoints, assumptions, returnToStart])
}
