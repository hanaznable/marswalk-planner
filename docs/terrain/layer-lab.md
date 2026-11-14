# Local Layer Lab

Open `/layer-lab.html` with `npm run dev` running. The separate entry page is
also included in `npm run build` and can be served by `npm run preview`.
This Developer B preview imports the existing terrain/science loaders read-only.
It does not modify Developer Y's map components, routing, EVA assumptions or
the approved science-target collection. Its context JSON is separate from the
hashed terrain package.

## Current selection

The user selected elevation, slope, drill proxies, APXS observations, historical
traverse and mineral findings for the main planner. All six are now available
there alongside the grayscale basemap. Hillshade, roughness, terrain coverage
and recorded rover positions have been removed from both pages' controls.
The Lab now has eight usable layers (including the enhanced-RGB prototype) and
four pending entries. The main page offers Grayscale / Enhanced RGB under
Surface imagery. See `surface-color-review.md` for the empirical registration
and partial-color coverage limitations.

Slope is terrain inclination; roughness measures local unevenness after removing
a fitted tilt. They are different, but the experimental coarse-grid roughness
preview was not selected for the application.

Main-map elevation and slope use mutually exclusive color overlays with a legend
and opacity; hiding an overlay does not disable the terrain input to routing.
The three context layers are independently switchable. Opening APXS/mineral
popups does not place waypoints automatically. Their explicit “Add as waypoint”
buttons now add the chosen observation/finding through the existing covered-cell
placement flow. Labels retain “rover proxy”, and positions sharing a routing
cell are deduplicated, including across different layers. Context loading checks
the exact active terrain version and refuses
out-of-coverage points or unclipped line segments. It has its own retry state.

See [pending-layer steps](pending-layer-next-steps.md) for the remaining data work.

## Original preview round (before user selection)

1. Existing grayscale HiRISE orthoimage.
2. Elevation color scale from the delivered 5 m raster.
3. Existing native-maximum slope color scale (degrees).
4. Hillshade from the 5 m elevation raster: Horn gradient, light azimuth 315
   degrees and altitude 45 degrees. This is simulated display lighting.
5. Experimental roughness: RMS residual after least-squares plane removal in a
   3 x 3 cell window. Heights are metres; this is not soil strength or route risk.
6. Finite elevation/slope coverage mask (green covered, red missing).
7. Three reviewed drill-associated rover-position proxies.
8. APXS research candidates: 104 records grouped at 30 coordinate pairs, with
   repeat/sample-handling/quality caveats in marker popups.
9. 113 recorded Curiosity rover waypoints, not automatically science targets.
10. Historical traverse, geometrically clipped to the footprint, not filtered
    to the Pahrump campaign or used as a suggested EVA route.
11. Buckskin's published CheMin tridymite finding at its associated rover pose.
    This is a sample finding, not a mineral-abundance raster.

CRISM mineral indicators, THEMIS thermal context, geological units and mapped
surface hazards remain present in the catalog
with disabled controls and their missing-data/processing explanations. No
invented raster stands in for an unavailable source. See
`science-expansion-research.md` and `surface-color-review.md` for source leads.

## Feedback workflow

- Toggle layers and adjust raster opacity. “Compare this layer alone” hides the
  other layers; re-enable grayscale imagery to inspect an overlay against it.
- Pan/zoom or use “Fit study area”. Raster edges and the source footprint stay
  fixed when layers change. Move over the map to inspect elevation/slope.
- Click APXS/mineral markers for source context and caveats. Closely
  spaced markers can overlap; switch off other point layers or zoom in.
- Write feedback at the bottom of the sidebar and download its JSON. It records
  visible layers, opacity, notes and the exact terrain-manifest hash. Share that
  file or describe the layer and preference in the conversation.
- Test useful layers before integrating them into the planner. Coordinate any
  shared overlay contract with Developer Y. Surface-color processing is now
  delivered as a registered prototype with explicit coverage limitations.

## Reproduction and checks

`python scripts/terrain/export_layer_lab.py` regenerates
`public/data/layer-lab/pahrump-hills-v1/context.json` from the committed APXS
research inventory and ignored, hashed MMGIS waypoint/traverse snapshots.
It checks the terrain version, source hashes and projection convention and
clips each source segment without connecting unrelated line pieces. Original
observations, traverse geometry outside the crop and terrain files are untouched.

The browser also checks the exact served terrain manifest hash before displaying
the context. All metadata/files use LF endings to keep version hashes stable.
The current source projection's absolute geolocation remains unverified.

Original preview validation on 2026-11-15:

- 184 TypeScript tests passed, including independent plane/bump roughness,
  illumination-direction and missing-data tests for the preview derivatives.
- 3 Python segment-clipping tests passed; all 1037 exported segment endpoints
  lie within the delivered footprint.
- Build and ESLint passed (ESLint excludes ignored raw data with pre-existing
  restricted QGIS temporary folders).
- Chrome smoke test: 17 checks passed, covering catalog readiness states, actual
  raster loading, vector overlays, opacity chosen before first visibility, solo
  comparison, feedback JSON contents, desktop/mobile layout and runtime errors.

No CRISM, THEMIS or surface-color raster has been validated by these checks.

Main-map integration validation: 189 TypeScript tests passed, build and ESLint
passed. 21 Chrome checks cover the six selected controls, actual overlays and
source popups, grouped APXS markers, independent drill visibility, retained
viewport and opacity, context-click isolation from waypoint placement, existing
target-to-waypoint functionality, mobile layout, region isolation, a controlled
context-download failure and recovery, and the reduced Lab catalog.
Source terrain files and routing algorithms remain unchanged.

Observation-to-waypoint follow-up: 9 Chrome checks passed for named APXS and
mineral additions, passive popup opening, existing-waypoint recognition,
duplicate prevention across shared observation/mineral cells, and runtime errors.
Build, all 189 TypeScript tests and ESLint passed. The historical traverse remains
a line overlay; its geometry is not automatically inserted as an EVA route.
