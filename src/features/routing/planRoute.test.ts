import { describe, expect, it } from 'vitest'
import type { Waypoint } from './model/types'
import { planAlternatives, planRoute } from './planRoute'
import { gridFromAscii } from './testing/gridFromAscii'

const wp = (id: string, row: number, col: number): Waypoint => ({
  id,
  label: id,
  cell: { row, col },
})
const open = gridFromAscii(['.....', '.....', '.....'], 10)

describe('planRoute', () => {
  it('splits waypoints into ordered outbound legs and sums distance', () => {
    const r = planRoute(
      open,
      { waypoints: [wp('s', 0, 0), wp('m', 0, 2), wp('t', 0, 4)], returnToStart: false },
      { kind: 'distance' },
    )
    expect(r.legs.map((l) => [l.kind, l.fromId, l.toId])).toEqual([
      ['outbound', 's', 'm'],
      ['outbound', 'm', 't'],
    ])
    expect(r).toMatchObject({ complete: true, totalDistanceMeters: 40 })
  })

  it('computes the return leg as its own search', () => {
    // even when the return path is the same, the leg is listed separately and added to the total
    const r = planRoute(
      open,
      { waypoints: [wp('s', 0, 0), wp('t', 0, 4)], returnToStart: true },
      { kind: 'distance' },
    )
    expect(r.legs.map((l) => [l.kind, l.fromId, l.toId])).toEqual([
      ['outbound', 's', 't'],
      ['return', 't', 's'],
    ])
    expect(r.totalDistanceMeters).toBe(80)
  })

  it('returns an incomplete result with fewer than two waypoints', () => {
    expect(
      planRoute(open, { waypoints: [wp('s', 0, 0)], returnToStart: true }, { kind: 'distance' }),
    ).toEqual({
      profile: { kind: 'distance' },
      legs: [],
      complete: false,
      totalDistanceMeters: null,
    })
  })

  it('reports a waypoint on a no-data cell and leaves the total empty', () => {
    const g = gridFromAscii(['..?'])
    const r = planRoute(
      g,
      { waypoints: [wp('s', 0, 0), wp('t', 0, 2)], returnToStart: false },
      { kind: 'distance' },
    )
    expect(r.legs[0]).toMatchObject({
      status: 'failed',
      reason: { code: 'WAYPOINT_BLOCKED', waypointId: 't', cause: 'noData' },
    })
    expect(r).toMatchObject({ complete: false, totalDistanceMeters: null })
  })

  it('reports the start waypoint when the leg origin is blocked', () => {
    const g = gridFromAscii(['#..'])
    const r = planRoute(
      g,
      { waypoints: [wp('s', 0, 0), wp('t', 0, 2)], returnToStart: false },
      { kind: 'distance' },
    )
    expect(r.legs[0]).toMatchObject({
      status: 'failed',
      reason: { code: 'WAYPOINT_BLOCKED', waypointId: 's', cause: 'hazard' },
    })
  })

  it('still computes later legs after a failed leg', () => {
    const g = gridFromAscii(['.#..'])
    const r = planRoute(
      g,
      { waypoints: [wp('a', 0, 0), wp('b', 0, 2), wp('c', 0, 3)], returnToStart: false },
      { kind: 'distance' },
    )
    expect(r.legs.map((l) => l.status)).toEqual(['failed', 'ok'])
  })
})

describe('planAlternatives', () => {
  it('flags identical results instead of inventing a detour', () => {
    const r = planAlternatives(
      open,
      { waypoints: [wp('s', 0, 0), wp('t', 0, 4)], returnToStart: false },
      { maxSlopeDegrees: 25, slopePenalty: 0 },
    )
    expect(r.identical).toBe(true)
    expect(r.terrain.profile).toEqual({
      kind: 'terrain',
      maxSlopeDegrees: 25,
      slopePenalty: 0,
      slopeLimitIsScenarioAssumption: true,
    })
  })

  it('differs when a steep shortcut exists', () => {
    const g = gridFromAscii(['.6.', '...'], 10)
    const r = planAlternatives(
      g,
      { waypoints: [wp('s', 0, 0), wp('t', 0, 2)], returnToStart: false },
      { maxSlopeDegrees: 25, slopePenalty: 0 },
    )
    expect(r.distance.totalDistanceMeters).toBe(20)
    // a diagonal step next to the steep cell counts as corner cutting: down, right 2, up
    expect(r.terrain.totalDistanceMeters).toBeCloseTo(40)
    expect(r.identical).toBe(false)
  })

  it('reports a terrain failure without relaxing the limit', () => {
    const g = gridFromAscii(['.6.'])
    const r = planAlternatives(
      g,
      { waypoints: [wp('s', 0, 0), wp('t', 0, 2)], returnToStart: false },
      { maxSlopeDegrees: 25, slopePenalty: 0 },
    )
    expect(r.distance.complete).toBe(true)
    expect(r.terrain.legs[0]).toMatchObject({
      status: 'failed',
      reason: { code: 'NO_PATH', blockedBy: ['slope'] },
    })
    expect(r.identical).toBe(false)
  })

  it('applies the slope penalty to the slope-aware profile only', () => {
    // 20 degree cell between two flat cells, flat row below; 10 m cells.
    const g = gridFromAscii(['.4.', '...'], 10)
    const r = planAlternatives(
      g,
      { waypoints: [wp('s', 0, 0), wp('t', 0, 2)], returnToStart: false },
      { maxSlopeDegrees: 45, slopePenalty: 4 },
    )
    expect(r.distance.totalDistanceMeters).toBe(20)
    expect(r.terrain.totalDistanceMeters).toBeCloseTo(20 * Math.SQRT2)
    expect(r.terrain.profile).toMatchObject({ slopePenalty: 4 })
    expect(r.identical).toBe(false)
  })
})
