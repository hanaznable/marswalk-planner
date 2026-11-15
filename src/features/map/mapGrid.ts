import { rasterBounds, type RasterGrid } from '../datasets/terrainContract'

/** Display spacing in source metres, independent of zoom and routing cells. */
export function gridSpacing(raster: RasterGrid): number {
  const b = rasterBounds(raster)
  return 10 ** Math.floor(Math.log10(Math.max(b.maxX - b.minX, b.maxY - b.minY) / 10))
}
