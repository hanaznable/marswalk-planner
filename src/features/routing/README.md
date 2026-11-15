# Route planning boundary

`components/RoutePlanner.tsx` is connected to waypoint editing, route settings,
route comparison, profiles, EVA estimates and report export. `useRoutePlan.ts`
recalculates when terrain, waypoints, constraints or the return preference change.
Duration/profile calculations live in `../eva/`; they use scenario speed and
stop duration, without a physiological or resource-consumption model.

The route core is pure TypeScript, exported from `index.ts`, and independent of
React, Leaflet, and the 3D renderer:

- `model/` holds the domain types (waypoints, legs, route results, failure
  reasons) and immutable waypoint list helpers.
- `pathfinding/` holds `TerrainGrid` (a projected grid with metric cells, per-cell
  slope or no data, and a hazard mask) and A* `findPath` (8-neighbour moves, no
  corner cutting).
- `planRoute.ts` plans ordered legs, an optional separately computed return leg,
  and side-by-side distance-focused and terrain-constrained alternatives.

No-data cells are impassable, constraints are never relaxed silently, failed
routes report why, and unknown totals are `null`, never zero. Slope limits are
scenario assumptions. Algorithms accept validated, processed dataset inputs
rather than fetching data or reading map state. Do not use Earth geodesy for Mars.
Run the tests with `npm test`.

The production terrain adapter supplies elevation validity and pipeline slope,
but no hazard mask: terrain contract v1 has no hazard asset. Core hazard-mask
support and synthetic tests are not evidence of mapped real hazards. The
distance profile has no slope threshold; the slope-aware profile applies the
user's threshold and penalty. Distances follow the projected grid path, not a
3D surface-length or energy model.
