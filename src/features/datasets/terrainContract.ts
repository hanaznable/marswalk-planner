/**
 * Terrain data contract (version 1) between the preprocessing pipeline and the
 * frontend. Jointly owned by Developer B and Developer Y; coordinate breaking
 * changes. See docs/terrain-data-contract.md.
 *
 * Pure TypeScript: no React, Leaflet, or renderer imports, and no hardcoded
 * coordinates, raster sizes, or elevations.
 */

export const TERRAIN_CONTRACT_VERSION = 1

/** GDAL GetGeoTransform order: [originX, pixelWidth, rotationX, originY, rotationY, pixelHeight]. */
export type GeoTransform = readonly [number, number, number, number, number, number]

export interface RasterLayerRef {
  /** Path relative to the manifest. Row-major, row 0 = north edge, little-endian Float32. */
  readonly url: string
  readonly dataType: 'float32'
}

export interface TerrainSource {
  readonly productId: string
  readonly url: string
  readonly attribution: string
}

export interface RasterGrid {
  /** Columns. */
  readonly width: number
  /** Rows. */
  readonly height: number
  /** In the source Mars CRS, metres. North-up, square cells, no rotation. */
  readonly geoTransform: GeoTransform
}

export interface Basemap {
  /** JPEG orthoimage with the same footprint as the raster. */
  readonly url: string
  /** Image size in pixels. */
  readonly width: number
  readonly height: number
  /** Pixel-to-map transform in the source CRS, north-up. */
  readonly geoTransform: GeoTransform
}

export interface TerrainManifest {
  readonly contractVersion: typeof TERRAIN_CONTRACT_VERSION
  readonly id: string
  readonly title: string
  /** True for development fixtures. Synthetic data must never be shown as NASA data. */
  readonly synthetic: boolean
  /** Required for real data, null for synthetic data. */
  readonly source: TerrainSource | null
  /** The original Mars CRS, preserved from the source product. */
  readonly crs: { readonly name: string; readonly wkt: string }
  readonly raster: RasterGrid
  readonly layers: {
    /** Metres. NaN = no data. */
    readonly elevation: RasterLayerRef
    /** Degrees, computed by the pipeline. NaN = no data. */
    readonly slope: RasterLayerRef
  }
  readonly basemap?: Basemap
}

export interface RasterCell {
  readonly row: number
  readonly col: number
}

export interface MapPoint {
  readonly x: number
  readonly y: number
}

export class TerrainContractError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(`Invalid terrain data: ${issues.join('; ')}`)
    this.name = 'TerrainContractError'
    this.issues = issues
  }
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const isTransform = (value: unknown): value is GeoTransform =>
  Array.isArray(value) &&
  value.length === 6 &&
  value.every((item) => typeof item === 'number' && Number.isFinite(item))

const isNorthUp = ([, dx, rx, , ry, dy]: GeoTransform) =>
  rx === 0 && ry === 0 && dx > 0 && dy < 0

/** Validates untrusted manifest JSON. Throws TerrainContractError listing every problem. */
export function parseTerrainManifest(input: unknown): TerrainManifest {
  if (!isRecord(input)) throw new TerrainContractError(['manifest must be an object'])
  const issues: string[] = []

  if (input.contractVersion !== TERRAIN_CONTRACT_VERSION) {
    issues.push(`contractVersion must be ${TERRAIN_CONTRACT_VERSION}`)
  }
  if (!isNonEmptyString(input.id)) issues.push('id must be a non-empty string')
  if (!isNonEmptyString(input.title)) issues.push('title must be a non-empty string')

  if (typeof input.synthetic !== 'boolean') {
    issues.push('synthetic must be a boolean')
  } else if (input.synthetic && input.source !== null) {
    issues.push('source must be null when synthetic is true')
  } else if (!input.synthetic) {
    const source = input.source
    if (!isRecord(source)) {
      issues.push('source is required when synthetic is false')
    } else {
      for (const key of ['productId', 'url', 'attribution']) {
        if (!isNonEmptyString(source[key])) issues.push(`source.${key} must be a non-empty string`)
      }
    }
  }

  const crs = input.crs
  if (!isRecord(crs) || !isNonEmptyString(crs.name) || !isNonEmptyString(crs.wkt)) {
    issues.push('crs must have a non-empty name and wkt')
  }

  const rasterValid = validateRaster(input.raster, issues)
  validateLayers(input.layers, issues)
  if (input.basemap !== undefined) {
    validateBasemap(input.basemap, rasterValid ? (input.raster as RasterGrid) : null, issues)
  }

  if (issues.length > 0) throw new TerrainContractError(issues)
  return input as unknown as TerrainManifest
}

function validateRaster(raster: unknown, issues: string[]): boolean {
  if (!isRecord(raster)) {
    issues.push('raster must be an object')
    return false
  }
  const before = issues.length
  if (!isPositiveInteger(raster.width) || !isPositiveInteger(raster.height)) {
    issues.push('raster width and height must be positive integers')
  }
  const t = raster.geoTransform
  if (!isTransform(t)) {
    issues.push('raster.geoTransform must be 6 finite numbers')
  } else if (!isNorthUp(t)) {
    issues.push('geoTransform must be north-up with no rotation')
  } else if (Math.abs(t[1] + t[5]) > 1e-9 * t[1]) {
    issues.push('raster cells must be square')
  }
  return issues.length === before
}

function validateLayers(layers: unknown, issues: string[]): void {
  if (!isRecord(layers)) {
    issues.push('layers must be an object')
    return
  }
  for (const name of ['elevation', 'slope']) {
    const layer = layers[name]
    if (layer === undefined) {
      issues.push(`layers.${name} is required`)
    } else if (!isRecord(layer) || !isNonEmptyString(layer.url)) {
      issues.push(`layers.${name}.url must be a non-empty string`)
    } else if (layer.dataType !== 'float32') {
      issues.push(`layers.${name}.dataType must be float32`)
    }
  }
  if (layers.hazard !== undefined) issues.push('layers.hazard is not part of contract v1')
}

function validateBasemap(
  basemap: unknown,
  raster: RasterGrid | null,
  issues: string[],
): void {
  if (!isRecord(basemap)) {
    issues.push('basemap must be an object')
    return
  }
  if (!isNonEmptyString(basemap.url)) issues.push('basemap.url must be a non-empty string')
  const sized = isPositiveInteger(basemap.width) && isPositiveInteger(basemap.height)
  if (!sized) issues.push('basemap width and height must be positive integers')
  const t = basemap.geoTransform
  if (!isTransform(t)) {
    issues.push('basemap.geoTransform must be 6 finite numbers')
    return
  }
  if (!isNorthUp(t)) {
    issues.push('basemap.geoTransform must be north-up with no rotation')
    return
  }
  if (!sized || raster === null) return
  // The footprint must match the raster extent to within half a basemap pixel.
  const image = rasterBounds({ width: basemap.width as number, height: basemap.height as number, geoTransform: t })
  const terrain = rasterBounds(raster)
  const tolX = Math.abs(t[1]) / 2
  const tolY = Math.abs(t[5]) / 2
  if (
    Math.abs(image.minX - terrain.minX) > tolX ||
    Math.abs(image.maxX - terrain.maxX) > tolX ||
    Math.abs(image.minY - terrain.minY) > tolY ||
    Math.abs(image.maxY - terrain.maxY) > tolY
  ) {
    issues.push('basemap footprint must match the raster extent')
  }
}

/** Cell edge length in metres (cells are square). */
export function cellSizeMeters(raster: RasterGrid): number {
  return raster.geoTransform[1]
}

/** Extent in source CRS units. */
export function rasterBounds(raster: RasterGrid): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  const [x0, dx, , y0, , dy] = raster.geoTransform
  return {
    minX: x0,
    maxX: x0 + raster.width * dx,
    minY: y0 + raster.height * dy,
    maxY: y0,
  }
}

export function cellCenterToMap(raster: RasterGrid, cell: RasterCell): MapPoint {
  const [x0, dx, , y0, , dy] = raster.geoTransform
  return { x: x0 + (cell.col + 0.5) * dx, y: y0 + (cell.row + 0.5) * dy }
}

/** The cell containing a source-CRS point, or null outside the raster extent. */
export function mapToCell(raster: RasterGrid, point: MapPoint): RasterCell | null {
  const [x0, dx, , y0, , dy] = raster.geoTransform
  const col = Math.floor((point.x - x0) / dx)
  const row = Math.floor((point.y - y0) / dy)
  if (row < 0 || row >= raster.height || col < 0 || col >= raster.width) return null
  return { row, col }
}

/**
 * Local metric frame used by the frontend: metres east and north of the
 * raster's south-west corner. Keeps map numbers small; the source CRS stays
 * in the manifest.
 */
export function toLocalMetres(raster: RasterGrid, point: MapPoint): MapPoint {
  const { minX, minY } = rasterBounds(raster)
  return { x: point.x - minX, y: point.y - minY }
}

export function fromLocalMetres(raster: RasterGrid, point: MapPoint): MapPoint {
  const { minX, minY } = rasterBounds(raster)
  return { x: point.x + minX, y: point.y + minY }
}

/** Decodes a row-major little-endian Float32 layer. Throws if the size does not match the grid. */
export function decodeRaster(buffer: ArrayBuffer, raster: RasterGrid): Float32Array {
  const count = raster.width * raster.height
  if (buffer.byteLength !== count * 4) {
    throw new TerrainContractError([
      `float32 raster must be ${count * 4} bytes, got ${buffer.byteLength}`,
    ])
  }
  const view = new DataView(buffer)
  const values = new Float32Array(count)
  for (let i = 0; i < count; i++) values[i] = view.getFloat32(i * 4, true)
  return values
}
