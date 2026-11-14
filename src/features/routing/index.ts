// Public API of the routing feature. Pure TypeScript: no React, Leaflet, or renderer imports.
export type {
  BlockCause,
  GridCell,
  LegKind,
  LegResult,
  RouteFailureReason,
  RouteProfile,
  RouteResult,
  Waypoint,
} from './model/types'
export {
  insertWaypoint,
  moveWaypoint,
  removeWaypoint,
  updateWaypoint,
} from './model/waypoints'
export {
  createTerrainGrid,
  type TerrainGrid,
  type TerrainGridInput,
} from './pathfinding/terrainGrid'
export {
  planAlternatives,
  planRoute,
  type RouteAlternatives,
  type RoutePlanInput,
} from './planRoute'
export { terrainPackageToGrid } from './adapters/terrainPackageGrid'
export {
  describeFailure,
  formatDistance,
  summarizeRoute,
  type RouteSummary,
} from './routeStats'
