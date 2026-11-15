# Local app verification — 14 November 2026

**Historical audit:** the four findings below were addressed before baseline
PR #15 was merged. Later work also added 3D, mission saving and the UI redesign.
This report retains the original evidence and test counts; it is not a current
defect list. See [the baseline follow-up](premerge-verification-2026-11-15.md)
and [ROADMAP.md](../../ROADMAP.md).

Reviewed checkout: `37c69ed`, including real-terrain/EVA integration from `b5589ff`.
This is implementation and data-transformation verification, not independent
scientific ground truth, astronaut safety certification, or datum validation.
No frontend, shared contract, routing algorithm, source raster, or terrain
package files were modified by this review.

## Result

Core real-terrain loading, waypoint interactions, pathfinding, route summaries,
return legs, profiles, and scenario-based duration work in the tested cases.
Four UI/status issues remain, listed below. No numerical route defect was found
in the sampled independent comparisons.

## Checks performed

- `npm test`: 132 tests passed across 17 files.
- `npm run build`: type check and production build passed.
- Python terrain tests: 16 passed.
- Verified recorded hashes for the committed terrain output files.
- Independently recomputed all 40,000 output elevations from the original IMG,
  using a separate overlap-matrix implementation, without importing the exporter.
  Maximum stored Float32 difference was 0.00048828125 m (one Float32 step at
  these elevations); this numerical agreement is not measurement accuracy.
- Independently recomputed native Horn slopes with SciPy correlation kernels,
  then maximum-overlap aggregation to 5 m cells. All 40,000 stored degree values
  matched after Float32 conversion.
- Stored height range: approximately -4466.0249 to -4402.6309 m relative to the
  source vertical datum; stored slope range: approximately 0.87576 to 53.40415 deg.
- Compared 18 A* scenarios across six real endpoint pairs against a separate
  Python heap-based Dijkstra implementation. Seventeen had paths and one did not;
  feasibility and minimum objective costs agreed. Checked path adjacency,
  no corner cutting, degree limits, and reported path length.
- Independently recalculated return-trip gain/loss, cumulative profile distance,
  and constant-speed duration plus stops.
- Ran 35 browser checks in installed Chrome: real image/attribution, correct
  click-to-cell mapping, zoom/reset/grid toggle, markers, dragging, reorder,
  intermediate stop add/remove, route rendering, displayed summaries, return
  legs, slope/speed/stop controls, profile keyboard readings, unavailable region,
  explicit synthetic selection, NoData rejection and no cross-region waypoint
  leakage, manifest download failure and retry.
- Checked page overflow at widths 1440, 1024, 900, 700, 390 and 360 px. No
  horizontal page overflow; some overlay controls overlap on narrow screens.
- No unexpected browser runtime exceptions in normal tested flows. Deliberate
  failed-download tests produce expected network errors.

## Concrete route example

Real routing cells: start row 18 / column 125; destination row 157 / column 195.

| Profile | Planar distance | Maximum stored cell slope on path |
| --- | --- | --- |
| Shortest, no slope cap | 839.975 m | 47.6704 deg |
| Slope-aware, cap 20 deg, penalty 3 | 1123.909 m | 18.9883 deg |
| Slope-aware, cap 30 deg, penalty 5 | 845.833 m | 28.1729 deg |

The displayed gain/loss and EVA duration matched the underlying route data.
For the first two profiles, a return trip at 2 km/h with one 10-minute stop
gave approximately 60.3985 and 77.4345 minutes respectively. The browser was
also tested with its default 15-minute stop, then changed to 4 km/h and a
30-minute stop; displayed rounded durations updated correctly.

The shortest route intentionally ignores the user slope cap. A clearly
visible clarification of that fact would help prevent interpreting it as a
safe alternative. Slope-aware cost is a planning heuristic, not physiological
energy consumption. All path distances are planar 8-neighbour grid distances,
not measured surface walking distances.

## Findings for Developer Y

### 1. Basemap error persists after successful recovery — medium

Reproduction:

1. Fail the request for `basemap.jpg` while allowing manifest and F32 files.
2. Confirm the basemap error warning appears.
3. Restore the image request, select Jezero, then select Gale/Pahrump again.
4. The real image loads (natural width 989), but the error warning remains.

`MapCanvas.tsx` stores the failed URL and only sets it on image error. A later
successful image load for the same URL does not clear the state. Handle the
successful image `load` event, with appropriate URL scoping, so a stale request
cannot clear or set the status of a different image.

### 2. Sidebar says image is shown when image download failed — low

During the preceding failure, `LayersPanel.tsx` still reports `SHOWN ON MAP`
and counts imagery as active because it checks package readiness and a URL,
not actual basemap load state. Share explicit image loading/error state with
the relevant status UI. Numeric routing continuing to work in that situation
is intentional and should remain possible.

### 3. Prototype warning overlaps controls on narrow screens — low

The top-centred, nonwrapping prototype banner shares vertical space with the
2D/3D selector and expand control. At narrow/mobile widths its warning is
partly obscured. Give the banner its own responsive position or allow wrapping.
No horizontal document overflow was detected; this is an overlay collision.

### 4. Workspace help text is stale — low

Expanding `About this workspace` in `LayersPanel.tsx` still describes an empty
map and says routing/scientific measurements are not implemented. Update it
to describe the real prototype terrain, routing, scenario estimates and the
features still pending.

## Limits and test setup

- The source image/DEM georeferencing convention remains a documented prototype
  choice. Numerical reproduction cannot validate absolute position or physical
  registration against independent control points.
- Slope means maximum native Horn slope in each coarse cell. It is not the
  derivative of the averaged 5 m heights. It is conservative but cannot detect
  every hazard, and may retain DEM reconstruction artifacts.
- EVA duration assumes constant user-specified speed plus user-specified stops;
  no suit/fatigue/oxygen/terrain-dependent speed model was validated.
- 3D, science marker integration, mineral/thermal layers and resource budgets
  are outside the functioning features checked here.
- Performance observations are local, sampled and not a broad benchmark.
- The local Vite cache was refreshed after the isolated audit server initially
  caused outdated optimized-dependency responses. No application-source patch
  was needed; the audit's separate Vite cache avoids that collision.
- Browser scripts, independent numerical scripts, JSON logs, and screenshots
  are local temporary artifacts under ignored
  `node_modules/.cache/marswalk-audit*`, not committed dependencies or tests.
  The report records the methods and reproduction steps for the findings.

Recommended next action: Developer Y fixes the four UI/status findings and
adds focused regression checks, preserving the verified terrain/routing data.
