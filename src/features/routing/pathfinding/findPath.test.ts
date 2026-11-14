import { describe, expect, it } from 'vitest'
import type { GridCell } from '../model/types'
import { gridFromAscii } from '../testing/gridFromAscii'
import { findPath, type PathConstraints, type PathResult } from './findPath'
import { MinHeap } from './minHeap'
import { classifyCell, type TerrainGrid } from './terrainGrid'

const opts: PathConstraints = { maxSlopeDegrees: null }

function expectValidPath(
  grid: TerrainGrid,
  result: PathResult,
  from: GridCell,
  to: GridCell,
  constraints: PathConstraints,
) {
  expect(result.status).toBe('ok')
  if (result.status !== 'ok') return
  const { path } = result
  expect(path[0]).toEqual(from)
  expect(path[path.length - 1]).toEqual(to)
  for (let i = 1; i < path.length; i++) {
    const dr = Math.abs(path[i].row - path[i - 1].row)
    const dc = Math.abs(path[i].col - path[i - 1].col)
    expect(Math.max(dr, dc)).toBe(1)
  }
  for (const cell of path) {
    expect(classifyCell(grid, cell, constraints.maxSlopeDegrees).passable).toBe(
      true,
    )
  }
}

describe('MinHeap', () => {
  it('pops items in ascending priority', () => {
    const heap = new MinHeap<number>()
    const values = Array.from({ length: 100 }, (_, i) => i)
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[values[i], values[j]] = [values[j], values[i]]
    }
    for (const value of values) heap.push(value, value)
    expect(heap.size).toBe(100)
    const out: number[] = []
    for (let item = heap.pop(); item !== undefined; item = heap.pop()) {
      out.push(item)
    }
    expect(out).toEqual(Array.from({ length: 100 }, (_, i) => i))
  })

  it('returns undefined when empty', () => {
    expect(new MinHeap<string>().pop()).toBeUndefined()
  })
})

describe('findPath', () => {
  it('measures a straight corridor in metres', () => {
    const r = findPath(
      gridFromAscii(['.....'], 10),
      { row: 0, col: 0 },
      { row: 0, col: 4 },
      opts,
    )
    expect(r).toMatchObject({ status: 'ok', distanceMeters: 40 })
    expect(r.status === 'ok' && r.path.length).toBe(5)
  })

  it('uses diagonal steps with sqrt2 cost', () => {
    const r = findPath(
      gridFromAscii(['...', '...', '...'], 10),
      { row: 0, col: 0 },
      { row: 2, col: 2 },
      opts,
    )
    expect(r.status === 'ok' && r.distanceMeters).toBeCloseTo(20 * Math.SQRT2)
  })

  it('returns a zero-length path when from equals to', () => {
    expect(
      findPath(gridFromAscii(['..']), { row: 0, col: 1 }, { row: 0, col: 1 }, opts),
    ).toEqual({ status: 'ok', path: [{ row: 0, col: 1 }], distanceMeters: 0 })
  })

  it('detours around hazards', () => {
    const g = gridFromAscii(['.#.', '.#.', '...'])
    const from = { row: 0, col: 0 }
    const to = { row: 0, col: 2 }
    const r = findPath(g, from, to, opts)
    expectValidPath(g, r, from, to, opts)
    // corner cutting is forbidden, so no diagonal shortcut: down 2, right 2, up 2
    expect(r.status === 'ok' && r.distanceMeters).toBeCloseTo(6)
  })

  it('treats no-data cells as impassable', () => {
    const r = findPath(
      gridFromAscii(['.?.']),
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      opts,
    )
    expect(r).toEqual({
      status: 'failed',
      reason: { code: 'NO_PATH', blockedBy: ['noData'] },
    })
  })

  it('does not cut corners between two blocked orthogonal cells', () => {
    const r = findPath(
      gridFromAscii(['.#', '#.']),
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      opts,
    )
    expect(r).toEqual({
      status: 'failed',
      reason: { code: 'NO_PATH', blockedBy: ['hazard'] },
    })
  })

  it('respects the slope limit and reports it as the blocker', () => {
    const g = gridFromAscii(['.6.']) // 30 degrees in the middle
    const from = { row: 0, col: 0 }
    const to = { row: 0, col: 2 }
    expect(findPath(g, from, to, { maxSlopeDegrees: null }).status).toBe('ok')
    expect(findPath(g, from, to, { maxSlopeDegrees: 25 })).toEqual({
      status: 'failed',
      reason: { code: 'NO_PATH', blockedBy: ['slope'] },
    })
  })

  it('reports blocked endpoints before searching', () => {
    const g = gridFromAscii(['.#?'])
    expect(findPath(g, { row: 0, col: 1 }, { row: 0, col: 0 }, opts)).toEqual({
      status: 'failed',
      reason: { code: 'ENDPOINT_BLOCKED', endpoint: 'from', cause: 'hazard' },
    })
    expect(findPath(g, { row: 0, col: 0 }, { row: 0, col: 2 }, opts)).toEqual({
      status: 'failed',
      reason: { code: 'ENDPOINT_BLOCKED', endpoint: 'to', cause: 'noData' },
    })
    expect(findPath(g, { row: 0, col: 0 }, { row: 5, col: 5 }, opts)).toEqual({
      status: 'failed',
      reason: { code: 'ENDPOINT_BLOCKED', endpoint: 'to', cause: 'outOfCoverage' },
    })
  })

  it.each([Number.NaN, -1])('rejects invalid slope limit %s', (limit) => {
    expect(() =>
      findPath(gridFromAscii(['..']), { row: 0, col: 0 }, { row: 0, col: 1 }, {
        maxSlopeDegrees: limit,
      }),
    ).toThrow(RangeError)
  })

  it('solves a 300x300 open grid corner to corner', () => {
    const g = gridFromAscii(Array.from({ length: 300 }, () => '.'.repeat(300)))
    const r = findPath(g, { row: 0, col: 0 }, { row: 299, col: 299 }, opts)
    expect(r.status === 'ok' && r.distanceMeters).toBeCloseTo(299 * Math.SQRT2)
  })
})
