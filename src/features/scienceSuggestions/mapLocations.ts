import type { ScienceActivity, ScienceActivityCollection } from '../datasets/scienceActivities'

/** One location can support multiple objectives and experiments. */
export function scienceMapLocations(collection: ScienceActivityCollection) {
  const locations = new Map<string, ScienceActivity[]>()
  for (const activity of collection.activities) {
    if (activity.review.status !== 'reviewed') continue
    const { x, y } = activity.access.point
    const key = `${x},${y}`
    const activities = locations.get(key) ?? []
    activities.push(activity)
    locations.set(key, activities)
  }
  return [...locations.values()].map(activities => ({
    point: activities[0].access.point,
    activities,
    kind: activities.some(a => a.category === 'orbital-candidate') ? 'orbital' as const
      : activities.some(a => a.objectiveIds.includes('mineral-diversity')) ? 'mineralogy' as const
      : activities.some(a => a.objectiveIds.includes('past-water')) ? 'water' as const
      : 'textures' as const,
  }))
}
