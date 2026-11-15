# Processed mission assets

The default planner loads `gale/pahrump-hills-v1/`: a real contract-v1 terrain
package with 5 m Float32 elevation/slope grids, a same-footprint HiRISE JPEG,
manifest and provenance. Absolute geolocation and image/DEM registration
accuracy remain unverified. No validated hazard or precomputed EVA route layer
is supplied; routes are calculated in the browser.

Separate runtime assets:

- `science/pahrump-hills-v1/`: three sourced drill-associated rover-position proxies.
- `layer-lab/pahrump-hills-v1/context.json`: APXS observations, spatially clipped
  historical traverse and a published Buckskin mineral finding; used by both
  the planner and Layer Lab.
- `imagery/pahrump-hills-rgb-v1/`: empirically registered enhanced RGB, with
  partial color coverage and synthetic blue. It is not a mineral map.

`gale/pahrump-hills/` is the older image-only research preview, not the runtime
terrain API. Other region labels do not imply available data.

See [the source guide](../../docs/data-sources.md) for processing and limitations.
Raw downloads stay outside Git and are unnecessary for running the application.
Never put credentials or private files here: Vite serves this directory publicly.
