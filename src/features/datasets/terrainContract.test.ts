import { describe, expect, it } from 'vitest'
import {
  cellCenterToMap,
  cellSizeMeters,
  decodeRaster,
  mapToCell,
  parseTerrainManifest,
  rasterBounds,
  TerrainContractError,
} from './terrainContract'

// Synthetic fixture: arbitrary numbers, not NASA data.
function validManifest(): Record<string, unknown> {
  return {
    contractVersion: 1,
    id: 'synthetic-dev-grid',
    title: 'Synthetic development grid',
    synthetic: true,
    source: null,
    crs: { name: 'Synthetic local metres', wkt: 'LOCAL_CS["synthetic"]' },
    raster: { width: 4, height: 3, geoTransform: [1000, 2, 0, 5000, 0, -2] },
    layers: {
      elevation: { url: 'elevation.f32', dataType: 'float32' },
      hazard: { url: 'hazard.u8', dataType: 'uint8' },
    },
  }
}

function issuesOf(input: unknown): string[] {
  try {
    parseTerrainManifest(input)
  } catch (error) {
    if (error instanceof TerrainContractError) return error.issues
    throw error
  }
  return []
}

describe('parseTerrainManifest', () => {
  it('accepts a valid synthetic manifest', () => {
    const manifest = parseTerrainManifest(validManifest())
    expect(manifest.synthetic).toBe(true)
    expect(manifest.raster.width).toBe(4)
    expect(cellSizeMeters(manifest.raster)).toBe(2)
  })

  it('accepts a real manifest with a source', () => {
    const input = {
      ...validManifest(),
      synthetic: false,
      source: { productId: 'P', url: 'https://example.org', attribution: 'A' },
    }
    expect(parseTerrainManifest(input).source?.productId).toBe('P')
  })

  it('requires a source for real data and forbids one for synthetic data', () => {
    expect(issuesOf({ ...validManifest(), synthetic: false })).toContain(
      'source is required when synthetic is false',
    )
    expect(
      issuesOf({
        ...validManifest(),
        source: { productId: 'P', url: 'u', attribution: 'a' },
      }),
    ).toContain('source must be null when synthetic is true')
  })

  it('rejects unsupported contract versions', () => {
    expect(issuesOf({ ...validManifest(), contractVersion: 2 })).toContain(
      'contractVersion must be 1',
    )
  })

  it.each([
    ['rotated', [1000, 2, 0.1, 5000, 0, -2], 'geoTransform must be north-up with no rotation'],
    ['south-up', [1000, 2, 0, 5000, 0, 2], 'geoTransform must be north-up with no rotation'],
    ['non-square', [1000, 2, 0, 5000, 0, -3], 'raster cells must be square'],
  ])('rejects a %s geoTransform', (_name, geoTransform, issue) => {
    const input = validManifest()
    input.raster = { width: 4, height: 3, geoTransform }
    expect(issuesOf(input)).toContain(issue)
  })

  it('rejects wrong layer data types', () => {
    const input = validManifest()
    input.layers = {
      elevation: { url: 'e', dataType: 'uint8' },
      hazard: { url: 'h', dataType: 'float32' },
    }
    expect(issuesOf(input)).toEqual(
      expect.arrayContaining([
        'layers.elevation.dataType must be float32',
        'layers.hazard.dataType must be uint8',
      ]),
    )
  })

  it('reports every problem at once', () => {
    expect(
      issuesOf({ contractVersion: 1, synthetic: true, source: null }).length,
    ).toBeGreaterThanOrEqual(4)
  })

  it('rejects input that is not an object', () => {
    expect(issuesOf(null)).toEqual(['manifest must be an object'])
  })
})

describe('raster coordinates', () => {
  const raster = parseTerrainManifest(validManifest()).raster

  it('computes the raster extent in map units', () => {
    expect(rasterBounds(raster)).toEqual({
      minX: 1000,
      maxX: 1008,
      minY: 4994,
      maxY: 5000,
    })
  })

  it('maps cell centres to map coordinates, row 0 at the north edge', () => {
    expect(cellCenterToMap(raster, { row: 0, col: 0 })).toEqual({ x: 1001, y: 4999 })
    expect(cellCenterToMap(raster, { row: 2, col: 3 })).toEqual({ x: 1007, y: 4995 })
  })

  it('maps points back to the containing cell', () => {
    expect(mapToCell(raster, { x: 1007.9, y: 4994.1 })).toEqual({ row: 2, col: 3 })
    expect(mapToCell(raster, cellCenterToMap(raster, { row: 1, col: 2 }))).toEqual({
      row: 1,
      col: 2,
    })
  })

  it('returns null outside the raster extent', () => {
    expect(mapToCell(raster, { x: 999.9, y: 4999 })).toBeNull()
    expect(mapToCell(raster, { x: 1008, y: 4999 })).toBeNull()
    expect(mapToCell(raster, { x: 1001, y: 5000.1 })).toBeNull()
  })
})

describe('decodeRaster', () => {
  const raster = parseTerrainManifest(validManifest()).raster

  it('decodes little-endian float32 and keeps NaN as no data', () => {
    const buffer = new ArrayBuffer(4 * 12)
    const view = new DataView(buffer)
    for (let i = 0; i < 12; i++) view.setFloat32(i * 4, i * 1.5, true)
    view.setFloat32(4 * 5, Number.NaN, true)
    const values = decodeRaster(buffer, raster, 'float32')
    expect(values).toBeInstanceOf(Float32Array)
    expect(values[1]).toBeCloseTo(1.5)
    expect(Number.isNaN(values[5])).toBe(true)
  })

  it('decodes uint8 masks', () => {
    const values = decodeRaster(new Uint8Array(12).fill(1).buffer, raster, 'uint8')
    expect(values).toBeInstanceOf(Uint8Array)
    expect(values[11]).toBe(1)
  })

  it('rejects a buffer whose size does not match the raster', () => {
    expect(() => decodeRaster(new ArrayBuffer(4 * 11), raster, 'float32')).toThrow(
      TerrainContractError,
    )
  })
})
