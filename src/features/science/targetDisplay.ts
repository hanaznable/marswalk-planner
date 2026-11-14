import type {
  ScienceTarget,
  ScienceTargetKind,
  UnplacedTarget,
} from '../datasets/scienceTargets'
import type { GridCell, Waypoint } from '../routing'

const KIND_LABELS: Record<ScienceTargetKind, string> = {
  'drill-site': 'Drill site',
  'observation-site': 'Observation site',
  'landing-site': 'Landing site',
  'traverse-point': 'Traverse point',
  landmark: 'Landmark',
}

export function kindLabel(kind: ScienceTargetKind): string {
  return KIND_LABELS[kind]
}

export function outsideReason(reason: UnplacedTarget['reason']): string {
  return reason === 'outsideTerrain'
    ? 'Outside the terrain area'
    : 'On cells without elevation data'
}

/** "Sol 780", or null when the source gives no sol. */
export function solLabel(sol: number | null): string | null {
  return sol === null ? null : `Sol ${sol}`
}

/**
 * Activity and position-record sols, kept separate as the contract requires.
 * Null when neither is known.
 */
export function solSummary(target: ScienceTarget): string | null {
  const activity = solLabel(target.activitySol)
  const position = solLabel(target.positionSol)
  if (activity && position) {
    return target.activitySol === target.positionSol
      ? `Activity and position: ${activity}`
      : `Activity: ${activity} · position recorded: ${position}`
  }
  if (activity) return `Activity: ${activity} · position sol not stated`
  if (position) return `Position recorded: ${position} · activity sol not stated`
  return null
}

const sameCell = (a: GridCell, b: GridCell) => a.row === b.row && a.col === b.col

/** The waypoint already standing on this target's cell, if any. */
export function waypointAtCell(waypoints: readonly Waypoint[], cell: GridCell): Waypoint | null {
  return waypoints.find((waypoint) => sameCell(waypoint.cell, cell)) ?? null
}
