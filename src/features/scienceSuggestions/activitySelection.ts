export interface ActivitySelection {
  activityId: string
  waypointId: string
  createdWaypoint?: boolean
}

/** Transfer ownership when several activities share a generated route stop. */
export function removeActivitySelection(selected: readonly ActivitySelection[], activityId: string) {
  const removed = selected.find(s => s.activityId === activityId)
  const remaining = selected.filter(s => s.activityId !== activityId)
  const shared = removed && remaining.find(s => s.waypointId === removed.waypointId)
  return {
    selected: removed?.createdWaypoint && shared
      ? remaining.map(s => s === shared ? { ...s, createdWaypoint: true } : s)
      : remaining,
    removeWaypointId: removed?.createdWaypoint && !shared ? removed.waypointId : null,
  }
}
