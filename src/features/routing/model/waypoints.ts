import type { Waypoint } from './types'

// Immutable list helpers: every function returns a new array.

export function insertWaypoint(
  list: readonly Waypoint[],
  waypoint: Waypoint,
  index: number = list.length,
): Waypoint[] {
  if (list.some((item) => item.id === waypoint.id)) {
    throw new Error(`Waypoint id "${waypoint.id}" already exists`)
  }
  const next = [...list]
  next.splice(index, 0, waypoint)
  return next
}

export function removeWaypoint(
  list: readonly Waypoint[],
  id: string,
): Waypoint[] {
  return list.filter((item) => item.id !== id)
}

export function moveWaypoint(
  list: readonly Waypoint[],
  id: string,
  toIndex: number,
): Waypoint[] {
  const from = list.findIndex((item) => item.id === id)
  if (from === -1) return [...list]
  const target = Math.min(Math.max(toIndex, 0), list.length - 1)
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}

export function updateWaypoint(
  list: readonly Waypoint[],
  id: string,
  patch: Partial<Omit<Waypoint, 'id'>>,
): Waypoint[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item))
}
