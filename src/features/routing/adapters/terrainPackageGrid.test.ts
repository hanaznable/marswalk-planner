import { describe, expect, it } from 'vitest'
import { parseTerrainManifest } from '../../datasets/terrainContract'
import { createTerrainPackage } from '../../datasets/terrainPackage'
import { classifyCell } from '../pathfinding/terrainGrid'
import { terrainPackageToGrid } from './terrainPackageGrid'

// Synthetic fixture: arbitrary numbers, not NASA data.
const pkg = createTerrainPackage(
  parseTerrainManifest({
    contractVersion: 1,
    id: 'synthetic-test',
    title: 'Synthetic test grid',
    synthetic: true,
    source: null,
    crs: { name: 'Synthetic local metres', wkt: 'LOCAL_CS["synthetic"]' },
    raster: { width: 3, height: 2, geoTransform: [0, 5, 0, 10, 0, -5] },
    layers: {
      elevation: { url: 'e.f32', dataType: 'float32' },
      slope: { url: 's.f32', dataType: 'float32' },
    },
  }),
  {
    elevation: Float32Array.from([1, 2, Number.NaN, 4, 5, 6]),
    slope: Float32Array.from([3, Number.NaN, 7, -2, 12, 40]),
  },
)

describe('terrainPackageToGrid', () => {
  const grid = terrainPackageToGrid(pkg)

  it('copies dimensions and cell size from the manifest', () => {
    expect(grid.rows).toBe(2)
    expect(grid.cols).toBe(3)
    expect(grid.cellSizeMeters).toBe(5)
  })

  it('uses pipeline slope where both slope and elevation are valid', () => {
    expect(grid.slopeDegrees[0]).toBeCloseTo(3)
    expect(grid.slopeDegrees[5]).toBeCloseTo(40)
  })

  it('treats missing slope, missing elevation or invalid slope as no data', () => {
    expect(grid.slopeDegrees[1]).toBeNull() // slope NaN
    expect(grid.slopeDegrees[2]).toBeNull() // elevation NaN
    expect(grid.slopeDegrees[3]).toBeNull() // negative slope is invalid
    expect(classifyCell(grid, { row: 1, col: 0 }, null)).toEqual({
      passable: false,
      cause: 'noData',
    })
  })

  it('has no hazards, since v1 has no hazard layer', () => {
    expect(grid.hazard.every((value) => value === false)).toBe(true)
  })
})
