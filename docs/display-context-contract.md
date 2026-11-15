# Display context and selected-waypoint provenance

These interfaces are integrated into the planner, reports and browser-local
mission library. They extend display/selection metadata without changing the
terrain contract, science-target contract or routing algorithms. They live in `features/mapLayers/` and
`features/datasets/waypointOrigin.ts`.

Display context is registered per terrain package, with an exact terrain
manifest hash. APXS entries include the source table hash, CSV row, name,
measurement sol, source-position proxy and review flags. Mineral entries cite
their published source. Source geometry must be covered and traverse segments
must be clipped. These records do not supply route costs or safety thresholds.

An explicit popup action stores `WaypointOrigin` in a waypoint-ID sidecar in
`useWaypoints`. It is never reconstructed from display labels or proximity to a
record. Routing still consumes only ordered waypoints/cells and terrain data.
Removing/clearing waypoints removes the associated metadata; reordering preserves
it. Region scoping follows the existing waypoint state.
Saved missions retain these explicit origins and restore them when opened on a
compatible terrain grid; this is independent of recalculating the route.

Mission-report v1 exports an optional `waypoints[].provenance` object for these
explicit selections. It contains kind, stable source record identity, name,
mission, measurement sol (or null), description, source position/basis/unknown
uncertainty, references, source hash (or null) and review flags. `locationRelation`
is `source-cell` when the current snapped cell matches the recorded source cell,
or `relocated` after a move elsewhere. Source coordinates are not moved or
relabeled as a new scientific measurement. Printable reports show this metadata
and disclose relocation. Ordinary waypoints keep the previous report shape.

The historical traverse remains a separately labelled context line. The
enhanced-RGB package has its own manifest, exact terrain binding, image hash,
registration evidence and partial-color caveats. It is a display asset, not a
replacement terrain or mineral dataset.
