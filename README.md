# Marswalk Planner

A modular Mars exploration application shell for a NASA Space Apps Challenge
2026 project. The project name is provisional. Built with React, TypeScript,
Vite, and Leaflet. There is no backend, database, authentication, routing
algorithm, or 3D renderer.

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
    routing/                       Placeholder UI; future pure route algorithms
    terrain/                       Independent future 3D renderer boundary
scripts/preprocessing/             Future Python geospatial preparation
public/data/                      Future attributed, processed assets
```

## Current behavior

- Choose Jezero Crater or Gale Crater as a workspace label.
- Pan and zoom an empty Leaflet viewport with keyboard or pointer controls;
  reset the view and expand or restore the viewport.
- Toggle the visual viewport grid, inspect the empty data catalog, and switch
  between route planning and mission information.
- Switch to a clearly labeled 3D placeholder. No 3D code is loaded or rendered.
- Desktop uses three columns. On narrower screens panels flow below the map.

## Data honesty and integration

No NASA imagery, elevation, scientific targets, mission observations, coordinates,
or route results are included. The grid and globe illustration are decorative UI,
not scientific data. Unavailable controls are disabled and all integration
states are explicit. Region choices do not load data or imply geographic coverage.

The empty map uses Leaflet `CRS.Simple`, an arbitrary non-geographic canvas. Its
internal origin is not a Mars coordinate. Replace this placeholder with an
explicit Mars-appropriate coordinate reference system when real datasets are
integrated. No Earth basemap tiles, distances, or scale bar are used.

Keep NASA asset provenance and reference-system metadata in `features/datasets`.
Perform Python preprocessing outside the browser; serve validated outputs from
`public/data`. Future route algorithms should consume validated data without
depending on React or Leaflet. Future Three.js / React Three Fiber rendering
belongs in `features/terrain` and should load on demand. Neither the datasets
boundary nor route algorithms should import a renderer.

The UI uses optional Google Fonts with local system fallbacks. No dataset
requests are made. Leaflet and its TypeScript definitions are the only additions
to the starter dependencies.
