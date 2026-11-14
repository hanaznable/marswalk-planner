import type { BlockCause, GridCell } from '../model/types'

/**
 * Raw grid input. Arrays are row-major with length rows * cols.
 * The grid must come from a projected Mars CRS with square metric cells;
 * producing it is the preprocessing step's responsibility.
 */
export interface TerrainGridInput {
  rows: number
  cols: number
  cellSizeMeters: number
  /** Slope in degrees per cell; null means no data. */
  slopeDegrees: readonly (number | null)[]
  /** True marks a known hazard. Defaults to no hazards. */
  hazard?: readonly boolean[]
}

export interface TerrainGrid {
  readonly rows: number
  readonly cols: number
  readonly cellSizeMeters: number
  readonly slopeDegrees: readonly (number | null)[]
  readonly hazard: readonly boolean[]
}

export type CellClass =
  | { passable: true }
  | { passable: false; cause: BlockCause }

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export function createTerrainGrid(input: TerrainGridInput): TerrainGrid {
  const { rows, cols, cellSizeMeters, slopeDegrees } = input
  if (!isPositiveInteger(rows) || !isPositiveInteger(cols)) {
    throw new RangeError('rows and cols must be positive integers')
  }
  if (!Number.isFinite(cellSizeMeters) || cellSizeMeters <= 0) {
    throw new RangeError('cellSizeMeters must be a finite number above zero')
  }
  const size = rows * cols
  if (slopeDegrees.length !== size) {
    throw new RangeError(`slopeDegrees must have ${size} values`)
  }
  if (input.hazard && input.hazard.length !== size) {
    throw new RangeError(`hazard must have ${size} values`)
  }
  for (const slope of slopeDegrees) {
    if (slope !== null && (!Number.isFinite(slope) || slope < 0)) {
      throw new RangeError('slopes must be finite and non-negative, or null')
    }
  }
  return {
    rows,
    cols,
    cellSizeMeters,
    slopeDegrees: [...slopeDegrees],
    hazard: input.hazard ? [...input.hazard] : new Array<boolean>(size).fill(false),
  }
}

export function isInBounds(grid: TerrainGrid, cell: GridCell): boolean {
  return (
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.col) &&
    cell.row >= 0 &&
    cell.row < grid.rows &&
    cell.col >= 0 &&
    cell.col < grid.cols
  )
}

/** Priority: outOfCoverage, noData, hazard, slope. A slope equal to the limit passes. */
export function classifyCell(
  grid: TerrainGrid,
  cell: GridCell,
  maxSlopeDegrees: number | null,
): CellClass {
  if (!isInBounds(grid, cell)) return { passable: false, cause: 'outOfCoverage' }
  const index = cell.row * grid.cols + cell.col
  const slope = grid.slopeDegrees[index]
  if (slope === null) return { passable: false, cause: 'noData' }
  if (grid.hazard[index]) return { passable: false, cause: 'hazard' }
  if (maxSlopeDegrees !== null && slope > maxSlopeDegrees) {
    return { passable: false, cause: 'slope' }
  }
  return { passable: true }
}
