import { describe, expect, it } from 'vitest'
import { gridFromAscii } from '../testing/gridFromAscii'
import { classifyCell, createTerrainGrid, type TerrainGrid } from './terrainGrid'

describe('createTerrainGrid', () => {
  it('rejects mismatched slope length', () => {
    expect(() =>
      createTerrainGrid({
        rows: 2,
        cols: 2,
        cellSizeMeters: 1,
        slopeDegrees: [0, 0, 0],
      }),
    ).toThrow(RangeError)
  })

  it.each([0, -1, Number.NaN, Infinity])(
    'rejects cellSizeMeters %s',
    (size) => {
      expect(() =>
        createTerrainGrid({
          rows: 1,
          cols: 1,
          cellSizeMeters: size,
          slopeDegrees: [0],
        }),
      ).toThrow(RangeError)
    },
  )

  it('rejects mismatched hazard length and negative slope', () => {
    expect(() =>
      createTerrainGrid({
        rows: 1,
        cols: 2,
        cellSizeMeters: 1,
        slopeDegrees: [0, 0],
        hazard: [false],
      }),
    ).toThrow(RangeError)
    expect(() =>
      createTerrainGrid({
        rows: 1,
        cols: 1,
        cellSizeMeters: 1,
        slopeDegrees: [-3],
      }),
    ).toThrow(RangeError)
  })

  it('rejects non-integer or non-positive dimensions', () => {
    expect(() =>
      createTerrainGrid({ rows: 0, cols: 1, cellSizeMeters: 1, slopeDegrees: [] }),
    ).toThrow(RangeError)
    expect(() =>
      createTerrainGrid({
        rows: 1.5,
        cols: 1,
        cellSizeMeters: 1,
        slopeDegrees: [0],
      }),
    ).toThrow(RangeError)
  })
})

describe('classifyCell', () => {
  it('reports causes in priority order', () => {
    const g = gridFromAscii(['.#?4'])
    expect(classifyCell(g, { row: 0, col: 0 }, null)).toEqual({ passable: true })
    expect(classifyCell(g, { row: 0, col: 1 }, null)).toEqual({
      passable: false,
      cause: 'hazard',
    })
    expect(classifyCell(g, { row: 0, col: 2 }, null)).toEqual({
      passable: false,
      cause: 'noData',
    })
    expect(classifyCell(g, { row: 0, col: 9 }, null)).toEqual({
      passable: false,
      cause: 'outOfCoverage',
    })
    expect(classifyCell(g, { row: -1, col: 0 }, null)).toEqual({
      passable: false,
      cause: 'outOfCoverage',
    })
  })

  it('never treats malformed data in a hand-built grid as safe', () => {
    // Grids may arrive from preprocessing without going through createTerrainGrid.
    const g = {
      rows: 1,
      cols: 4,
      cellSizeMeters: 1,
      slopeDegrees: [0, undefined, Number.NaN, 0],
      hazard: [false, false, false],
    } as unknown as TerrainGrid
    expect(classifyCell(g, { row: 0, col: 1 }, 10)).toEqual({
      passable: false,
      cause: 'noData',
    })
    expect(classifyCell(g, { row: 0, col: 2 }, null)).toEqual({
      passable: false,
      cause: 'noData',
    })
    // a missing hazard entry is unknown, not "no hazard"
    expect(classifyCell(g, { row: 0, col: 3 }, null)).toEqual({
      passable: false,
      cause: 'noData',
    })
  })

  it('applies the slope limit only when given, inclusive at the limit', () => {
    const g = gridFromAscii(['4']) // 20 degrees
    expect(classifyCell(g, { row: 0, col: 0 }, null).passable).toBe(true)
    expect(classifyCell(g, { row: 0, col: 0 }, 20).passable).toBe(true)
    expect(classifyCell(g, { row: 0, col: 0 }, 19)).toEqual({
      passable: false,
      cause: 'slope',
    })
  })
})
