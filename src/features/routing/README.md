# Route planning boundary

`components/RoutePlanner.tsx` is still an empty-state UI and is not wired to the
algorithms yet. No duration, traversability scoring, or safety calculation exists.

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
