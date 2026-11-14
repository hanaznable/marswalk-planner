import { describe, expect, it } from 'vitest'
import type { GridCell, RouteResult } from './model/types'
import { describeFailure, formatDistance, summarizeRoute } from './routeStats'

// Synthetic elevations by column: 10, 14, 12, 18 (m).
const elevationAt = (cell: GridCell) => [10, 14, 12, 18][cell.col] ?? null
const cells = (...cols: number[]) => cols.map((col) => ({ row: 0, col }))

describe('summarizeRoute', () => {
  it('sums distance, elevation gain and loss over all legs', () => {
    const result: RouteResult = {
      profile: { kind: 'distance' },
      complete: true,
      totalDistanceMeters: 30,
      legs: [
        { status: 'ok', kind: 'outbound', fromId: 'a', toId: 'b', path: cells(0, 1, 2), distanceMeters: 10 },
        { status: 'ok', kind: 'outbound', fromId: 'b', toId: 'c', path: cells(2, 3), distanceMeters: 20 },
      ],
    }
    expect(summarizeRoute(result, elevationAt)).toEqual({
      distanceMeters: 30,
      elevationGainMeters: 10, // +4, +6
      elevationLossMeters: 2, // -2
    })
  })

  it('leaves every total empty when the route is incomplete', () => {
    const result: RouteResult = {
      profile: { kind: 'distance' },
      complete: false,
      totalDistanceMeters: null,
      legs: [
        { status: 'failed', kind: 'outbound', fromId: 'a', toId: 'b', reason: { code: 'NO_PATH', blockedBy: ['noData'] } },
      ],
    }
    expect(summarizeRoute(result, elevationAt)).toEqual({
      distanceMeters: null,
      elevationGainMeters: null,
      elevationLossMeters: null,
    })
  })

  it('leaves elevation empty if any path cell has no elevation', () => {
    const result: RouteResult = {
      profile: { kind: 'distance' },
      complete: true,
      totalDistanceMeters: 5,
      legs: [
        { status: 'ok', kind: 'outbound', fromId: 'a', toId: 'b', path: cells(3, 4), distanceMeters: 5 },
      ],
    }
    expect(summarizeRoute(result, elevationAt)).toEqual({
      distanceMeters: 5,
      elevationGainMeters: null,
      elevationLossMeters: null,
    })
  })
})

describe('describeFailure', () => {
  const roleOf = (id: string) => ({ a: 'Start', b: 'Destination' })[id] ?? id

  it('explains a blocked waypoint', () => {
    expect(
      describeFailure({ code: 'WAYPOINT_BLOCKED', waypointId: 'b', cause: 'noData' }, roleOf),
    ).toBe('Destination has no terrain data.')
  })

  it('explains what separates the endpoints', () => {
    expect(describeFailure({ code: 'NO_PATH', blockedBy: ['slope'] }, roleOf)).toBe(
      'Every way through is steeper than the slope limit.',
    )
    expect(describeFailure({ code: 'NO_PATH', blockedBy: ['noData'] }, roleOf)).toBe(
      'Missing terrain data cuts off every way through.',
    )
    expect(describeFailure({ code: 'NO_PATH', blockedBy: [] }, roleOf)).toBe(
      'No way through the terrain.',
    )
  })
})

describe('formatDistance', () => {
  it('uses metres below 1 km and kilometres above', () => {
    expect(formatDistance(640.4)).toBe('640 m')
    expect(formatDistance(1234)).toBe('1.23 km')
    expect(formatDistance(null)).toBe('—')
  })
})
