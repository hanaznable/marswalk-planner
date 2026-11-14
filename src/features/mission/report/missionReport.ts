import {
  cellCenterToMap,
  cellSizeMeters,
  toLocalMetres,
  type MapPoint,
  type RasterCell,
} from '../../datasets/terrainContract'
import { elevationAt, type TerrainPackage } from '../../datasets/terrainPackage'
import type { DatasetMetadata } from '../../datasets/types'
import type { DurationEstimate } from '../../eva/evaEstimate'
import type { EvaPlan } from '../../eva/useEvaPlan'
import { waypointRoleLabel } from '../../map/waypointPlacement'
import { describeFailure, type RouteResult, type RouteSummary, type Waypoint } from '../../routing'
import type { RoutePlan } from '../../routing/useRoutePlan'

/** Every user-set scenario input that shaped the plan. */
export interface MissionAssumptions {
  readonly maxSlopeDegrees: number
  readonly slopePenalty: number
  readonly returnToStart: boolean
  readonly walkingSpeedKmh: number
  readonly stopMinutes: number
}

export interface MissionReportInput {
  readonly generatedAt: Date
  readonly terrain: TerrainPackage
  /** Registry entry for real packages; null for synthetic terrain. */
  readonly dataset: DatasetMetadata | null
  readonly waypoints: readonly Waypoint[]
  readonly plan: RoutePlan | null
  readonly eva: EvaPlan | null
  readonly assumptions: MissionAssumptions
}

export interface ReportLeg {
  readonly kind: 'outbound' | 'return'
  readonly from: string
  readonly to: string
  readonly status: 'ok' | 'failed'
  readonly distanceMeters: number | null
  /** Plain-language reason when the leg failed. */
  readonly failure: string | null
  /** Cell centres in the terrain's source CRS; empty for a failed leg. */
  readonly path: readonly MapPoint[]
}

export interface ReportRoute {
  readonly profile: 'shortest' | 'slope-aware'
  readonly complete: boolean
  /** Unknown values are null, never zero. */
  readonly distanceMeters: number | null
  readonly elevationGainMeters: number | null
  readonly elevationLossMeters: number | null
  readonly duration: DurationEstimate | null
  readonly legs: readonly ReportLeg[]
}

export interface MissionReport {
  readonly format: 'marswalk-mission-report'
  readonly version: 1
  readonly generatedAt: string
  readonly disclaimers: readonly string[]
  readonly terrain: {
    readonly id: string
    readonly title: string
    readonly synthetic: boolean
    readonly source: { readonly productId: string; readonly url: string; readonly attribution: string } | null
    readonly crsName: string
    readonly cellSizeMeters: number
    readonly limitations: readonly string[]
  }
  readonly assumptions: MissionAssumptions
  readonly waypoints: readonly {
    readonly order: number
    readonly id: string
    readonly role: string
    readonly label: string
    readonly cell: RasterCell
    readonly localMetres: { readonly east: number; readonly north: number }
    readonly sourceCrs: MapPoint
    readonly elevationMeters: number | null
  }[]
  readonly routes: {
    readonly identical: boolean
    readonly shortest: ReportRoute
    readonly slopeAware: ReportRoute
  } | null
}

const SYNTHETIC_LIMITATION = 'Synthetic development terrain: made-up values, not NASA data.'

/** A complete, self-describing record of the current plan for export or printing. */
export function buildMissionReport(input: MissionReportInput): MissionReport {
  const { terrain, dataset, waypoints, plan, eva, assumptions } = input
  const { raster, synthetic, source } = terrain.manifest
  const cellSize = cellSizeMeters(raster)
  const roleOf = (id: string) => {
    const index = waypoints.findIndex((waypoint) => waypoint.id === id)
    return index === -1 ? id : waypointRoleLabel(index, waypoints.length)
  }

  const route = (
    profile: ReportRoute['profile'],
    result: RouteResult,
    summary: RouteSummary,
    duration: DurationEstimate | null,
  ): ReportRoute => ({
    profile,
    complete: result.complete,
    distanceMeters: summary.distanceMeters,
    elevationGainMeters: summary.elevationGainMeters,
    elevationLossMeters: summary.elevationLossMeters,
    duration,
    legs: result.legs.map((leg) => ({
      kind: leg.kind,
      from: roleOf(leg.fromId),
      to: roleOf(leg.toId),
      status: leg.status,
      distanceMeters: leg.status === 'ok' ? leg.distanceMeters : null,
      failure: leg.status === 'failed' ? describeFailure(leg.reason, roleOf) : null,
      path: leg.status === 'ok' ? leg.path.map((cell) => cellCenterToMap(raster, cell)) : [],
    })),
  })

  return {
    format: 'marswalk-mission-report',
    version: 1,
    generatedAt: input.generatedAt.toISOString(),
    disclaimers: [
      'Prototype planning output for the NASA Space Apps Challenge 2026; not an operationally validated navigation or safety product.',
      `Distances are planar grid distances on the terrain's ${cellSize} m routing grid; no Earth geodesy.`,
      'Slope limit, slope penalty, walking speed and stop time are user scenario assumptions, not certified limits.',
      'EVA duration is a simple planning estimate (walking time plus stop time), not a physiological model.',
    ],
    terrain: {
      id: terrain.manifest.id,
      title: terrain.manifest.title,
      synthetic,
      source: source ? { productId: source.productId, url: source.url, attribution: source.attribution } : null,
      crsName: terrain.manifest.crs.name,
      cellSizeMeters: cellSize,
      limitations: synthetic ? [SYNTHETIC_LIMITATION] : [...(dataset?.limitations ?? [])],
    },
    assumptions: {
      maxSlopeDegrees: assumptions.maxSlopeDegrees,
      slopePenalty: assumptions.slopePenalty,
      returnToStart: assumptions.returnToStart,
      walkingSpeedKmh: assumptions.walkingSpeedKmh,
      stopMinutes: assumptions.stopMinutes,
    },
    waypoints: waypoints.map((waypoint, index) => {
      const sourceCrs = cellCenterToMap(raster, waypoint.cell)
      const local = toLocalMetres(raster, sourceCrs)
      return {
        order: index + 1,
        id: waypoint.id,
        role: waypointRoleLabel(index, waypoints.length),
        label: waypoint.label,
        cell: { row: waypoint.cell.row, col: waypoint.cell.col },
        localMetres: { east: local.x, north: local.y },
        sourceCrs,
        elevationMeters: elevationAt(terrain, waypoint.cell),
      }
    }),
    routes: plan
      ? {
          identical: plan.alternatives.identical,
          shortest: route('shortest', plan.alternatives.distance, plan.distanceSummary, eva?.shortest.duration ?? null),
          slopeAware: route('slope-aware', plan.alternatives.terrain, plan.terrainSummary, eva?.slopeAware.duration ?? null),
        }
      : null,
  }
}

/** e.g. marswalk-mission-pahrump-hills-v1-20261114-1805Z.json (UTC). */
export function missionReportFileName(report: MissionReport): string {
  const stamp = report.generatedAt.replace(/[-:]/g, '').replace(/^(\d{8})T(\d{4}).*$/, '$1-$2Z')
  return `marswalk-mission-${report.terrain.id}-${stamp}.json`
}
