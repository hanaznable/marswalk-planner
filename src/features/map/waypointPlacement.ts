import {
  cellCenterToMap,
  fromLocalMetres,
  mapToCell,
  toLocalMetres,
  type MapPoint,
  type RasterCell,
  type RasterGrid,
} from '../datasets/terrainContract'
import { isCellCovered, type TerrainPackage } from '../datasets/terrainPackage'
import type { Waypoint } from '../routing'

export type PlacementResult =
  | { readonly ok: true; readonly cell: RasterCell; readonly point: MapPoint }
  | { readonly ok: false; readonly reason: 'outsideTerrain' | 'noData' }

/** Snaps a map point to its terrain cell. Points without elevation data are rejected. */
export function placeWaypoint(pkg: TerrainPackage, point: MapPoint): PlacementResult {
  const cell = mapToCell(pkg.manifest.raster, point)
  if (cell === null) return { ok: false, reason: 'outsideTerrain' }
  if (!isCellCovered(pkg, cell)) return { ok: false, reason: 'noData' }
  return { ok: true, cell, point: cellCenterToMap(pkg.manifest.raster, cell) }
}

export function waypointRoleLabel(index: number, count: number): string {
  if (index === 0) return 'Start'
  if (index === count - 1) return 'Destination'
  return `Stop ${index}`
}

/** The waypoint's own name (e.g. a science target), or null for an automatic "Point N". */
export function waypointName(waypoint: Waypoint): string | null {
  return /^Point \d+$/.test(waypoint.label) ? null : waypoint.label
}

export function nextWaypointId(list: readonly Waypoint[]): string {
  const highest = list.reduce((max, waypoint) => {
    const match = /^wp-(\d+)$/.exec(waypoint.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `wp-${highest + 1}`
}

// Leaflet CRS.Simple works in local metres: lat = metres north and lng = metres
// east of the raster's south-west corner. Source CRS points go in and come out.
export function toLatLng(raster: RasterGrid, point: MapPoint): [number, number] {
  const local = toLocalMetres(raster, point)
  return [local.y, local.x]
}

export function fromLatLng(
  raster: RasterGrid,
  latLng: { lat: number; lng: number },
): MapPoint {
  return fromLocalMetres(raster, { x: latLng.lng, y: latLng.lat })
}
