import { describe, expect, it } from 'vitest'
import { removeActivitySelection } from './activitySelection'

describe('activity waypoint ownership', () => {
  it('removes the generated stop with its last activity', () => {
    expect(removeActivitySelection([{ activityId: 'a', waypointId: 'wp-1', createdWaypoint: true }], 'a')).toEqual({ selected: [], removeWaypointId: 'wp-1' })
  })
  it('preserves an existing manual or observation stop', () => {
    expect(removeActivitySelection([{ activityId: 'a', waypointId: 'wp-1', createdWaypoint: false }], 'a').removeWaypointId).toBeNull()
  })
  it('transfers generated-stop ownership until the final shared activity is removed', () => {
    const first = removeActivitySelection([{ activityId: 'a', waypointId: 'wp-1', createdWaypoint: true }, { activityId: 'b', waypointId: 'wp-1', createdWaypoint: false }], 'a')
    expect(first.removeWaypointId).toBeNull()
    expect(first.selected[0].createdWaypoint).toBe(true)
    expect(removeActivitySelection(first.selected, 'b').removeWaypointId).toBe('wp-1')
  })
  it('leaves unrelated stops and legacy records with unknown ownership intact', () => {
    const list = [{ activityId: 'a', waypointId: 'wp-1' }, { activityId: 'b', waypointId: 'wp-2', createdWaypoint: true }]
    expect(removeActivitySelection(list, 'a')).toEqual({ selected: [list[1]], removeWaypointId: null })
  })
})
