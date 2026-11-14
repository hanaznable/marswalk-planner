# Mars EVA Planner — Project Roadmap

## 1. Project Overview

We are developing a web application for the **NASA Space Apps Challenge 2026**, based on the *Interplanetary Survival Guide: Martian Map* challenge.

The application will help users plan scientific exploration routes for human astronauts on Mars using real NASA mission datasets.

**Study region:** Gale Crater, Mars — primarily Pahrump Hills and its surroundings.

**Target area:** Approximately 1 × 1 km. Exact coordinates will be determined after validating the available terrain data.

**Project name:** Temporary and subject to change.

### Main Goal

Create an interactive map where users can:

- Explore real Martian terrain.
- View elevation, slope, and scientific information.
- Select starting points, destinations, and scientific stops.
- Calculate and compare shortest-distance and terrain-aware routes.
- Review route distance, elevation changes, and estimated EVA walking time.
- Optionally explore the same terrain in 3D.

The application is a prototype for exploration planning, not an operationally validated astronaut navigation system.

## 2. Technology Stack

- **Frontend:** React, TypeScript, Vite
- **2D Map:** Leaflet
- **Routing:** A* pathfinding
- **Data Processing:** Python, Rasterio, NumPy, GDAL
- **3D Visualization (optional):** Three.js / React Three Fiber
- **Collaboration:** Git and GitHub
- **Code Quality:** ESLint

No backend, database, or authentication is planned for the initial version.

These are our current technology choices and may be revised with team agreement.

## 3. Team Responsibilities

### Developer B — NASA Data & Terrain

Responsible for:

- Finding and selecting real NASA datasets.
- Processing Gale Crater orbital imagery and elevation models (DEM).
- Checking geographic coverage, resolution, and data validity.
- Preparing aligned terrain images and elevation grids.
- Calculating terrain slope and optional hillshade.
- Preparing verified scientific points of interest.
- Developing optional 3D terrain visualization.

Main working directories:

- `scripts/terrain/`
- `public/data/gale/`
- `docs/data-sources.md`
- `src/features/terrain3d/` (later)

### Developer Y — Frontend & Route Planning

Responsible for:

- React application structure and user interface.
- Interactive Leaflet map.
- Map layers, controls, and markers.
- Start/destination/waypoint selection.
- A* routing and route comparison.
- EVA mission planning and estimated walking time.
- Connecting Developer B's processed datasets to the frontend.
- Application integration and usability.

Main working directories:

- `src/app/`
- `src/features/map/`
- `src/features/routing/`
- `src/features/eva/`
- `src/features/science-ui/`

Shared types, configuration files, and dependencies should be changed with coordination.

## 4. NASA Data Sources

### Initial Dataset Candidates

**HiRISE Digital Terrain Model:**
`DTEEC_040770_1755_039280_1755_A01`

https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755

**Orbital imagery:** Corresponding HiRISE orthorectified image.

**Additional sources:**
- https://trek.nasa.gov/mars/
- https://ode.rsl.wustl.edu/mars/
- https://pds.nasa.gov/
- https://jmars.asu.edu/
- https://science.nasa.gov/mission/msl-curiosity/location-map/

The selected products and study-area boundaries are provisional until coverage and data quality are verified.

Do not invent scientific measurements, NASA coordinates, or observations.

## 5. Development Phases

### Phase 1 — Project Setup and Application Shell

**Developer B:**
- Research and validate the Pahrump Hills DEM and orbital imagery.
- Identify a suitable study area.
- Inspect dataset metadata, resolution, and geographic coverage.

**Developer Y:**
- Build the React application layout.
- Create the map viewport, layer sidebar, and route/EVA panel.
- Set up a modular frontend architecture.

**Shared milestone:** Agree on the terrain data format and coordinate conventions.

### Phase 2 — 2D Map and Terrain Data

**Developer B:**
- Download and crop the selected DEM and imagery.
- Align the datasets to a shared raster grid.
- Export web-compatible elevation and image files.
- Document source metadata and coordinate transformations.

**Developer Y:**
- Implement Leaflet map interaction.
- Add zoom, pan, layer controls, and markers.
- Prepare a reusable data-loading interface.

**Milestone:** Display real Gale Crater terrain in the web application.

### Phase 3 — Terrain Analysis and Routing

**Developer B:**
- Calculate slope and optional hillshade.
- Validate elevation values and invalid terrain cells.
- Prepare terrain layers for routing and visualization.

**Developer Y:**
- Implement A* pathfinding.
- Add shortest-distance and slope-aware route options.
- Draw routes on the map.
- Show distance and elevation profiles.

**Milestone:** Calculate routes using real Gale Crater elevation data.

### Phase 4 — Scientific Exploration and EVA Planning

**Developer B:**
- Find and prepare verified Curiosity scientific observation locations.
- Add scientific descriptions and source references.

**Developer Y:**
- Display scientific points of interest.
- Allow users to add waypoints.
- Implement round-trip planning.
- Calculate estimated walking time and mission summaries.

**Milestone:** Plan an EVA route visiting scientific targets.

### Phase 5 — Optional 3D Visualization

**Developer B:**
- Build a 3D terrain viewer from the processed DEM.
- Add camera controls and, if feasible, orbital image textures.

**Developer Y:**
- Help integrate the viewer into the application.
- Provide route coordinates for 3D visualization.

**Milestone:** Display the same terrain and route in 2D and 3D.

This phase is optional and must not delay the core application.

### Phase 6 — Testing and Deployment

**Both developers:**
- Integrate completed features.
- Check coordinate and terrain alignment.
- Test routing and interface behavior.
- Fix errors and performance issues.
- Prepare the deployed application and hackathon demonstration.

## 6. Collaboration Rules

- Use a shared GitHub repository.
- Develop features in separate branches.
- Merge completed features through Pull Requests.
- Avoid editing each other's owned directories without coordination.
- Keep changes small and independently testable.
- Read `AGENTS.md` and this roadmap before starting a new task.
- Update the roadmap when team decisions or priorities change.

**Important:** Neither developer should wait unnecessarily for the other.

Developer Y can build the application and test routing with clearly labeled synthetic development data while Developer B prepares the real NASA datasets.

## 7. Current Status

Updated 2026-11-15 (Developer B branch; 2D baseline committed and clean-checkout
verified, PR preparation complete; merge remains pending).

**Implemented:**
- Gale Crater as the study region.
- Pahrump Hills as the first real terrain package (`pahrump-hills-v1`).
- Exact 1 × 1 km projected coverage, a 200 × 200 routing grid at 5 m,
  elevation, conservative native-maximum slope and orbital basemap.
- Terrain contract v1, real-data map integration, shortest and slope-aware
  routes, waypoints, round trips, EVA estimates and report export.
- Science contract v1 and Developer Y's target list/map/report integration.
- User-selected main-map display layers: elevation, slope, drill proxies,
  APXS research observations, historical traverse and a published mineral finding.
  Context display does not change routing or approve candidate mission targets.
- Optional HiRISE enhanced RGB basemap, empirically registered to the existing
  ortho with separate validation/provenance. Partial color coverage and absolute
  geolocation limitations remain explicit; grayscale is the default.
- Developer B's three sourced drill-associated rover-position proxies:
  Confidence Hills, Mojave 2 and Telegraph Peak, with separate provenance.
- React, TypeScript, Vite, Leaflet.
- Python-based NASA terrain processing.
- A* routing.
- Developer responsibilities.

**Not yet finalized:**
- Absolute geolocation and image/DEM registration accuracy (the documented
  prototype working convention is not an accuracy certification).
- Exact drill-hole positions and source-stated positional uncertainties.
- Additional observation-specific evidence and instrument analysis results.
- A separate contract for the historical Curiosity traverse, if needed.
- Final project name.
- Final shared 3D scene/selection contract and UI redesign specification.

## 8. Immediate Next Steps

**Developer B:** Merge the verified 2D baseline through its PR, then create a
fresh branch from updated main for the independent 3D terrain viewer. Agree on
scene axes, metric scale, vertical display offset, imagery UV/grid mapping and
NoData behavior before projecting existing routes/targets into 3D.

**Developer Y:** Frontend integration review is complete per the user. After the
baseline merge, start the UI redesign from the same updated main, preserving
source caveats, selection/waypoint flows, report exports and loading/error states.

**Both:** Use the completed pre-merge verification in
`docs/terrain/premerge-verification-2026-11-15.md`. Merge the baseline before the
larger 3D/UI changes; agree on a small shared view/selection contract and retain
one routing implementation. Coordinate additional scientific data/coverage work.

**Core priority:** Build a working 2D Gale Crater map with real terrain-aware route planning before expanding to optional features.
