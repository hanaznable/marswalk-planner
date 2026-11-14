/**
 * Placement of planning overlays (waypoints, routes, science and context
 * markers) on the 3D terrain. Pure TypeScript. Positions come from the same
 * terrain package and the same route results the 2D map draws; nothing here
 * plans, scores or snaps anything.
 */
import {
  cellCenterToMap,
  cellSizeMeters,
  mapToCell,
  rasterBounds,
  type MapPoint,
} from '../datasets/terrainContract'
import { elevationAt, type TerrainPackage } from '../datasets/terrainPackage'
import type { RouteResult, Waypoint } from '../routing'
import { waypointRoleLabel } from '../map/waypointPlacement'
import { toScene, type SceneFrame, type ScenePoint } from './sceneFrame'

/**
 * Display height of the terrain surface at a source point, in metres (Mars
 * datum). Bilinear between the surrounding cell centres, which is how the mesh
 * is drawn; falls back to the containing cell where a neighbour has no data.
 * Null outside the footprint or on a no-data cell. Display only: readouts and
 * reports keep using the cell values.
 */
export function surfaceElevationAt(terrain: TerrainPackage, point: MapPoint): number | null {
  const { raster } = terrain.manifest
  const cell = mapToCell(raster, point)
  if (!cell) return null
  const own = elevationAt(terrain, cell)
  if (own === null) return null

  const { width, height } = raster
  const { minX, maxY } = rasterBounds(raster)
  const size = cellSizeMeters(raster)
  const fx = Math.min(Math.max((point.x - minX) / size - 0.5, 0), width - 1)
  const fy = Math.min(Math.max((maxY - point.y) / size - 0.5, 0), height - 1)
  const c0 = Math.floor(fx)
  const r0 = Math.floor(fy)
  const c1 = Math.min(c0 + 1, width - 1)
  const r1 = Math.min(r0 + 1, height - 1)
  const tx = fx - c0
  const ty = fy - r0
  const at = (row: number, col: number) => terrain.elevation[row * width + col]
  const corners = [at(r0, c0), at(r0, c1), at(r1, c0), at(r1, c1)]
  if (!corners.every(Number.isFinite)) return own
  const north = corners[0] * (1 - tx) + corners[1] * tx
  const south = corners[2] * (1 - tx) + corners[3] * tx
  return north * (1 - ty) + south * ty
}

/**
 * Height above the surface for overlay geometry, in unscaled metres. A straight
 * segment between two cell centres can pass slightly under the triangulated
 * surface; a lift proportional to the cell size keeps it visible.
 */
export function overlayLift(terrain: TerrainPackage): number {
  return cellSizeMeters(terrain.manifest.raster) * 0.3
}

/** A source point on the displayed surface plus a lift; null where there is no data. */
export function surfacePoint(
  terrain: TerrainPackage,
  frame: SceneFrame,
  point: MapPoint,
  lift = overlayLift(terrain),
): ScenePoint | null {
  const elevation = surfaceElevationAt(terrain, point)
  if (elevation === null) return null
  const scene = toScene(frame, point, elevation)
  return { ...scene, y: scene.y + lift * frame.verticalScale }
}

/**
 * Successful legs as flat xyz arrays through cell centres. Failed legs have no
 * path and are not drawn, exactly like the 2D map.
 */
export function routeLines(
  terrain: TerrainPackage,
  frame: SceneFrame,
  route: RouteResult,
): Float32Array[] {
  const { raster } = terrain.manifest
  const lift = overlayLift(terrain)
  const lines: Float32Array[] = []
  for (const leg of route.legs) {
    if (leg.status !== 'ok' || leg.path.length < 2) continue
    const values: number[] = []
    for (const cell of leg.path) {
      const elevation = elevationAt(terrain, cell)
      if (elevation === null) continue
      const scene = toScene(frame, cellCenterToMap(raster, cell), elevation)
      values.push(scene.x, scene.y + lift * frame.verticalScale, scene.z)
    }
    if (values.length >= 6) lines.push(Float32Array.from(values))
  }
  return lines
}

/**
 * Line pieces (pairs of xyz points, flat) following the surface between two
 * source points, sampled at most one cell apart. Stretches over no-data or
 * outside the footprint are left out, not bridged.
 */
export function drapeSegment(
  terrain: TerrainPackage,
  frame: SceneFrame,
  from: MapPoint,
  to: MapPoint,
): number[] {
  const size = cellSizeMeters(terrain.manifest.raster)
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / size))
  const pairs: number[] = []
  let previous: ScenePoint | null = null
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const current = surfacePoint(terrain, frame, {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    })
    if (previous && current) pairs.push(previous.x, previous.y, previous.z, current.x, current.y, current.z)
    previous = current
  }
  return pairs
}

export interface WaypointAnchor {
  readonly id: string
  readonly kind: 'start' | 'stop' | 'destination'
  /** Same marker text as the 2D map: S, D, or the stop number. */
  readonly text: string
  readonly title: string
  readonly position: ScenePoint
}

/** Waypoints at their snapped cell centres, in planner order. */
export function waypointAnchors(
  terrain: TerrainPackage,
  frame: SceneFrame,
  waypoints: readonly Waypoint[],
): WaypointAnchor[] {
  const { raster } = terrain.manifest
  const anchors: WaypointAnchor[] = []
  waypoints.forEach((waypoint, index) => {
    const elevation = elevationAt(terrain, waypoint.cell)
    if (elevation === null) return
    const role = waypointRoleLabel(index, waypoints.length)
    const kind = role === 'Start' ? 'start' : role === 'Destination' ? 'destination' : 'stop'
    const scene = toScene(frame, cellCenterToMap(raster, waypoint.cell), elevation)
    anchors.push({
      id: waypoint.id,
      kind,
      text: kind === 'start' ? 'S' : kind === 'destination' ? 'D' : String(index),
      title: `${role}: ${waypoint.label}`,
      position: { ...scene, y: scene.y + overlayLift(terrain) * frame.verticalScale },
    })
  })
  return anchors
}
