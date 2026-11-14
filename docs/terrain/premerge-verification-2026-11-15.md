# Pre-merge verification: 2D baseline

Completed 2026-11-15. Implementation commit: `6ff83e5` on
`batuhan/terrain-validation`. The user confirmed frontend review is complete.
This report records local verification; it does not claim a merge or a hosted
CI result.

## Completed cleanup

- Basemap lifecycle reports loading, success and failure to both map and layer
  panel. Successful loading clears prior errors; detached image events cannot
  overwrite the active image status. Numeric terrain/routing remains usable
  when an image fails.
- The prototype banner uses its own row on narrow map containers and does not
  overlap the view/expand controls.
- Explicit APXS/mineral waypoint selections retain structured provenance in a
  waypoint-ID sidecar: source record, measurement sol (or null), source snapshot
  hash (or null), original rover-position proxy, unstated uncertainty, references
  and review flags. Routing algorithms and terrain contracts are unchanged.
- JSON and printable reports include this metadata. A dragged waypoint is marked
  relocated; the original source coordinates are preserved. Clearing/removing
  waypoints removes sidecar entries, so reused IDs do not inherit old sources.
- README and preprocessing instructions describe the actual implementation.
  Plain `npm run lint` ignores raw downloads, including local QGIS temporary
  folders. Frontend review was not requested again.

## Isolated committed checkout

A detached Git worktree was created from `6ff83e5`, with a separate dependency
installation using `npm ci --offline --no-audit --no-fund`. The install added
181 lockfile packages. `data/raw` was absent. No original NASA raster, QGIS
installation, local browser cache or Python preprocessing step was needed to
build or run the app.

Checks in that checkout:

- `npm run build`: passed.
- `npm test`: 193 tests passed in 25 files.
- `npm run lint`: passed with the repository's standard command.
- `python -m unittest discover -s scripts/terrain -p 'test_*.py'`: 23 tests passed.
- Working tree remained clean after these checks.

## Browser verification of the production build

Served the isolated checkout's `dist` using Vite preview on localhost, then
tested with Chrome. 39 checks passed across three focused suites:

1. Pre-merge regressions (15): real static assets; accurate image-error status;
   numeric terrain and science remaining available during image failure;
   same-URL recovery; stale-event isolation; narrow-map banner separation;
   observation/mineral waypoint selection; printable source metadata; JSON
   record/hash/position/flags; relocation disclosure and retained original source
   coordinates; both route alternatives on real terrain; clearing source
   metadata before manual waypoints; complete round-trip reports; no runtime
   exceptions.
2. RGB integration (15): default grayscale; actual checked RGB bytes; color/
   coverage caveats; preserved footprint and viewport; slope/science overlays;
   3D placeholder round-trip/StrictMode; grayscale restoration; mobile width;
   independent RGB download failure/retry; Layer Lab color availability; no
   runtime exceptions.
3. Observation actions (9): named APXS/mineral waypoint actions; passive opening;
   retained proxy labels; recognition of existing waypoints; shared-cell
   duplicate prevention across layers; no runtime exceptions.

The route smoke test used real grid cells (18,125) and (157,195) with the default
20-degree slope scenario and penalty 3. Both shortest and slope-aware routes
completed, and exported round trips included outbound/return legs for both.
These are software regression checks, not operational safety certification.

Browser helpers/screenshots remain ignored local audit artifacts. Source-linked
data/provenance, unit tests and this verification record are committed.

## Merge boundary and next phase

No original raw files, credentials, `node_modules`, `dist`, browser profiles or
temporary screenshots are included. The original terrain hashes remain valid.
Processed imagery is about 409 KB; most added lines are generated, source-based
context/provenance JSON.

All currently published Yusuf feature branches were already contained in main
at the pre-merge fetch. This branch includes main's `3fbbb99`; any later main
changes must be checked before the actual merge. The prepared PR should merge
this reviewed 2D baseline first, then both developers branch from the same
updated main for Developer B's independent 3D viewer and Developer Y's UI
redesign. Merge execution is left to the user.

Known prototype limits remain explicit: unverified absolute geolocation,
rover-position proxies, conservative slope aggregation, empirical relative RGB
registration/partial color coverage and scenario-based EVA estimates. CRISM,
thermal/geology/hazard additions and 3D remain separate increments.
