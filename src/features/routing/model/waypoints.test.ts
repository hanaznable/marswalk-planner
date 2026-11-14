import { describe, expect, it } from 'vitest'
import type { Waypoint } from './types'
import {
  insertWaypoint,
  moveWaypoint,
  removeWaypoint,
  updateWaypoint,
} from './waypoints'

const a: Waypoint = { id: 'a', label: 'A', cell: { row: 0, col: 0 } }
const b: Waypoint = { id: 'b', label: 'B', cell: { row: 1, col: 1 } }
const c: Waypoint = { id: 'c', label: 'C', cell: { row: 2, col: 2 } }

const ids = (list: readonly Waypoint[]) => list.map((w) => w.id)

describe('waypoint list operations', () => {
  it('insertWaypoint appends by default and inserts at index', () => {
    expect(ids(insertWaypoint([a, c], b))).toEqual(['a', 'c', 'b'])
    expect(ids(insertWaypoint([a, c], b, 1))).toEqual(['a', 'b', 'c'])
  })

  it('insertWaypoint rejects duplicate ids', () => {
    expect(() => insertWaypoint([a], { ...a, label: 'x' })).toThrow()
  })

  it('removeWaypoint removes by id and ignores unknown ids', () => {
    expect(ids(removeWaypoint([a, b, c], 'b'))).toEqual(['a', 'c'])
    expect(ids(removeWaypoint([a, b], 'zzz'))).toEqual(['a', 'b'])
  })

  it('moveWaypoint reorders and clamps the target index', () => {
    expect(ids(moveWaypoint([a, b, c], 'a', 2))).toEqual(['b', 'c', 'a'])
    expect(ids(moveWaypoint([a, b, c], 'c', -5))).toEqual(['c', 'a', 'b'])
  })

  it('updateWaypoint patches label and cell without touching others', () => {
    const out = updateWaypoint([a, b], 'b', { label: 'B2' })
    expect(out[1]).toEqual({ ...b, label: 'B2' })
    expect(out[0]).toBe(a)
  })

  it('does not mutate the input list', () => {
    const list = [a, b]
    removeWaypoint(list, 'a')
    insertWaypoint(list, c)
    moveWaypoint(list, 'a', 1)
    expect(ids(list)).toEqual(['a', 'b'])
  })
})
