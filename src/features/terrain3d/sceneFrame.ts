/**
 * Coordinate conventions for the 3D terrain view. Pure TypeScript: no Three.js,
 * no React, nothing region-specific. Everything is derived from the manifest
 * and the loaded elevation layer.
 *
 * Source CRS (north-up, metres)          Scene (Three.js, right-handed, metres)
 *   x = east                               +x = east
 *   y = north                              -z = north   (+z = south)
 *   elevation (Mars datum)                 +y = up
 *
 * The scene origin is the centre of the raster footprint (horizontal) and the
 * local vertical origin (see `verticalOrigin`). Scene height is
 * (elevation - verticalOrigin) * verticalScale. The vertical scale is a display
 * setting only; it never feeds routing, slope, distance or EVA values, which
 * keep using the original package values.
 */
import { rasterBounds, type MapPoint, type RasterGrid } from '../datasets/terrainContract'

export interface SceneFrame {
  /** Footprint centre in the source CRS. */
  readonly centre: MapPoint
  /** Elevation (m, Mars datum) placed at scene y = 0. */
  readonly verticalOrigin: number
  /** Display-only vertical exaggeration; 1 = physically faithful. */
  readonly verticalScale: number
}

export interface ScenePoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface ElevationRange {
  readonly min: number
  readonly max: number
}

/** Finite elevation range, or null when the layer has no valid sample. */
export function elevationRange(elevation: ArrayLike<number>): ElevationRange | null {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < elevation.length; i++) {
    const value = elevation[i]
    if (!Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }
  return min <= max ? { min, max } : null
}

/**
 * Local vertical origin: the midpoint of the valid elevation range. Keeps scene
 * numbers small (heights near -4,000 m are valid Mars-datum values) without
 * altering any stored elevation.
 */
export function verticalOrigin(range: ElevationRange): number {
  return (range.min + range.max) / 2
}

export function createSceneFrame(
  raster: RasterGrid,
  range: ElevationRange,
  verticalScale = 1,
): SceneFrame {
  if (!(verticalScale > 0) || !Number.isFinite(verticalScale)) {
    throw new RangeError('verticalScale must be a positive finite number')
  }
  const { minX, maxX, minY, maxY } = rasterBounds(raster)
  return {
    centre: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    verticalOrigin: verticalOrigin(range),
    verticalScale,
  }
}

/** Source east/north/elevation to scene coordinates. */
export function toScene(frame: SceneFrame, point: MapPoint, elevation: number): ScenePoint {
  return {
    x: point.x - frame.centre.x,
    y: (elevation - frame.verticalOrigin) * frame.verticalScale,
    z: -(point.y - frame.centre.y),
  }
}

/** Scene x/z back to the source CRS (height is not needed for map lookups). */
export function fromScene(frame: SceneFrame, point: { x: number; z: number }): MapPoint {
  return { x: point.x + frame.centre.x, y: frame.centre.y - point.z }
}

/** Scene height back to the original elevation in metres. */
export function sceneHeightToElevation(frame: SceneFrame, y: number): number {
  return y / frame.verticalScale + frame.verticalOrigin
}

/** Horizontal half-extents of the footprint in the scene (metres). */
export function footprintHalfSize(raster: RasterGrid): { halfX: number; halfZ: number } {
  const { minX, maxX, minY, maxY } = rasterBounds(raster)
  return { halfX: (maxX - minX) / 2, halfZ: (maxY - minY) / 2 }
}
