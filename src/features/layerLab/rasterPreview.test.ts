import { describe, expect, it } from 'vitest'
import { createTerrainPackage } from '../datasets/terrainPackage'
import { previewRgba, previewValues } from './rasterPreview'

function fixture(value: (row: number, col: number) => number) {
  return createTerrainPackage({
    contractVersion: 1, id: 'synthetic-test', title: 'Synthetic numerical fixture', synthetic: true,
    source: null, crs: { name: 'Test grid', wkt: 'Test only' },
    raster: { width: 5, height: 5, geoTransform: [0, 5, 0, 25, 0, -5] },
    layers: { elevation: { url: 'unused', dataType: 'float32' }, slope: { url: 'unused', dataType: 'float32' } },
  }, { elevation: Float32Array.from({ length: 25 }, (_, index) => value(Math.floor(index / 5), index % 5)), slope: new Float32Array(25).fill(12) })
}

describe('display-only terrain derivatives', () => {
  it('removes a tilted plane from roughness instead of treating slope as roughness', () => {
    const terrain = fixture((row, col) => 100 + row * 3 + col * 5)
    const before = terrain.elevation.slice()
    const roughness = previewValues(terrain, 'roughness').values
    expect(roughness[12]).toBeCloseTo(0, 8)
    expect(Number.isNaN(roughness[0])).toBe(true)
    expect(terrain.elevation).toEqual(before)
    expect(Array.from(terrain.slope).every((v) => v === 12)).toBe(true)
  })

  it('measures the expected residual of an isolated central bump', () => {
    const terrain = fixture((row, col) => row === 2 && col === 2 ? 1 : 0)
    expect(previewValues(terrain, 'roughness').values[12]).toBeCloseTo(Math.sqrt(8) / 9, 7)
  })

  it('uses the declared illumination and respects north-up row direction', () => {
    const flat = previewValues(fixture(() => 100), 'hillshade').values[12]
    expect(flat).toBeCloseTo(Math.sin(Math.PI / 4), 6)
    // A surface rising south/east faces the north-west light more strongly.
    const facing = previewValues(fixture((row, col) => 100 + row * 2 + col * 2), 'hillshade').values[12]
    const away = previewValues(fixture((row, col) => 100 - row * 2 - col * 2), 'hillshade').values[12]
    expect(facing).toBeGreaterThan(flat)
    expect(away).toBeLessThan(flat)
  })

  it('does not fill missing neighbours or missing layer coverage', () => {
    const terrain = fixture((row, col) => row === 2 && col === 2 ? NaN : 100)
    for (const kind of ['hillshade', 'roughness'] as const) expect(Number.isNaN(previewValues(terrain, kind).values[12])).toBe(true)
    expect(previewValues(terrain, 'coverage').values[12]).toBe(0)
    expect(previewValues(terrain, 'coverage').values[0]).toBe(1)
    terrain.slope[0] = NaN
    expect(previewValues(terrain, 'coverage').values[0]).toBe(0)
    expect(previewRgba(NaN, 0, 1, 'roughness')[3]).toBe(0)
  })
})
