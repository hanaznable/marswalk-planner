import { describe, expect, it } from 'vitest'
import { parseTerrainManifest } from './terrainContract'
import { createTerrainPackage, elevationAt, isCellCovered } from './terrainPackage'

// Synthetic fixture: arbitrary numbers, not NASA data.
const manifest = parseTerrainManifest({
  contractVersion: 1,
  id: 'synthetic-test',
  title: 'Synthetic test grid',
  synthetic: true,
  source: null,
  crs: { name: 'Synthetic local metres', wkt: 'LOCAL_CS["synthetic"]' },
  raster: { width: 3, height: 2, geoTransform: [0, 10, 0, 20, 0, -10] },
  layers: {
    elevation: { url: 'e.f32', dataType: 'float32' },
    slope: { url: 's.f32', dataType: 'float32' },
  },
})

describe('createTerrainPackage', () => {
  it('rejects an elevation layer whose length does not match the raster', () => {
    expect(() =>
      createTerrainPackage(manifest, {
        elevation: new Float32Array(5),
        slope: new Float32Array(6),
      }),
    ).toThrow(RangeError)
  })

  it('rejects a slope layer whose length does not match the raster', () => {
    expect(() =>
      createTerrainPackage(manifest, {
        elevation: new Float32Array(6),
        slope: new Float32Array(2),
      }),
    ).toThrow(RangeError)
  })
})

describe('terrain package lookups', () => {
  const pkg = createTerrainPackage(manifest, {
    elevation: Float32Array.from([1, 2, Number.NaN, 4, 5, 6]),
    slope: new Float32Array(6),
  })

  it('reads elevation by cell and returns null for no data or outside', () => {
    expect(elevationAt(pkg, { row: 1, col: 0 })).toBe(4)
    expect(elevationAt(pkg, { row: 0, col: 2 })).toBeNull()
    expect(elevationAt(pkg, { row: 2, col: 0 })).toBeNull()
  })

  it('treats only cells with elevation data as covered', () => {
    expect(isCellCovered(pkg, { row: 0, col: 0 })).toBe(true)
    expect(isCellCovered(pkg, { row: 0, col: 2 })).toBe(false)
    expect(isCellCovered(pkg, { row: -1, col: 0 })).toBe(false)
  })
})
