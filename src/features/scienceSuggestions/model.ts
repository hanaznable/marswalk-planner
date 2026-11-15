import { parseScienceActivities, type ScienceActivityCollection } from '../datasets/scienceActivities'
import type { TerrainPackage } from '../datasets/terrainPackage'

export interface SciencePlanSnapshot {
  collection: ScienceActivityCollection
  collectionSha256: string
  objectiveId: string
  equipmentIds: string[]
  selections: { activityId: string; waypointOrder: number; createdWaypoint?: boolean }[]
}

export function parseSciencePlan(input: unknown, terrain: TerrainPackage, terrainHash: string, waypointCount: number): SciencePlanSnapshot {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new Error('Science plan must be an object')
  const v = input as Record<string, unknown>
  const collection = parseScienceActivities(v.collection, terrain, terrainHash)
  if (typeof v.collectionSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.collectionSha256)) throw new Error('Science collection hash is invalid')
  if (typeof v.objectiveId !== 'string' || !collection.objectives.some(o => o.id === v.objectiveId)) throw new Error('Science objective is invalid')
  if (!Array.isArray(v.equipmentIds) || !v.equipmentIds.every(id => typeof id === 'string' && collection.equipment.some(e => e.id === id)) || new Set(v.equipmentIds).size !== v.equipmentIds.length) throw new Error('Science equipment is invalid')
  if (!Array.isArray(v.selections)) throw new Error('Science selections must be a list')
  const ids = new Set<string>()
  for (const s of v.selections) {
    if (s && typeof s === 'object' && s.createdWaypoint !== undefined && typeof s.createdWaypoint !== 'boolean') throw new Error('Science waypoint ownership is invalid')
    if (!s || typeof s !== 'object' || typeof s.activityId !== 'string' || !collection.activities.some(a => a.id === s.activityId && a.review.status === 'reviewed') || ids.has(s.activityId) || !Number.isInteger(s.waypointOrder) || s.waypointOrder < 1 || s.waypointOrder > waypointCount) throw new Error('Science activity or waypoint association is invalid')
    ids.add(s.activityId)
  }
  return structuredClone({ ...v, collection }) as unknown as SciencePlanSnapshot
}
