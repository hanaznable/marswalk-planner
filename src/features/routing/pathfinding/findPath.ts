import type { BlockCause, GridCell } from '../model/types'
import { MinHeap } from './minHeap'
import { classifyCell, type TerrainGrid } from './terrainGrid'

export interface PathConstraints {
  /** Null means no slope limit (distance-focused profile). */
  readonly maxSlopeDegrees: number | null
  /**
   * Planning heuristic, not an energy model: each step costs
   * length * (1 + slopePenalty * grade), where grade is the tangent of the two
   * cells' mean slope. 0 (the default) minimises distance only.
   */
  readonly slopePenalty?: number
}

export type PathFailure =
  | {
      readonly code: 'ENDPOINT_BLOCKED'
      readonly endpoint: 'from' | 'to'
      readonly cause: BlockCause
    }
  | { readonly code: 'NO_PATH'; readonly blockedBy: readonly BlockCause[] }

export type PathResult =
  | {
      readonly status: 'ok'
      readonly path: readonly GridCell[]
      readonly distanceMeters: number
    }
  | { readonly status: 'failed'; readonly reason: PathFailure }

const BLOCKER_ORDER: readonly BlockCause[] = ['noData', 'hazard', 'slope']

const NEIGHBOUR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

/**
 * A* over the terrain grid: 8-neighbour moves, no corner cutting, octile
 * heuristic. Distances are planar grid distances in metres; no Earth geodesy.
 * Constraints are never relaxed: if no path exists the blockers are reported.
 */
export function findPath(
  grid: TerrainGrid,
  from: GridCell,
  to: GridCell,
  constraints: PathConstraints,
): PathResult {
  const { maxSlopeDegrees } = constraints
  if (
    maxSlopeDegrees !== null &&
    (Number.isNaN(maxSlopeDegrees) || maxSlopeDegrees < 0)
  ) {
    throw new RangeError('maxSlopeDegrees must be null or a non-negative number')
  }
  const slopePenalty = constraints.slopePenalty ?? 0
  if (!Number.isFinite(slopePenalty) || slopePenalty < 0) {
    throw new RangeError('slopePenalty must be a finite, non-negative number')
  }

  const fromClass = classifyCell(grid, from, maxSlopeDegrees)
  if (!fromClass.passable) {
    return failed({ code: 'ENDPOINT_BLOCKED', endpoint: 'from', cause: fromClass.cause })
  }
  const toClass = classifyCell(grid, to, maxSlopeDegrees)
  if (!toClass.passable) {
    return failed({ code: 'ENDPOINT_BLOCKED', endpoint: 'to', cause: toClass.cause })
  }

  const { rows, cols, cellSizeMeters } = grid
  const size = rows * cols
  const indexOf = (row: number, col: number) => row * cols + col
  const start = indexOf(from.row, from.col)
  const goal = indexOf(to.row, to.col)

  const passable = (row: number, col: number) =>
    classifyCell(grid, { row, col }, maxSlopeDegrees)

  const heuristic = (row: number, col: number) => {
    const dr = Math.abs(row - to.row)
    const dc = Math.abs(col - to.col)
    const diagonal = Math.min(dr, dc)
    return (Math.max(dr, dc) - diagonal + diagonal * Math.SQRT2) * cellSizeMeters
  }

  // Cost never drops below distance, so the octile distance heuristic stays admissible.
  const gradeOf = (index: number) =>
    Math.tan(((grid.slopeDegrees[index] as number) * Math.PI) / 180)

  const gScore = new Float64Array(size).fill(Infinity)
  const distance = new Float64Array(size).fill(Infinity)
  const cameFrom = new Int32Array(size).fill(-1)
  const closed = new Uint8Array(size)
  const blockers = new Set<BlockCause>()
  const open = new MinHeap<number>()

  gScore[start] = 0
  distance[start] = 0
  open.push(start, heuristic(from.row, from.col))

  while (open.size > 0) {
    const current = open.pop() as number
    if (closed[current]) continue
    if (current === goal) {
      return { status: 'ok', path: rebuildPath(cameFrom, goal, cols), distanceMeters: distance[goal] }
    }
    closed[current] = 1
    const row = Math.floor(current / cols)
    const col = current % cols

    for (const [dr, dc] of NEIGHBOUR_OFFSETS) {
      const nRow = row + dr
      const nCol = col + dc
      if (nRow < 0 || nRow >= rows || nCol < 0 || nCol >= cols) continue
      const cellClass = passable(nRow, nCol)
      if (!cellClass.passable) {
        blockers.add(cellClass.cause)
        continue
      }
      const isDiagonal = dr !== 0 && dc !== 0
      if (
        isDiagonal &&
        (!passable(row + dr, col).passable || !passable(row, col + dc).passable)
      ) {
        continue
      }
      const next = indexOf(nRow, nCol)
      if (closed[next]) continue
      const length = isDiagonal ? cellSizeMeters * Math.SQRT2 : cellSizeMeters
      const weight =
        slopePenalty === 0 ? 1 : 1 + slopePenalty * ((gradeOf(current) + gradeOf(next)) / 2)
      const tentative = gScore[current] + length * weight
      if (tentative < gScore[next]) {
        gScore[next] = tentative
        distance[next] = distance[current] + length
        cameFrom[next] = current
        open.push(next, tentative + heuristic(nRow, nCol))
      }
    }
  }

  if (maxSlopeDegrees !== null) {
    // Report the decisive blocker: slope only if lifting the limit would connect
    // the endpoints, otherwise what blocks the unconstrained terrain.
    const unconstrained = findPath(grid, from, to, { maxSlopeDegrees: null, slopePenalty })
    return unconstrained.status === 'ok'
      ? failed({ code: 'NO_PATH', blockedBy: ['slope'] })
      : unconstrained
  }

  return failed({
    code: 'NO_PATH',
    blockedBy: BLOCKER_ORDER.filter((cause) => blockers.has(cause)),
  })
}

function failed(reason: PathFailure): PathResult {
  return { status: 'failed', reason }
}

function rebuildPath(cameFrom: Int32Array, goal: number, cols: number): GridCell[] {
  const path: GridCell[] = []
  for (let index = goal; index !== -1; index = cameFrom[index]) {
    path.push({ row: Math.floor(index / cols), col: index % cols })
  }
  return path.reverse()
}
