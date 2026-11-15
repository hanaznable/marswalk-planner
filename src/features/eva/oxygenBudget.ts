import { cellCenterToMap, type MapPoint, type RasterGrid } from '../datasets/terrainContract'
import type { RouteAlternatives, RouteResult } from '../routing'
import { estimateDuration, type EvaAssumptions } from './evaEstimate'

export const OXYGEN_MODEL_ID = 'nasa-bvad-mars-closed-loop-v1' as const
export const OXYGEN_RATE_KG_PER_HOUR = 0.076
export const DEFAULT_OXYGEN_KG = 0.54
export const OXYGEN_RANGE = [0.05, 1.5] as const
// A project planning allowance informed by EMU operational reserve practice,
// not a Mars flight rule or the separate emergency oxygen pack.
export const OXYGEN_RESERVE_MINUTES = 30
export const OXYGEN_SOURCES = [
  { title: 'NASA BVAD Rev2 - Mars surface operations, section 4.6.2, p. 134', url: 'https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf#page=148' },
  { title: 'NASA Suited for Spacewalking - EMU primary oxygen, p. 17', url: 'https://ntrs.nasa.gov/api/citations/19950007475/downloads/19950007475.pdf#page=26' },
  { title: 'NASA EVA Hardware & Operations - reserve reference, slide 10', url: 'https://ntrs.nasa.gov/api/citations/20120011735/downloads/20120011735.pdf#page=10' },
] as const

export interface OxygenRouteBudget {
  modelId: typeof OXYGEN_MODEL_ID
  capacityKg: number
  rateKgPerHour: number
  reserveMinutes: number
  availableMinutes: number
  requiredMinutes: number
  requiredKg: number
  shortfallKg: number
  withinBudget: boolean
  reachableDistanceMeters: number
  totalDistanceMeters: number
  cutoffPoint: MapPoint | null
  cutoffPhase: 'walking' | 'stop' | null
  cutoffLegKind: 'outbound' | 'return' | null
  withinPath: MapPoint[]
  beyondPath: MapPoint[]
}
export interface OxygenAlternatives {
  shortest: OxygenRouteBudget | null
  slopeAware: OxygenRouteBudget | null
}

/** Constant-rate mass balance, per astronaut. Never returns reach on a failed route. */
export function estimateOxygen(result: RouteResult, raster: RasterGrid, assumptions: EvaAssumptions): OxygenRouteBudget | null {
  const capacity = assumptions.oxygenCapacityKg ?? DEFAULT_OXYGEN_KG
  if (!Number.isFinite(capacity) || capacity < OXYGEN_RANGE[0] || capacity > OXYGEN_RANGE[1]) throw new RangeError('Oxygen capacity must be between 0.05 and 1.5 kg')
  const duration = estimateDuration(result, assumptions)
  if (!duration || result.legs.some(l => l.status !== 'ok')) return null
  const available = Math.max(0, capacity / OXYGEN_RATE_KG_PER_HOUR * 60 - OXYGEN_RESERVE_MINUTES)
  let remaining = available
  let distance = 0
  let cutoffPoint: MapPoint | null = null
  let cutoffPhase: OxygenRouteBudget['cutoffPhase'] = null
  let cutoffLegKind: OxygenRouteBudget['cutoffLegKind'] = null
  const withinPath: MapPoint[] = [], beyondPath: MapPoint[] = []
  const speed = assumptions.walkingSpeedKmh * 1000 / 60
  for (const leg of result.legs) {
    if (leg.status !== 'ok') return null
    const points = leg.path.map(c => cellCenterToMap(raster, c))
    if (points.length === 0) return null
    if (!cutoffPoint && withinPath.length === 0) withinPath.push(points[0])
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i]
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      const minutes = length / speed
      if (cutoffPoint) { beyondPath.push(b); continue }
      if (remaining + 1e-9 >= minutes) {
        remaining = Math.max(0, remaining - minutes)
        distance += length
        withinPath.push(b)
      } else {
        const fraction = minutes > 0 ? remaining / minutes : 0
        cutoffPoint = { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction }
        cutoffPhase = 'walking'
        cutoffLegKind = leg.kind
        withinPath.push(cutoffPoint)
        beyondPath.push(cutoffPoint, b)
        distance += length * fraction
        remaining = 0
      }
    }
    if (!cutoffPoint && leg.kind === 'outbound') {
      if (remaining + 1e-9 < assumptions.stopMinutes) {
        cutoffPoint = points[points.length - 1]
        cutoffPhase = 'stop'
        cutoffLegKind = leg.kind
        beyondPath.push(cutoffPoint)
        remaining = 0
      } else remaining = Math.max(0, remaining - assumptions.stopMinutes)
    }
  }
  const requiredKg = (duration.totalMinutes + OXYGEN_RESERVE_MINUTES) / 60 * OXYGEN_RATE_KG_PER_HOUR
  return {
    modelId: OXYGEN_MODEL_ID, capacityKg: capacity, rateKgPerHour: OXYGEN_RATE_KG_PER_HOUR,
    reserveMinutes: OXYGEN_RESERVE_MINUTES, availableMinutes: available,
    requiredMinutes: duration.totalMinutes, requiredKg, shortfallKg: Math.max(0, requiredKg - capacity),
    withinBudget: requiredKg <= capacity + 1e-9,
    reachableDistanceMeters: Math.min(distance, result.totalDistanceMeters!), totalDistanceMeters: result.totalDistanceMeters!,
    cutoffPoint, cutoffPhase, cutoffLegKind, withinPath, beyondPath,
  }
}

export function estimateOxygenAlternatives(routes: RouteAlternatives, raster: RasterGrid, assumptions: EvaAssumptions): OxygenAlternatives {
  return { shortest: estimateOxygen(routes.distance, raster, assumptions), slopeAware: estimateOxygen(routes.terrain, raster, assumptions) }
}

/** Geometry already lives in the report's route paths; avoid duplicating it. */
export function oxygenSummary(budget: OxygenRouteBudget | null) {
  if (!budget) return null
  const { withinPath: _within, beyondPath: _beyond, ...summary } = budget
  void _within; void _beyond
  return summary
}

export function oxygenReport(routes: RouteAlternatives | null, raster: RasterGrid, assumptions: EvaAssumptions) {
  const estimates = routes ? estimateOxygenAlternatives(routes, raster, assumptions) : null
  return {
    modelId: OXYGEN_MODEL_ID, capacityKg: assumptions.oxygenCapacityKg ?? DEFAULT_OXYGEN_KG,
    rateKgPerHour: OXYGEN_RATE_KG_PER_HOUR, reserveMinutes: OXYGEN_RESERVE_MINUTES,
    sources: OXYGEN_SOURCES,
    shortest: oxygenSummary(estimates?.shortest ?? null),
    slopeAware: oxygenSummary(estimates?.slopeAware ?? null),
  }
}
