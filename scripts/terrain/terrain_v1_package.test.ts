/** Real exported package integration checks; no changes to frontend contracts. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  cellCenterToMap,
  decodeRaster,
  mapToCell,
  parseTerrainManifest,
  rasterBounds,
} from '../../src/features/datasets/terrainContract'
import { createTerrainPackage } from '../../src/features/datasets/terrainPackage'
import { terrainPackageToGrid } from '../../src/features/routing/adapters/terrainPackageGrid'
import { planAlternatives } from '../../src/features/routing/planRoute'

const directory = new URL('../../public/data/gale/pahrump-hills-v1/', import.meta.url)
const read = (filename: string) => readFileSync(new URL(filename, directory))
const manifest = parseTerrainManifest(JSON.parse(read('manifest.json').toString()))
const layer = (filename: string) => {
  const bytes = read(filename)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return decodeRaster(buffer, manifest.raster)
}
const elevation = layer(manifest.layers.elevation.url)
const slope = layer(manifest.layers.slope.url)
const pkg = createTerrainPackage(manifest, { elevation, slope })

describe('real Pahrump Hills contract-v1 delivery', () => {
  it('passes the existing unmodified manifest parser and binary decoder', () => {
    expect(manifest.synthetic).toBe(false)
    expect(manifest.source?.productId).toBe('DTEEC_040770_1755_039280_1755_A01')
    expect(manifest.raster.width).toBe(200)
    expect(manifest.raster.height).toBe(200)
    expect(elevation.length).toBe(40000)
    expect(slope.length).toBe(40000)
    expect(Array.from(elevation).every(Number.isFinite)).toBe(true)
    expect(Array.from(slope).every((value) => Number.isFinite(value) && value >= 0 && value <= 90)).toBe(true)
  })

  it('places image and routing grid on the same exact footprint', () => {
    const image = manifest.basemap!
    const a = rasterBounds(manifest.raster)
    const b = rasterBounds({ width: image.width, height: image.height, geoTransform: image.geoTransform })
    for (const key of ['minX', 'minY', 'maxX', 'maxY'] as const) expect(a[key]).toBeCloseTo(b[key], 8)
    expect(a.maxX - a.minX).toBeCloseTo(1000, 8)
    expect(a.maxY - a.minY).toBeCloseTo(1000, 8)
    for (const cell of [{ row: 0, col: 0 }, { row: 99, col: 99 }, { row: 199, col: 199 }]) {
      expect(mapToCell(manifest.raster, cellCenterToMap(manifest.raster, cell))).toEqual(cell)
    }
  })

  it('matches the recorded output hashes', () => {
    const provenance = JSON.parse(read('provenance.json').toString())
    for (const [filename, expected] of Object.entries(provenance.output_sha256)) {
      expect(createHash('sha256').update(read(filename)).digest('hex')).toBe(expected)
    }
    expect(provenance.accuracy).toContain('unverified')
  })

  it('works with the existing routing adapter and round-trip planner', () => {
    const grid = terrainPackageToGrid(pkg)
    // Choose a real adjacent pair satisfying a test scenario, not a scientific target.
    let start = -1
    for (let i = 0; i < slope.length - 1; i++) {
      if (i % grid.cols < grid.cols - 1 && slope[i] < 20 && slope[i + 1] < 20) {
        start = i
        break
      }
    }
    expect(start).toBeGreaterThanOrEqual(0)
    const cell = (i: number) => ({ row: Math.floor(i / grid.cols), col: i % grid.cols })
    const result = planAlternatives(grid, {
      waypoints: [{ id: 'start', label: 'Test start', cell: cell(start) },
                  { id: 'end', label: 'Test end', cell: cell(start + 1) }],
      returnToStart: true,
    }, { maxSlopeDegrees: 20, slopePenalty: 3 })
    for (const route of [result.distance, result.terrain]) {
      expect(route.complete).toBe(true)
      expect(route.legs).toHaveLength(2)
      expect(route.totalDistanceMeters).toBeCloseTo(10)
    }
  })
})
