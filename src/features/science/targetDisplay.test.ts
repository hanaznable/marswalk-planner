import { describe, expect, it } from 'vitest'
import type { ScienceTarget } from '../datasets/scienceTargets'
import { kindLabel, outsideReason, solSummary, waypointAtCell } from './targetDisplay'

// Made-up target, not NASA data.
const base: ScienceTarget = {
  id: 't',
  name: 'Test',
  kind: 'drill-site',
  position: { x: 0, y: 0, uncertaintyMeters: null, basis: 'rover-position-proxy' },
  mission: null,
  activitySol: null,
  positionSol: null,
  description: 'Test.',
  sources: [],
}

describe('solSummary', () => {
  it('keeps activity and position sols apart', () => {
    expect(solSummary({ ...base, activitySol: 780, positionSol: 779 })).toBe(
      'Activity: Sol 780 - position recorded: Sol 779',
    )
  })

  it('merges equal sols', () => {
    expect(solSummary({ ...base, activitySol: 780, positionSol: 780 })).toBe(
      'Activity and position: Sol 780',
    )
  })

  it('says which sol is missing', () => {
    expect(solSummary({ ...base, activitySol: 780 })).toBe('Activity: Sol 780 - position sol not stated')
    expect(solSummary({ ...base, positionSol: 0 })).toBe('Position recorded: Sol 0 - activity sol not stated')
  })

  it('is null when no sol is known', () => {
    expect(solSummary(base)).toBeNull()
  })
})

describe('labels', () => {
  it('names kinds and outside reasons', () => {
    expect(kindLabel('drill-site')).toBe('Drill site')
    expect(outsideReason('outsideTerrain')).toBe('Outside the terrain area')
    expect(outsideReason('noData')).toBe('On cells without elevation data')
  })
})

describe('waypointAtCell', () => {
  const waypoints = [
    { id: 'wp-1', label: 'A', cell: { row: 1, col: 2 } },
    { id: 'wp-2', label: 'B', cell: { row: 3, col: 4 } },
  ]

  it('finds the waypoint on the same cell', () => {
    expect(waypointAtCell(waypoints, { row: 3, col: 4 })?.id).toBe('wp-2')
  })

  it('is null when no waypoint stands there', () => {
    expect(waypointAtCell(waypoints, { row: 2, col: 1 })).toBeNull()
  })
})
