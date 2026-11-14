import { createTerrainGrid, type TerrainGrid } from '../pathfinding/terrainGrid'

/**
 * Test helper: builds a grid from ASCII rows.
 * '.' = 0 degrees, '0'-'9' = digit * 5 degrees, '#' = hazard (slope 0), '?' = no data.
 */
export function gridFromAscii(rows: string[], cellSizeMeters = 1): TerrainGrid {
  const slopeDegrees: (number | null)[] = []
  const hazard: boolean[] = []
  for (const row of rows) {
    if (row.length !== rows[0].length) {
      throw new Error('gridFromAscii rows must all have the same length')
    }
    for (const char of row) {
      if (char === '?') {
        slopeDegrees.push(null)
        hazard.push(false)
      } else if (char === '#') {
        slopeDegrees.push(0)
        hazard.push(true)
      } else if (char === '.') {
        slopeDegrees.push(0)
        hazard.push(false)
      } else if (char >= '0' && char <= '9') {
        slopeDegrees.push(Number(char) * 5)
        hazard.push(false)
      } else {
        throw new Error(`gridFromAscii: unknown cell character "${char}"`)
      }
    }
  }
  return createTerrainGrid({
    rows: rows.length,
    cols: rows[0].length,
    cellSizeMeters,
    slopeDegrees,
    hazard,
  })
}
