/**
 * Route domain model. Pure data: no React, Leaflet, or renderer types.
 * Cells index a projected terrain grid produced by preprocessing; they are not
 * geographic coordinates.
 */
export interface GridCell {
  readonly row: number
  readonly col: number
}

/**
 * Waypoint lists are ordered: the first element is the start, the last is the
 * target, and anything in between is an intermediate stop.
 */
export interface Waypoint {
  readonly id: string
  readonly label: string
  readonly cell: GridCell
}

/** Why a cell cannot be entered. Missing data is never treated as safe. */
export type BlockCause = 'outOfCoverage' | 'noData' | 'hazard' | 'slope'

export type RouteProfile =
  | { readonly kind: 'distance' }
  | {
      readonly kind: 'terrain'
      readonly maxSlopeDegrees: number
      /** Preference for gentler ground; 0 = shortest within the limit. A planning heuristic. */
      readonly slopePenalty: number
      /** The slope limit and penalty are user scenario inputs, not official limits. */
      readonly slopeLimitIsScenarioAssumption: true
    }

export type LegKind = 'outbound' | 'return'

export type RouteFailureReason =
  | {
      readonly code: 'WAYPOINT_BLOCKED'
      readonly waypointId: string
      readonly cause: BlockCause
    }
  | { readonly code: 'NO_PATH'; readonly blockedBy: readonly BlockCause[] }

export type LegResult =
  | {
      readonly status: 'ok'
      readonly kind: LegKind
      readonly fromId: string
      readonly toId: string
      readonly path: readonly GridCell[]
      readonly distanceMeters: number
    }
  | {
      readonly status: 'failed'
      readonly kind: LegKind
      readonly fromId: string
      readonly toId: string
      readonly reason: RouteFailureReason
    }

export interface RouteResult {
  readonly profile: RouteProfile
  readonly legs: readonly LegResult[]
  /** True only when there is at least one leg and every leg succeeded. */
  readonly complete: boolean
  /** Null unless complete; an unknown total is never reported as zero. */
  readonly totalDistanceMeters: number | null
}
