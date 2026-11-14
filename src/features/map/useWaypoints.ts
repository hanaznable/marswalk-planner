import { useState } from 'react'
import type { MapPoint } from '../datasets/terrainContract'
import type { TerrainPackage } from '../datasets/terrainPackage'
import {
  insertWaypoint,
  moveWaypoint,
  removeWaypoint,
  updateWaypoint,
  type Waypoint,
} from '../routing'
import { nextWaypointId, placeWaypoint, type PlacementResult } from './waypointPlacement'

const REJECTION_MESSAGES: Record<Extract<PlacementResult, { ok: false }>['reason'], string> = {
  outsideTerrain: 'That point is outside the terrain area.',
  noData: 'No elevation data there. Choose a covered area.',
}

/** Ordered waypoint list for one terrain package, with placement validation. */
export function useWaypoints(terrain: TerrainPackage | null) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  function place(point: MapPoint) {
    if (!terrain) return
    const result = placeWaypoint(terrain, point)
    if (!result.ok) {
      setNotice(REJECTION_MESSAGES[result.reason])
      return
    }
    setNotice(null)
    setWaypoints((list) => {
      const id = nextWaypointId(list)
      return insertWaypoint(list, { id, label: `Point ${id.slice(3)}`, cell: result.cell })
    })
  }

  /** Returns false when the new position is rejected, so the marker can snap back. */
  function relocate(id: string, point: MapPoint): boolean {
    if (!terrain) return false
    const result = placeWaypoint(terrain, point)
    if (!result.ok) {
      setNotice(REJECTION_MESSAGES[result.reason])
      return false
    }
    setNotice(null)
    setWaypoints((list) => updateWaypoint(list, id, { cell: result.cell }))
    return true
  }

  return {
    waypoints,
    notice,
    place,
    relocate,
    remove: (id: string) => setWaypoints((list) => removeWaypoint(list, id)),
    reorder: (id: string, toIndex: number) =>
      setWaypoints((list) => moveWaypoint(list, id, toIndex)),
    clear: () => setWaypoints([]),
  }
}
