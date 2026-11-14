import { useMemo } from 'react'
import { cellSizeMeters } from '../datasets/terrainContract'
import { elevationAt, type TerrainPackage } from '../datasets/terrainPackage'
import type { GridCell } from '../routing'
import type { RoutePlan } from '../routing/useRoutePlan'
import {
  elevationProfile,
  estimateDuration,
  type DurationEstimate,
  type EvaAssumptions,
  type ProfilePoint,
} from './evaEstimate'

export interface EvaPlan {
  readonly shortest: { duration: DurationEstimate | null; profile: ProfilePoint[] | null }
  readonly slopeAware: { duration: DurationEstimate | null; profile: ProfilePoint[] | null }
}

/** Duration estimates and elevation profiles for both route alternatives. */
export function useEvaPlan(
  plan: RoutePlan | null,
  terrain: TerrainPackage | null,
  assumptions: EvaAssumptions,
): EvaPlan | null {
  return useMemo(() => {
    if (!plan || !terrain) return null
    const elevation = (cell: GridCell) => elevationAt(terrain, cell)
    const cellSize = cellSizeMeters(terrain.manifest.raster)
    const { distance, terrain: slopeAware } = plan.alternatives
    return {
      shortest: {
        duration: estimateDuration(distance, assumptions),
        profile: elevationProfile(distance, elevation, cellSize),
      },
      slopeAware: {
        duration: estimateDuration(slopeAware, assumptions),
        profile: elevationProfile(slopeAware, elevation, cellSize),
      },
    }
  }, [plan, terrain, assumptions])
}
