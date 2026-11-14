import { cellSizeMeters } from '../../datasets/terrainContract'
import type { TerrainPackage } from '../../datasets/terrainPackage'
import { createTerrainGrid, type TerrainGrid } from '../pathfinding/terrainGrid'

/**
 * Builds the routing grid from a terrain package. A cell is usable only when
 * both elevation and pipeline slope are valid; anything else becomes no data,
 * which routing never treats as safe. Contract v1 has no hazard layer.
 */
export function terrainPackageToGrid(pkg: TerrainPackage): TerrainGrid {
  const { raster } = pkg.manifest
  const slopeDegrees = Array.from(pkg.slope, (slope, index) =>
    Number.isFinite(slope) && slope >= 0 && Number.isFinite(pkg.elevation[index])
      ? slope
      : null,
  )
  return createTerrainGrid({
    rows: raster.height,
    cols: raster.width,
    cellSizeMeters: cellSizeMeters(raster),
    slopeDegrees,
  })
}
