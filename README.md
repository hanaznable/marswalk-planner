# Marswalk Planner

A modular Mars exploration prototype for a NASA Space Apps Challenge
2026 project. The project name is provisional. Built with React, TypeScript,
Vite, and Leaflet, with pure TypeScript route planning. There is no backend,
database, authentication, or 3D renderer.

## Product scope

The planned product is an astronaut-centered Mars science route planner with
terrain and science layers, historical mission context, scientific target
selection, equipment constraints, round-trip planning, route comparison, mission
budgets, and export. Route planning runs on the real Pahrump Hills prototype
terrain package (HiRISE DTM); a labeled synthetic terrain remains as a development
option. Other planned capabilities should not be inferred to be implemented.

See [Project scope and phased roadmap (Turkish)](SCOPE.md) for the MVP, later
phases, data requirements, acceptance criteria, and open decisions. Rover planning,
live replanning, and 3D rendering are outside the initial MVP.

## Run locally

```sh
npm install
npm run dev
```

Use the local URL printed by Vite. On Windows PowerShell with disabled script
execution, use `npm.cmd install` and `npm.cmd run dev`.

```sh
npm run build   # Type-check and build to dist/
npm run preview # Serve the production build locally
npm run lint   # Existing ESLint configuration
npm test       # Routing, map/domain and real terrain contract checks
```

## Project structure

```text
src/
  App.tsx                          Shell composition and workspace UI state
  App.css                          Responsive layout and component styles
  index.css                        Theme tokens, typography, global accessibility
  components/
    layout/                        Header and workspace status bar
    ui/Icon.tsx                    Shared SVG icons; no icon dependency
  features/
    datasets/                      Region metadata, empty registry, dataset types
    map/
      components/LayersPanel.tsx   Layer controls and empty data catalog
      components/MapViewport.tsx   View selection and map frame
      components/MapCanvas.tsx     Isolated Leaflet renderer and navigation
      types.ts                     View-mode UI contract
    mission/MissionPanel.tsx      Mission details and planning panel tabs
    routing/                       Pure route algorithms, UI and terrain adapter
    terrain/                       Independent future 3D renderer boundary
scripts/preprocessing/             Future Python geospatial preparation
scripts/terrain/                   Region configs, source checks and v1 exporter
public/data/gale/pahrump-hills-v1/  Real terrain package, loaded by the app at startup
```

## Current behavior

- Gale Crater · Pahrump Hills (default) loads the real terrain package with
  explicit loading and error states (with retry); it never falls back to
  synthetic terrain. Jezero Crater has no package and shows an explicit empty
  state. A labeled synthetic development terrain can be selected explicitly.
- Pan and zoom the HiRISE basemap with keyboard or pointer controls; reset the
  view and expand or restore the viewport.
- Toggle the visual viewport grid, inspect the data catalog (source,
  attribution, grid and prototype limitations), and switch between route
  planning and mission information.
- Switch to a clearly labeled 3D placeholder. No 3D code is loaded or rendered.
- Desktop uses three columns. On narrower screens panels flow below the map.
- Place, move and order waypoints; compare distance and slope-aware routes and
  include a return leg on the loaded terrain.

## Data honesty and integration

A real contract-v1 terrain package is prepared under
`public/data/gale/pahrump-hills-v1`: numeric 5 m elevation/slope grids, matching
HiRISE basemap, manifest and provenance. See [terrain preparation](scripts/terrain/README.md).
The app loads it through `src/features/datasets/loadTerrainPackage.ts` and shows
its attribution and prototype limitations. The real package documents a working
georeferencing convention and unverified registration accuracy; it is not an
operationally validated navigation product. Science targets are not included.

Leaflet uses `CRS.Simple` for a local metric frame derived from raster bounds.
The source Mars CRS and projected geotransform remain in the terrain manifest;
map clicks and route cells use explicit conversion helpers. Do not use Earth
basemap tiles or interpret projected Mars metres as Earth coordinates.

Keep NASA asset provenance and reference-system metadata in `features/datasets`.
Perform Python preprocessing outside the browser; serve validated outputs from
`public/data`. Future route algorithms should consume validated data without
depending on React or Leaflet. Future Three.js / React Three Fiber rendering
belongs in `features/terrain` and should load on demand. Neither the datasets
boundary nor route algorithms should import a renderer.

The UI uses optional Google Fonts with local system fallbacks. No dataset
requests are made. Leaflet and its TypeScript definitions are the only additions
to the starter dependencies.
