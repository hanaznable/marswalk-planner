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

interface ScopedState {
  /** Manifest id of the terrain the waypoints were placed on. */
  readonly terrainId: string | null
  readonly waypoints: Waypoint[]
  readonly notice: string | null
}

/**
 * Ordered waypoint list for one terrain package, with placement validation.
 * Waypoints are grid cells of a specific package, so they are dropped when the
 * terrain changes instead of being reinterpreted on another grid.
 */
export function useWaypoints(terrain: TerrainPackage | null) {
  const terrainId = terrain?.manifest.id ?? null
  const [state, setState] = useState<ScopedState>({ terrainId, waypoints: [], notice: null })
  const current = state.terrainId === terrainId ? state : { terrainId, waypoints: [], notice: null }
  const { waypoints, notice } = current

  const update = (change: (scoped: ScopedState) => Partial<ScopedState>) =>
    setState((previous) => {
      const base =
        previous.terrainId === terrainId ? previous : { terrainId, waypoints: [], notice: null }
      return { ...base, ...change(base) }
    })
  const setNotice = (message: string | null) => update(() => ({ notice: message }))
  const setWaypoints = (change: (list: Waypoint[]) => Waypoint[]) =>
    update((scoped) => ({ waypoints: change(scoped.waypoints) }))

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
    clear: () => setWaypoints(() => []),
  }
}
