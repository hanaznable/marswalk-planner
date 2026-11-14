import {
  parseTerrainManifest,
  type TerrainManifest,
} from '../../datasets/terrainContract'
import {
  createTerrainPackage,
  type TerrainPackage,
} from '../../datasets/terrainPackage'

/**
 * SYNTHETIC DEVELOPMENT FIXTURE — NOT NASA DATA.
 * A made-up 1 x 1 km grid of smooth hills in local metres, used to build and
 * test the frontend until Developer B delivers processed terrain packages.
 */
const WIDTH = 200
const HEIGHT = 200
const CELL_SIZE_METERS = 5

// A circular patch with no elevation data, to exercise no-coverage handling.
const GAP = { row: 150, col: 40, radius: 22 }

export function createSyntheticTerrain(): TerrainPackage {
  const manifest: TerrainManifest = parseTerrainManifest({
    contractVersion: 1,
    id: 'synthetic-dev-terrain',
    title: 'Synthetic development terrain (not NASA data)',
    synthetic: true,
    source: null,
    crs: {
      name: 'Synthetic local metres',
      wkt: 'LOCAL_CS["Synthetic development grid",UNIT["metre",1]]',
    },
    raster: {
      width: WIDTH,
      height: HEIGHT,
      geoTransform: [0, CELL_SIZE_METERS, 0, WIDTH * CELL_SIZE_METERS, 0, -CELL_SIZE_METERS],
    },
    layers: {
      elevation: { url: 'synthetic://elevation', dataType: 'float32' },
      slope: { url: 'synthetic://slope', dataType: 'float32' },
    },
  })

  const elevation = new Float32Array(WIDTH * HEIGHT)
  for (let row = 0; row < HEIGHT; row++) {
    for (let col = 0; col < WIDTH; col++) {
      const x = col * CELL_SIZE_METERS
      const y = row * CELL_SIZE_METERS
      const inGap = (row - GAP.row) ** 2 + (col - GAP.col) ** 2 < GAP.radius ** 2
      elevation[row * WIDTH + col] = inGap
        ? Number.NaN
        : 30 * Math.sin(x / 160) + 22 * Math.cos(y / 120) + 0.03 * x + 12 * Math.sin((x + y) / 70)
    }
  }

  return createTerrainPackage(manifest, { elevation, slope: slopeDegrees(elevation) })
}

/**
 * Fixture-only slope (degrees) from central differences. Real packages get
 * slope from the pipeline; the frontend does not derive it.
 */
function slopeDegrees(elevation: Float32Array): Float32Array {
  const slope = new Float32Array(elevation.length)
  const at = (row: number, col: number, fallback: number) => {
    if (row < 0 || row >= HEIGHT || col < 0 || col >= WIDTH) return fallback
    const value = elevation[row * WIDTH + col]
    return Number.isFinite(value) ? value : fallback
  }
  for (let row = 0; row < HEIGHT; row++) {
    for (let col = 0; col < WIDTH; col++) {
      const centre = elevation[row * WIDTH + col]
      if (!Number.isFinite(centre)) {
        slope[row * WIDTH + col] = Number.NaN
        continue
      }
      const dzdx = (at(row, col + 1, centre) - at(row, col - 1, centre)) / (2 * CELL_SIZE_METERS)
      const dzdy = (at(row - 1, col, centre) - at(row + 1, col, centre)) / (2 * CELL_SIZE_METERS)
      slope[row * WIDTH + col] = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI
    }
  }
  return slope
}
