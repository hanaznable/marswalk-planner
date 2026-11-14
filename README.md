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
npm ci
npm run dev
```

Use the local URL printed by Vite. On Windows PowerShell with disabled script
execution, use `npm.cmd ci` and `npm.cmd run dev`. The app needs no Python,
QGIS or raw NASA downloads: processed prototype assets are included.

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
    datasets/                      Region registry, terrain/science contracts and source types
    map/
      components/LayersPanel.tsx   Layer controls, sources and dataset status
      components/MapViewport.tsx   View selection and map frame
      components/MapCanvas.tsx     Isolated Leaflet renderer and navigation
      types.ts                     View-mode UI contract
    mission/MissionPanel.tsx      Mission details and planning panel tabs
    routing/                       Pure route algorithms, UI and terrain adapter
    mapLayers/                     Independent display layers, RGB loading and selection provenance
    science/                       Science target selection and waypoint flow
    terrain/                       Independent future 3D renderer boundary
scripts/preprocessing/             Pointer to the implemented terrain pipeline
scripts/terrain/                   Region configs, source checks and v1 exporter
public/data/gale/pahrump-hills-v1/  Real terrain package, loaded by the app at startup
public/data/science/               Sourced drill-associated rover proxies
public/data/layer-lab/             Version-bound APXS, traverse and mineral context
public/data/imagery/               Registered enhanced RGB and its provenance
layer-lab.html                    Independent local layer comparison page
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
- Toggle elevation, slope, drill proxies, APXS observations, historical traverse
  and a published mineral finding. Select named observations as route waypoints.
- Switch grayscale/enhanced RGB. The RGB prototype is empirically registered to
  the ortho and has partial color coverage; its western grayscale strip is preserved.
- Export JSON or a printable mission report. Explicit APXS/mineral selections
  retain source records, measurement metadata, flags, source coordinates and
  proxy-position caveats; moving a waypoint is disclosed separately.
- Open `/layer-lab.html` to compare display layers. Missing CRISM, thermal,
  geology and hazard data remain labelled as unavailable.

## Data honesty and integration

A real contract-v1 terrain package is prepared under
`public/data/gale/pahrump-hills-v1`: numeric 5 m elevation/slope grids, matching
HiRISE basemap, manifest and provenance. See [terrain preparation](scripts/terrain/README.md).
The app loads it through `src/features/datasets/loadTerrainPackage.ts` and shows
its attribution and prototype limitations. The real package documents a working
georeferencing convention and unverified registration accuracy; it is not an
operationally validated navigation product. Separate science/context collections
provide three drill proxies, 104 APXS records grouped at 30 coordinate pairs,
historical traverse context and the Buckskin mineral finding. Repeated records
and source review flags do not automatically imply separate scientific sites.

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

The UI uses optional Google Fonts with local system fallbacks. Dataset requests
load local static assets. Raw downloads and processing outputs are described in
[terrain documentation](docs/terrain/README.md). The main app never needs an
external NASA server to display the committed demo assets.
