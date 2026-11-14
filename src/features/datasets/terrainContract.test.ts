import { describe, expect, it } from 'vitest'
import {
  cellCenterToMap,
  cellSizeMeters,
  decodeRaster,
  fromLocalMetres,
  mapToCell,
  parseTerrainManifest,
  rasterBounds,
  TerrainContractError,
  toLocalMetres,
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
      slope: { url: 'slope.f32', dataType: 'float32' },
    },
  }
}

// Same 8 m x 6 m footprint as the raster, at 0.5 m per basemap pixel.
function alignedBasemap(): Record<string, unknown> {
  return {
    url: 'basemap.jpg',
    width: 16,
    height: 12,
    geoTransform: [1000, 0.5, 0, 5000, 0, -0.5],
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

  it('requires elevation and slope layers', () => {
    const input = validManifest()
    input.layers = {}
    expect(issuesOf(input)).toEqual(
      expect.arrayContaining([
        'layers.elevation is required',
        'layers.slope is required',
      ]),
    )
  })

  it('rejects wrong layer data types', () => {
    const input = validManifest()
    input.layers = {
      elevation: { url: 'e', dataType: 'uint8' },
      slope: { url: 's', dataType: 'int16' },
    }
    expect(issuesOf(input)).toEqual(
      expect.arrayContaining([
        'layers.elevation.dataType must be float32',
        'layers.slope.dataType must be float32',
      ]),
    )
  })

  it('rejects a hazard layer, which is not part of v1', () => {
    const input = validManifest()
    input.layers = {
      ...(input.layers as object),
      hazard: { url: 'h', dataType: 'uint8' },
    }
    expect(issuesOf(input)).toContain('layers.hazard is not part of contract v1')
  })

  it('accepts a basemap with the same footprint as the raster', () => {
    const manifest = parseTerrainManifest({ ...validManifest(), basemap: alignedBasemap() })
    expect(manifest.basemap?.width).toBe(16)
  })

  it('rejects a basemap whose footprint differs from the raster', () => {
    const basemap = { ...alignedBasemap(), geoTransform: [1001, 0.5, 0, 5000, 0, -0.5] }
    expect(issuesOf({ ...validManifest(), basemap })).toContain(
      'basemap footprint must match the raster extent',
    )
  })

  it('rejects a basemap without size or transform', () => {
    expect(
      issuesOf({ ...validManifest(), basemap: { url: 'basemap.jpg' } }),
    ).toEqual(
      expect.arrayContaining([
        'basemap width and height must be positive integers',
        'basemap.geoTransform must be 6 finite numbers',
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

  it('computes the raster extent in source CRS units', () => {
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

  it('converts to local metres measured from the south-west corner and back', () => {
    expect(toLocalMetres(raster, { x: 1001, y: 4999 })).toEqual({ x: 1, y: 5 })
    expect(fromLocalMetres(raster, { x: 1, y: 5 })).toEqual({ x: 1001, y: 4999 })
  })
})

describe('decodeRaster', () => {
  const raster = parseTerrainManifest(validManifest()).raster

  it('decodes little-endian float32 and keeps NaN as no data', () => {
    const buffer = new ArrayBuffer(4 * 12)
    const view = new DataView(buffer)
    for (let i = 0; i < 12; i++) view.setFloat32(i * 4, i * 1.5, true)
    view.setFloat32(4 * 5, Number.NaN, true)
    const values = decodeRaster(buffer, raster)
    expect(values[1]).toBeCloseTo(1.5)
    expect(Number.isNaN(values[5])).toBe(true)
  })

  it('rejects a buffer whose size does not match the raster', () => {
    expect(() => decodeRaster(new ArrayBuffer(4 * 11), raster)).toThrow(
      TerrainContractError,
    )
  })
})
