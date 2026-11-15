import { describe, expect, it } from 'vitest'
import type { RouteResult } from '../routing'
import type { RasterGrid } from '../datasets/terrainContract'
import { estimateOxygen, OXYGEN_RATE_KG_PER_HOUR, OXYGEN_RESERVE_MINUTES, oxygenReport } from './oxygenBudget'

const raster: RasterGrid = { width: 50, height: 10, geoTransform: [0, 10, 0, 100, 0, -10] }
const route = (returnToStart = false): RouteResult => ({
  profile: { kind: 'distance' }, complete: true, totalDistanceMeters: returnToStart ? 200 : 100,
  legs: [
    { status: 'ok', kind: 'outbound', fromId: 'a', toId: 'b', path: Array.from({ length: 11 }, (_, col) => ({ row: 0, col })), distanceMeters: 100 },
    ...(returnToStart ? [{ status: 'ok' as const, kind: 'return' as const, fromId: 'b', toId: 'a', path: Array.from({ length: 11 }, (_, i) => ({ row: 0, col: 10 - i })), distanceMeters: 100 }] : []),
  ],
})
const scenario = { walkingSpeedKmh: 0.6, stopMinutes: 0, oxygenCapacityKg: 0.05 }

describe('source-informed oxygen mass balance and route timeline', () => {
  it('uses the published Mars closed-loop rate and a separate planning reserve', () => {
    expect(OXYGEN_RATE_KG_PER_HOUR).toBe(0.076)
    expect(OXYGEN_RESERVE_MINUTES).toBe(30)
    const b = estimateOxygen(route(), raster, { ...scenario, oxygenCapacityKg: 0.54 })!
    expect(b.requiredKg).toBeCloseTo(40 / 60 * 0.076)
    expect(b.availableMinutes).toBeCloseTo(0.54 / 0.076 * 60 - 30)
    expect(b.withinBudget).toBe(true)
    expect(b.cutoffPoint).toBeNull()
  })
  it('interpolates a cutoff within the actual path instead of scaling a straight line', () => {
    const b = estimateOxygen(route(), raster, scenario)!
    expect(b.reachableDistanceMeters).toBeCloseTo(94.7368421)
    expect(b.cutoffPoint!.x).toBeCloseTo(99.7368421)
    expect(b.cutoffPoint!.y).toBe(95)
    expect(b.cutoffPhase).toBe('walking')
    expect(b.withinPath.at(-1)).toEqual(b.beyondPath[0])
    expect(b.beyondPath.at(-1)).toEqual({ x: 105, y: 95 })
  })
  it('consumes oxygen during stops even when every path metre was reached', () => {
    const b = estimateOxygen(route(), raster, { ...scenario, oxygenCapacityKg: 0.076, stopMinutes: 60 })!
    expect(b.withinBudget).toBe(false)
    expect(b.reachableDistanceMeters).toBe(100)
    expect(b.cutoffPhase).toBe('stop')
    expect(b.beyondPath).toHaveLength(1)
    expect(b.requiredMinutes).toBe(70)
  })
  it('includes the return leg and does not add an extra stop at the starting point', () => {
    const b = estimateOxygen(route(true), raster, { ...scenario, oxygenCapacityKg: 0.076, stopMinutes: 15 })!
    expect(b.requiredMinutes).toBe(35)
    expect(b.availableMinutes).toBe(30)
    expect(b.reachableDistanceMeters).toBeCloseTo(150)
    expect(b.cutoffPoint).toEqual({ x: 55, y: 95 })
    expect(b.cutoffLegKind).toBe('return')
  })
  it('decreases reach when walking is slower or preceding stops are longer', () => {
    const slow = estimateOxygen(route(), raster, { ...scenario, walkingSpeedKmh: 0.5 })!
    const fast = estimateOxygen(route(), raster, { ...scenario, walkingSpeedKmh: 2 })!
    expect(slow.reachableDistanceMeters).toBeLessThan(fast.reachableDistanceMeters)
    const withStop = estimateOxygen(route(true), raster, { ...scenario, oxygenCapacityKg: 0.076, stopMinutes: 15 })!
    const withoutStop = estimateOxygen(route(true), raster, { ...scenario, oxygenCapacityKg: 0.076 })!
    expect(withStop.reachableDistanceMeters).toBeLessThan(withoutStop.reachableDistanceMeters)
  })
  it('never claims oxygen reach through a failed route', () => {
    const broken = { ...route(), complete: false, totalDistanceMeters: null }
    expect(estimateOxygen(broken, raster, scenario)).toBeNull()
  })
  it('validates capacity and includes sources/model assumptions in reports without duplicate geometry', () => {
    for (const oxygenCapacityKg of [0, -1, Infinity, NaN, 2]) expect(() => estimateOxygen(route(), raster, { ...scenario, oxygenCapacityKg })).toThrow(RangeError)
    const r = oxygenReport({ distance: route(), terrain: route(), identical: true }, raster, scenario)
    expect(r.sources).toHaveLength(3)
    expect(r.shortest!.rateKgPerHour).toBe(0.076)
    expect(r.shortest).not.toHaveProperty('withinPath')
    expect(r.shortest!.shortfallKg).toBeGreaterThan(0)
  })
})
