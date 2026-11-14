# Proceeding with pending layers

The selected six layers are now available on the main planner. The remaining
catalog entries represent unfinished source preparation, not installed datasets
that can be enabled by a switch. Work through these incrementally.

## Shared spatial filter and acceptance criteria

Initial study area, under the documented prototype coordinate convention:

- West/east longitude: 137.36916875 / 137.38603935 degrees east.
- South/north latitude: -4.67151887 / -4.65464827 degrees.

Search with a small surrounding margin, then intersect the actual scene footprint
and usable-pixel mask with the exact projected terrain bounds. Bounding-box
intersection alone is insufficient. For every new product retain its source URL,
product/version ID, original label, hash, native grid/CRS, acquisition metadata,
units, invalid/quality masks and processing steps. Keep the original download in
ignored raw storage. Export independent assets rather than changing the existing
terrain manifest and invalidating its science/context version binding.

## 1. Surface color: now delivered as a registered prototype

Source: [HiRISE ESP_039280_1755](https://www.uahirise.org/ESP_039280_1755),
map-projected Merged RGB `ESP_039280_1755_MRGB.JP2` (listed around 206 MB).
The full source and labels are now local under
`data/raw/pahrump-hills/color-research/`.

The completed processing inspected color coverage, compared embedded georeferencing
with its label, transformed/cropped to the AOI and compared identifiable features
throughout the existing RED orthoimage. The MRGB label uses central meridian
180 degrees; the terrain uses 137.39 degrees. Map projection is not evidence of
matching terrain orthorectification. Address displaced features before integrating
the overlay; do not hide registration errors by tinting the grayscale image.

An independently versioned image and provenance are now delivered with a
grayscale/enhanced-RGB choice. The source grayscale strip is retained. The product is
enhanced surface imagery: HiRISE RGB uses a synthetic blue channel. Details and
relative registration evidence are in [surface-color-review.md](surface-color-review.md).
The next new scientific data work is one CRISM scene, below.

## 2. CRISM mineral indicators

Use the [PDS CRISM archive](https://pds-geosciences.wustl.edu/missions/mro/crism.htm)
and [Mars Orbital Data Explorer](https://ode.rsl.wustl.edu/mars/) to identify
products intersecting the AOI. Start with one suitable map-projected targeted
product (MTRDR) and its spectral-summary documentation. No particular scene has
yet passed an AOI/quality check for this project.

Download that scene's label, relevant spectral/summary products and quality
information. Verify actual pixel scale, mask artifacts/invalid samples, inspect
spectra supporting a chosen indicator, and compare against published local
mineral findings. Deliver a named spectral indicator with units/definition,
quality masks and source provenance. A bright summary parameter is not a
quantitative mineral abundance; do not label it as a percent mineral map.
Keep this contextual layer separate from the 5 m route-cost grid.

## 3. Geological units and contacts

Find a published geologic map or a scientific paper's georeferenced data release
covering this square. No suitable product has been validated here yet. Read the
map scale, coordinate system, unit descriptions and boundary confidence. A
perspective rover panorama is not a GIS polygon layer.

Prefer original GIS vectors. If only a figure is available, check whether its
georeferencing and spatial precision support the intended use before digitizing.
Export source-linked units/contacts with their original uncertainty. If available
mapping is too coarse, retain it as regional context rather than drawing precise
contacts through individual target rocks.

## 4. THEMIS thermal context (lower priority at this footprint)

Search the [THEMIS Image Explorer](https://themis-data.asu.edu/) with the AOI,
then choose a scientifically defined quantity: temperature from a specific
observation or thermal inertia from a documented derived product/model.
They are different products and must have different labels.

Verify acquisition time, season, calibration, native resolution, quality masks,
units and (for derived values) model assumptions. Nominal IR sampling is around
100 m/pixel, so only about ten native pixels span our kilometre. Resampling does
not add detail. This layer can provide regional thermophysical context; it is
not a predictor of astronaut temperature, oxygen or energy use.
See the [instrument FAQ](https://themis-data.asu.edu/faq).

## 5. Surface hazards

First define the observable classes required, for example mapped dunes/sand
patches, scarps or block fields. Inspect suitable imagery and mission context,
record the evidence and review polygons before display. Keep inferred material
properties and safety thresholds out of the map unless separately supported.

Slope does not determine bearing strength or sinkage, and image darkness alone
does not establish dangerous loose sand. Start with descriptive obstacle overlays;
adding any route penalty later requires an explicit, reviewed model and
coordination with Developer Y.

## Team handoff

Developer B prepares and validates the assets and provenance. The user's explicit
request authorized the current main-page layer integration; no routing/EVA or
shared terrain/science schema change was required. Future raster/vector contracts
and route-cost changes should be coordinated with Developer Y. Follow the existing
PR workflow before merging or publishing these local changes.
