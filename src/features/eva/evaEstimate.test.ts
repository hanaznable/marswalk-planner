import { describe, expect, it } from 'vitest'
import type { GridCell, RouteResult } from '../routing'
import { elevationProfile, estimateDuration, formatDuration } from './evaEstimate'

const cells = (...cols: number[]) => cols.map((col) => ({ row: 0, col }))

// Two legs over 3 + 2 cells, 10 m cells: 30 m then 20 m.
const route: RouteResult = {
  profile: { kind: 'distance' },
  complete: true,
  totalDistanceMeters: 30,
  legs: [
    { status: 'ok', kind: 'outbound', fromId: 'a', toId: 'b', path: cells(0, 1, 2), distanceMeters: 20 },
    { status: 'ok', kind: 'outbound', fromId: 'b', toId: 'c', path: cells(2, 3), distanceMeters: 10 },
  ],
}

const failedRoute: RouteResult = {
  profile: { kind: 'distance' },
  complete: false,
  totalDistanceMeters: null,
  legs: [
    { status: 'failed', kind: 'outbound', fromId: 'a', toId: 'b', reason: { code: 'NO_PATH', blockedBy: [] } },
  ],
}

describe('estimateDuration', () => {
  it('adds walking time at the given speed to stop time at every waypoint after the start', () => {
    // 30 m at 1.8 km/h = 1 min; stops at b and c, 10 min each
    expect(estimateDuration(route, { walkingSpeedKmh: 1.8, stopMinutes: 10 })).toEqual({
      walkingMinutes: 1,
      stopCount: 2,
      stopMinutes: 20,
      totalMinutes: 21,
    })
  })

  it('counts each stop once on a round trip', () => {
    const roundTrip: RouteResult = {
      ...route,
      totalDistanceMeters: 60,
      legs: [
        ...route.legs,
        { status: 'ok', kind: 'return', fromId: 'c', toId: 'a', path: cells(3, 0), distanceMeters: 30 },
      ],
    }
    expect(estimateDuration(roundTrip, { walkingSpeedKmh: 1.8, stopMinutes: 10 })).toEqual({
      walkingMinutes: 2,
      stopCount: 2,
      stopMinutes: 20,
      totalMinutes: 22,
    })
  })

  it('returns null when the route is incomplete', () => {
    expect(estimateDuration(failedRoute, { walkingSpeedKmh: 2, stopMinutes: 10 })).toBeNull()
  })

  it.each([
    [{ walkingSpeedKmh: 0, stopMinutes: 10 }],
    [{ walkingSpeedKmh: Number.NaN, stopMinutes: 10 }],
    [{ walkingSpeedKmh: 2, stopMinutes: -1 }],
    [{ walkingSpeedKmh: 2, stopMinutes: Infinity }],
  ])('rejects invalid assumptions %o', (assumptions) => {
    expect(() => estimateDuration(route, assumptions)).toThrow(RangeError)
  })
})

describe('elevationProfile', () => {
  // Synthetic elevations by column: 10, 14, 12, 18 (m).
  const elevationAt = (cell: GridCell) => [10, 14, 12, 18][cell.col] ?? null

  it('lists cumulative distance and elevation along every leg without repeating joins', () => {
    expect(elevationProfile(route, elevationAt, 10)).toEqual([
      { distanceMeters: 0, elevationMeters: 10 },
      { distanceMeters: 10, elevationMeters: 14 },
      { distanceMeters: 20, elevationMeters: 12 },
      { distanceMeters: 30, elevationMeters: 18 },
    ])
  })

  it('measures diagonal steps as sqrt2 cells', () => {
    const diagonal: RouteResult = {
      ...route,
      legs: [
        { status: 'ok', kind: 'outbound', fromId: 'a', toId: 'b', path: [{ row: 0, col: 0 }, { row: 1, col: 1 }], distanceMeters: 10 * Math.SQRT2 },
      ],
    }
    const profile = elevationProfile(diagonal, elevationAt, 10)
    expect(profile?.[1].distanceMeters).toBeCloseTo(10 * Math.SQRT2)
  })

  it('returns null for an incomplete route or a cell without elevation', () => {
    expect(elevationProfile(failedRoute, elevationAt, 10)).toBeNull()
    const offMap: RouteResult = {
      ...route,
      legs: [{ status: 'ok', kind: 'outbound', fromId: 'a', toId: 'b', path: cells(3, 4), distanceMeters: 10 }],
    }
    expect(elevationProfile(offMap, elevationAt, 10)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatDuration(45.4)).toBe('45 min')
    expect(formatDuration(85)).toBe('1 h 25 min')
    expect(formatDuration(120)).toBe('2 h 0 min')
    expect(formatDuration(null)).toBe('—')
  })
})
