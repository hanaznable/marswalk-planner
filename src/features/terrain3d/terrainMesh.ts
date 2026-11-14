/**
 * Terrain mesh construction from a terrain package. Pure TypeScript; the scene
 * wraps the typed arrays in a Three.js BufferGeometry.
 *
 * One vertex per elevation cell, at the cell centre (the DEM value represents
 * the cell, and routing paths run through cell centres, so routes sit exactly
 * on mesh vertices). The drawn surface therefore stops half a cell inside the
 * footprint edges; nothing is extrapolated beyond the outermost samples.
 *
 * A triangle is emitted only when all three of its vertices have elevation
 * data. No-data cells leave holes: no terrain is invented to fill gaps.
 *
 * UVs are relative to the raster footprint: u grows east, v grows north
 * (v = 1 at the north edge), which matches an image texture with the default
 * flipY, where image row 0 is the north edge. Imagery with a different
 * footprint is fitted with `imageUvTransform`.
 */
import { rasterBounds, type RasterGrid } from '../datasets/terrainContract'
import type { SceneFrame } from './sceneFrame'

export interface TerrainMeshData {
  /** xyz per vertex, scene metres, vertical scale 1 (exaggeration is applied by the scene). */
  readonly positions: Float32Array
  /** uv per vertex in the raster footprint. */
  readonly uvs: Float32Array
  /** Triangle vertex indices, counter-clockwise seen from above. */
  readonly indices: Uint32Array
  readonly vertexCount: number
  readonly triangleCount: number
}

export function buildTerrainMesh(
  raster: RasterGrid,
  elevation: Float32Array,
  frame: SceneFrame,
): TerrainMeshData {
  const { width, height } = raster
  if (elevation.length !== width * height) {
    throw new RangeError(`elevation must have ${width * height} values, got ${elevation.length}`)
  }
  const [x0, dx, , y0, , dy] = raster.geoTransform
  const positions = new Float32Array(width * height * 3)
  const uvs = new Float32Array(width * height * 2)

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col
      const east = x0 + (col + 0.5) * dx
      const north = y0 + (row + 0.5) * dy
      const value = elevation[i]
      positions[i * 3] = east - frame.centre.x
      // No-data vertices are never referenced by a triangle; 0 keeps the buffer finite.
      positions[i * 3 + 1] = Number.isFinite(value) ? value - frame.verticalOrigin : 0
      positions[i * 3 + 2] = -(north - frame.centre.y)
      uvs[i * 2] = (col + 0.5) / width
      uvs[i * 2 + 1] = 1 - (row + 0.5) / height
    }
  }

  const valid = (i: number) => Number.isFinite(elevation[i])
  const triangles: number[] = []
  for (let row = 0; row < height - 1; row++) {
    for (let col = 0; col < width - 1; col++) {
      const nw = row * width + col
      const ne = nw + 1
      const sw = nw + width
      const se = sw + 1
      if (valid(nw) && valid(sw) && valid(ne)) triangles.push(nw, sw, ne)
      if (valid(ne) && valid(sw) && valid(se)) triangles.push(ne, sw, se)
    }
  }

  return {
    positions,
    uvs,
    indices: Uint32Array.from(triangles),
    vertexCount: width * height,
    triangleCount: triangles.length / 3,
  }
}

/**
 * Texture repeat/offset that maps raster-footprint UVs onto an image with its
 * own north-up footprint. Identity when the footprints match, which the
 * manifests validate for the current basemap and enhanced RGB.
 */
export function imageUvTransform(
  raster: RasterGrid,
  image: RasterGrid,
): { repeat: [number, number]; offset: [number, number] } {
  const r = rasterBounds(raster)
  const m = rasterBounds(image)
  const imageWidth = m.maxX - m.minX
  const imageHeight = m.maxY - m.minY
  return {
    repeat: [(r.maxX - r.minX) / imageWidth, (r.maxY - r.minY) / imageHeight],
    offset: [(r.minX - m.minX) / imageWidth, (r.minY - m.minY) / imageHeight],
  }
}
