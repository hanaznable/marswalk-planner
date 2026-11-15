# POLARIS Module — Project Roadmap

Updated 2026-11-15 including the merged naming, license and submission-documentation updates (`d00682f`).
This document describes current status and agreed priorities; older dated review
reports describe their own checkouts, not the latest application.

## 1. Project overview

POLARIS Module is a Mars scientific exploration route-planning prototype for our
NASA Space Apps Challenge 2026 project. It uses real mission data and user-entered
planning assumptions. It is not an operationally validated navigation or astronaut
safety system.

**Current region:** Pahrump Hills and surroundings in Gale Crater.
**Coverage:** exactly 1000 × 1000 projected metres, with a 200 × 200 grid at 5 m.
**Terrain package:** `pahrump-hills-v1`.
Jezero has no package; the separately labelled synthetic region is for development.

The current flow is: inspect terrain/science layers → select start, stops and
destination → compare distance and slope-aware routes → review duration/profile
and return leg → save a named mission or export a report.

The next product increment adds scientific objectives, equipment selections and
source-backed suggested activities to that flow. Historical evidence and our
suggested follow-up activities must remain distinguishable.

## 2. Current technology

- React + TypeScript + Vite; Leaflet for 2D.
- Pure TypeScript A* routing, independent of React and renderers.
- Three.js for a lazy-loaded, read-only 3D terrain view; React Three Fiber is not used.
- Python terrain preparation using NumPy and Pillow; QGIS/GDAL for source inspection.
  Rasterio is not a current pipeline dependency.
- Static, versioned data packages and browser-local mission storage.
- Vitest and ESLint; GitHub branches and pull requests.
- No backend, server database, authentication, or live mission telemetry.

Run the app with `npm run dev`; Windows PowerShell can use `npm.cmd run dev`.
Committed processed assets are sufficient: QGIS, Python and raw downloads are not
required to view the demo. See [README.md](README.md) for setup and checks.

## 3. Team responsibilities

**Developer B (Batuhan):** NASA sources, DEM preprocessing, terrain analysis,
scientific evidence, candidate activities and provenance. Main areas:
`scripts/terrain/`, `public/data/`, `docs/data-sources.md` and terrain/science docs.

**Developer Y (Yusuf):** frontend, Leaflet integration, route/EVA planning,
mission library and UI. Yusuf also implemented the 3D demo and now owns its
frontend development; Developer B reviews data and coordinate conventions.
Main areas: `src/features/map/`, `routing/`, `eva/`, `mission/`, `missions/`,
`science/`, `terrain3d/` and application layout.

Shared contracts in `src/features/datasets/`, display integration and scientific
activity interfaces require coordination. Use separate branches and focused PRs.
Read applicable `AGENTS.md` instructions if present; none is currently tracked.

## 4. Implemented phases

| Phase | Status | Delivered behavior |
| --- | --- | --- |
| 1. Setup and shell | Implemented | Modular React application and desktop-first responsive workspace |
| 2. Real 2D terrain | Implemented prototype | HiRISE basemap, elevation, data loading, pan/zoom, source attribution and explicit failure/empty states |
| 3. Terrain analysis and routing | Implemented prototype | Pipeline slope, A*, distance/slope-aware alternatives, ordered editable waypoints, route statistics and elevation profiles |
| 4. Historical science and basic EVA | Implemented baseline | Drill proxies, APXS context, traverse, Buckskin finding, science-to-waypoint selection, round trips and scenario-based durations |
| 5. Optional 3D | Implemented | Same terrain, imagery, routes, waypoints and context; orbit/reset controls, 1× default scale, labelled exaggeration and 2D fallback |
| 6. Testing and delivery | In progress | Local automated/browser checks exist; submission preparation and deployed-demo verification remain |

Additional completed goals: grayscale/enhanced-RGB selection, POLARIS Module
branding and blue map-focused UI, named browser-local missions with JSON
import/export, and JSON/printable reports retaining selected observation provenance.
Waypoints are edited in 2D. Saved missions store inputs; routes are recalculated
on reopening. This is not a locked/final approval workflow or a cloud library.

The terrain baseline was merged in PR #15, 3D in #16, mission library in #17,
and UI redesign in #19. Historical pre-merge reports must not be treated as
outstanding merge instructions. The UI-review baseline passed 224 tests, lint,
build and documented browser regressions; those results do not certify scientific
accuracy or represent hosted CI.

## 5. Data and model boundaries

See [the current source guide](docs/data-sources.md) for products, runtime locations,
processing, and unresolved validation. The original full rasters remain local.

- Elevation is an area-weighted native DEM mean per 5 m cell. Slope is the maximum
  native Horn slope overlapping each cell, not a derivative of the coarse DEM.
- Absolute geolocation and image/DEM accuracy remain unverified under the
  documented prototype working-origin convention.
- Three drill markers and APXS observation positions are rover-position proxies.
  Exact target/drill-hole coordinates and source-stated uncertainty are unavailable.
- APXS has 104 records at 30 coordinate pairs; these are not 104 separate sites.
  Runtime context does not yet provide chemical-abundance analysis tools.
- The traverse is historical geometry clipped spatially, without per-feature sols;
  it is neither a time-filtered campaign route nor a suggested EVA route.
- The published Buckskin mineral finding is a sample-level observation, not a
  continuous mineral map. APXS chemistry does not identify minerals directly.
- Enhanced RGB is empirically registered, partly grayscale and includes synthetic
  blue. It is not exact human-eye color or mineral abundance.
- Routing uses slope/no-data rules, not a real hazard mask. Its distance profile
  has no slope cutoff. Distances are projected grid-path lengths, not 3D walking
  surface lengths. Slope penalties are planning heuristics, not energy costs.
- EVA time uses user-entered speed and stop duration. There is no physiology,
  fatigue, life-support or resource-consumption model.

## 6. Next increments

1. **Documentation and map/UI fixes - completed:**
   current guides and status claims reconciled, historical reviews labelled,
   source guide updated and contradictory layer wording corrected. The broader
   visitor-facing content pass remains item 4. This fixes branch also delivers
   concise layer/observation details, drill-site filtering, status colors and
   a metric grid with local coordinate labels and a zoom-aware scale bar.
   Science suggestions will use a separate feature branch.
2. **Science activities - implemented on the feature branch:** the
   [activity contract](docs/science-activity-contract-proposal.md) and parser support
   reviewed point/area evidence, three objectives and four equipment capabilities.
   The v3 collection contains twelve historical follow-ups (four sampling proposals)
   and two project-authored HiRISE imaging candidates. See the
   [implementation guide](docs/science-suggestions-implementation.md) and linked
   source reviews for provenance and preparation.
3. **Activity integration - implemented locally:** the Science tab provides
   objective/equipment controls and concise cards; selected activities reuse route
   stops. Mission v2 preserves snapshots with v1 import, and reports separate
   activities from evidence. Routing and stop-time arithmetic remain unchanged.
4. **Visitor-facing content and cleanup:** finish copy review, remove confirmed
   obsolete code, preserve preprocessing tools and historical evidence.
5. **Submission:** complete the dataset/method catalogue, demo narrative, deployment
   checks and recorded limitations. Source documentation grows with each dataset.

Activities should use explainable rules, reviewed evidence and explicit equipment
assumptions. Do not invent findings, durations, safety guarantees or science scores.

## 7. Later work and optional expansion

- Oxygen-only budgeting now uses a documented NASA closed-loop Mars baseline,
  primary-capacity scenario and planning reserve, with 2D route reach overlays.
  [Model, sources and boundaries](docs/eva/oxygen-budget.md). Energy, other
  life-support limits and workload-dependent physiology remain future work.
- CRISM mineral indicators, THEMIS thermal context, geological units and surface
  hazards need independently reviewed data; they remain unavailable. Follow
  [pending-layer steps](docs/terrain/pending-layer-next-steps.md).
- Science/route trade-offs, activity-specific timing and previous-route comparison
  remain future work. Waypoint/settings changes already trigger recalculation.
- Wider Gale coverage and additional regions come after the core science-planning
  flow. Package-driven rendering exists, but large-area tiling, cross-package
  routing and global coverage are not implemented.
- Rover planning, live environmental updates and advanced multi-objective route
  optimization remain optional, separately scoped features.

Preserve the current 2D planner while extending independent modules. Do not
implement every later feature at once or claim unavailable data is integrated.


Science source reviews: [imaging and orbital candidates](docs/terrain/science-objectives-v2.md)
and [rock sampling](docs/terrain/rock-sampling-v3.md). One 2D Science missions switch
controls all science evidence overlays; shared locations expose their distinct
experiments in one popup. Sampling methods remain planning scenarios; no sample
availability, composition, activity duration or laboratory result is invented.
