import type { RasterCell, TerrainManifest } from './terrainContract'

/** A validated manifest with its decoded raster layers (row-major, row 0 = north). */
export interface TerrainPackage {
  readonly manifest: TerrainManifest
  /** Metres. NaN = no data. */
  readonly elevation: Float32Array
  /** Degrees, computed by the pipeline. NaN = no data. */
  readonly slope: Float32Array
}

export function createTerrainPackage(
  manifest: TerrainManifest,
  layers: { elevation: Float32Array; slope: Float32Array },
): TerrainPackage {
  const size = manifest.raster.width * manifest.raster.height
  for (const [name, layer] of Object.entries(layers)) {
    if (layer.length !== size) {
      throw new RangeError(`${name} layer must have ${size} values, got ${layer.length}`)
    }
  }
  return { manifest, ...layers }
}

function indexOf(pkg: TerrainPackage, cell: RasterCell): number | null {
  const { width, height } = pkg.manifest.raster
  if (
    !Number.isInteger(cell.row) ||
    !Number.isInteger(cell.col) ||
    cell.row < 0 ||
    cell.row >= height ||
    cell.col < 0 ||
    cell.col >= width
  ) {
    return null
  }
  return cell.row * width + cell.col
}

/** Elevation in metres, or null outside the raster or where there is no data. */
export function elevationAt(pkg: TerrainPackage, cell: RasterCell): number | null {
  const index = indexOf(pkg, cell)
  if (index === null) return null
  const value = pkg.elevation[index]
  return Number.isFinite(value) ? value : null
}

/** A cell is covered only when it has elevation data. */
export function isCellCovered(pkg: TerrainPackage, cell: RasterCell): boolean {
  return elevationAt(pkg, cell) !== null
}
