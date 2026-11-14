/**
 * Terrain data contract (version 1) between the preprocessing pipeline and the
 * frontend. PROPOSAL: under review with Developer B; see docs/terrain-data-contract.md.
 *
 * Pure TypeScript: no React, Leaflet, or renderer imports, and no hardcoded
 * coordinates, raster sizes, or elevations.
 */

export const TERRAIN_CONTRACT_VERSION = 1

/** GDAL GetGeoTransform order: [originX, pixelWidth, rotationX, originY, rotationY, pixelHeight]. */
export type GeoTransform = readonly [number, number, number, number, number, number]

export type RasterDataType = 'float32' | 'uint8'

export interface RasterLayerRef {
  /** Path relative to the manifest. Row-major, row 0 = north edge, little-endian. */
  readonly url: string
  readonly dataType: RasterDataType
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
  /** Projected CRS units are metres. North-up, square cells, no rotation. */
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
  readonly crs: { readonly name: string; readonly wkt: string }
  readonly raster: RasterGrid
  readonly layers: {
    /** Metres. NaN = no data. */
    readonly elevation: RasterLayerRef
    /** Degrees. NaN = no data. Optional: the frontend may derive slope from elevation. */
    readonly slope?: RasterLayerRef
    /** 1 = known hazard, 0 = none. */
    readonly hazard?: RasterLayerRef
  }
  /** Orthoimage covering exactly the raster extent. */
  readonly basemap?: { readonly url: string }
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

  validateRaster(input.raster, issues)
  validateLayers(input.layers, issues)

  if (input.basemap !== undefined) {
    if (!isRecord(input.basemap) || !isNonEmptyString(input.basemap.url)) {
      issues.push('basemap.url must be a non-empty string')
    }
  }

  if (issues.length > 0) throw new TerrainContractError(issues)
  return input as unknown as TerrainManifest
}

function validateRaster(raster: unknown, issues: string[]): void {
  if (!isRecord(raster)) {
    issues.push('raster must be an object')
    return
  }
  if (!isPositiveInteger(raster.width) || !isPositiveInteger(raster.height)) {
    issues.push('raster width and height must be positive integers')
  }
  const t = raster.geoTransform
  if (
    !Array.isArray(t) ||
    t.length !== 6 ||
    !t.every((value) => typeof value === 'number' && Number.isFinite(value))
  ) {
    issues.push('raster.geoTransform must be 6 finite numbers')
    return
  }
  const [, dx, rx, , ry, dy] = t as number[]
  if (rx !== 0 || ry !== 0 || dx <= 0 || dy >= 0) {
    issues.push('geoTransform must be north-up with no rotation')
  } else if (Math.abs(dx + dy) > 1e-9 * dx) {
    issues.push('raster cells must be square')
  }
}

const LAYER_TYPES: Record<string, RasterDataType> = {
  elevation: 'float32',
  slope: 'float32',
  hazard: 'uint8',
}

function validateLayers(layers: unknown, issues: string[]): void {
  if (!isRecord(layers)) {
    issues.push('layers must be an object')
    return
  }
  if (layers.elevation === undefined) issues.push('layers.elevation is required')
  for (const [name, dataType] of Object.entries(LAYER_TYPES)) {
    const layer = layers[name]
    if (layer === undefined) continue
    if (!isRecord(layer) || !isNonEmptyString(layer.url)) {
      issues.push(`layers.${name}.url must be a non-empty string`)
    } else if (layer.dataType !== dataType) {
      issues.push(`layers.${name}.dataType must be ${dataType}`)
    }
  }
}

/** Cell edge length in metres (cells are square). */
export function cellSizeMeters(raster: RasterGrid): number {
  return raster.geoTransform[1]
}

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

/** The cell containing a map point, or null outside the raster extent. */
export function mapToCell(raster: RasterGrid, point: MapPoint): RasterCell | null {
  const [x0, dx, , y0, , dy] = raster.geoTransform
  const col = Math.floor((point.x - x0) / dx)
  const row = Math.floor((point.y - y0) / dy)
  if (row < 0 || row >= raster.height || col < 0 || col >= raster.width) return null
  return { row, col }
}

/** Decodes a row-major little-endian raster. Throws if the size does not match the grid. */
export function decodeRaster(
  buffer: ArrayBuffer,
  raster: RasterGrid,
  dataType: RasterDataType,
): Float32Array | Uint8Array {
  const count = raster.width * raster.height
  const bytesPerValue = dataType === 'float32' ? 4 : 1
  if (buffer.byteLength !== count * bytesPerValue) {
    throw new TerrainContractError([
      `${dataType} raster must be ${count * bytesPerValue} bytes, got ${buffer.byteLength}`,
    ])
  }
  if (dataType === 'uint8') return new Uint8Array(buffer.slice(0))
  const view = new DataView(buffer)
  const values = new Float32Array(count)
  for (let i = 0; i < count; i++) values[i] = view.getFloat32(i * 4, true)
  return values
}
