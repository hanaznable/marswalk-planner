import { removeActivitySelection, type ActivitySelection } from './activitySelection'
import { useEffect, useState } from 'react'
import { parseScienceActivities, type ScienceActivityCollection, type ScienceActivity } from '../datasets/scienceActivities'
import type { TerrainPackage } from '../datasets/terrainPackage'
import type { DatasetMetadata } from '../datasets/types'
import type { Waypoint } from '../routing'
import type { SciencePlanSnapshot } from './model'

const registry: Readonly<Record<string, string>> = {
  'pahrump-hills-v1': 'data/science-activities/pahrump-hills-v1/v3/activities.json',
}
const sha = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
interface Loaded { collection: ScienceActivityCollection; hash: string }
interface Choice extends Loaded { terrainId: string; objective: string; equipment: string[]; selected: ActivitySelection[] }
interface LoadState { key: string; status: 'ready' | 'error'; value?: Loaded; terrainHash: string | null; error?: string }

export function useScienceSuggestions(terrain: TerrainPackage | null, dataset: DatasetMetadata | null, waypoints: readonly Waypoint[], addWaypoint: (activity: ScienceActivity) => { id: string; created: boolean } | null, removeWaypoint: (id: string) => void) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<LoadState | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)
  const terrainId = terrain?.manifest.id ?? null
  const [scope, setScope] = useState(terrainId)
  // Waypoint IDs may be reused in a new region; never revive old associations.
  if (scope !== terrainId) { setScope(terrainId); setChoice(null) }
  const url = terrain && dataset ? registry[terrain.manifest.id] : undefined
  const key = url && dataset ? `${terrain!.manifest.id}:${dataset.processedAssetUrl}:${attempt}` : null
  useEffect(() => {
    if (!key || !url || !terrain || !dataset) return
    const controller = new AbortController()
    const request = async (path: string) => {
      const response = await fetch(`${import.meta.env.BASE_URL}${path}`, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status} loading science data`)
      return response.arrayBuffer()
    }
    let terrainHash: string | null = null
    void (async () => {
      const bytes = await request(dataset.processedAssetUrl)
      if (JSON.stringify(JSON.parse(new TextDecoder().decode(bytes))) !== JSON.stringify(terrain.manifest)) throw new Error('Terrain changed; reload this region')
      terrainHash = await sha(bytes)
      const content = await request(url)
      const collection = parseScienceActivities(JSON.parse(new TextDecoder().decode(content)), terrain, terrainHash)
      const hash = await sha(content)
      if (!controller.signal.aborted) setLoaded({ key, status: 'ready', terrainHash, value: { collection, hash } })
    })().catch(e => { if (!controller.signal.aborted) setLoaded({ key, status: 'error', terrainHash, error: String(e) }) })
    return () => controller.abort()
  }, [key, url, terrain, dataset])
  const current = loaded?.key === key ? loaded : null
  const scopedChoice = scope === terrainId && choice?.terrainId === terrainId ? choice : null
  const source = scopedChoice ?? current?.value
  const collection = source?.collection ?? null
  const active: Choice | null = source && terrain ? scopedChoice ?? {
    ...source, terrainId: terrain.manifest.id, objective: source.collection.objectives[0]?.id ?? '', equipment: [], selected: [],
  } : null
  const update = (change: (state: Choice) => Choice) => { if (active) setChoice(change(active)) }
  const live = active?.selected.filter(s => waypoints.some(w => w.id === s.waypointId)) ?? []
  const snapshot: SciencePlanSnapshot | null = active ? {
    collection: active.collection, collectionSha256: active.hash, objectiveId: active.objective, equipmentIds: active.equipment,
    selections: live.map(s => ({ activityId: s.activityId, waypointOrder: waypoints.findIndex(w => w.id === s.waypointId) + 1, createdWaypoint: s.createdWaypoint ?? false })),
  } : null
  return {
    status: !url ? 'none' : current?.status ?? 'loading', error: current?.error,
    terrainHash: current?.terrainHash ?? null, collection, snapshot,
    mismatch: !!active && !!current?.value && active.hash !== current.value.hash,
    objective: active?.objective ?? '', equipment: active?.equipment ?? [], selected: live,
    retry: () => setAttempt(a => a + 1),
    setObjective: (id: string) => update(s => ({ ...s, objective: id })),
    toggleEquipment: (id: string) => update(s => ({ ...s, equipment: s.equipment.includes(id) ? s.equipment.filter(e => e !== id) : [...s.equipment, id] })),
    add: (activity: ScienceActivity) => {
      if (!active || live.some(s => s.activityId === activity.id) || !activity.requiredEquipmentIds.every(id => active.equipment.includes(id))) return false
      const waypoint = addWaypoint(activity)
      if (!waypoint) return false
      update(s => ({ ...s, selected: [...live, { activityId: activity.id, waypointId: waypoint.id, createdWaypoint: waypoint.created }] }))
      return true
    },
    remove: (id: string) => {
      const result = removeActivitySelection(live, id)
      if (result.removeWaypointId) removeWaypoint(result.removeWaypointId)
      update(s => ({ ...s, selected: result.selected }))
    },
    removeWaypoint: (id: string) => update(s => ({ ...s, selected: s.selected.filter(a => a.waypointId !== id) })),
    clear: () => update(s => ({ ...s, selected: [] })),
    restore: (saved: SciencePlanSnapshot | null, restored: readonly Waypoint[]) => {
      if (!saved || !terrain) { setChoice(null); return }
      setChoice({ collection: saved.collection, hash: saved.collectionSha256, terrainId: terrain.manifest.id, objective: saved.objectiveId, equipment: saved.equipmentIds,
        selected: saved.selections.map(s => ({ activityId: s.activityId, waypointId: restored[s.waypointOrder - 1].id, createdWaypoint: s.createdWaypoint ?? false })) })
    },
  }
}
export type ScienceSuggestions = ReturnType<typeof useScienceSuggestions>
