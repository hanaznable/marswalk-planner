# POLARIS Module â€” integrated data and source guide

Updated 2026-11-15. The planner loads the real Pahrump Hills prototype by default.
This guide covers integrated source groups; per-file hashes and processing
evidence remain in their original manifests/provenance and linked reviews.

Science objectives v2 add reviewed Garden City/CheMin references and two
project-authored HiRISE imaging areas. See the [complete source-link catalog,
position handling and reproducible provenance](terrain/science-objectives-v2.md).
Rock-sampling proposals additionally use [NASA tool and sample-documentation
sources](terrain/rock-sampling-v3.md); the method is a project-authored planning
scenario. No CRISM mineral raster or thermal dataset has been integrated.

## Current runtime assets

| Content | Runtime location under `public/data/` | Source and meaning |
| --- | --- | --- |
| Elevation and slope | `gale/pahrump-hills-v1/` | [HiRISE DTM DTEEC_040770_1755_039280_1755_A01](https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755), NASA/JPL-Caltech/UArizona; 200 Ã— 200 cells, 5 m spacing over 1000 Ã— 1000 projected metres |
| Grayscale basemap | `gale/pahrump-hills-v1/basemap.jpg` | Matching ESP_039280_1755 RED orthoimage; resampled to the terrain footprint, 989 Ã— 989 display pixels |
| Enhanced RGB | `imagery/pahrump-hills-rgb-v1/` | [ESP_039280_1755 MRGB](https://www.uahirise.org/ESP_039280_1755), NASA/JPL-Caltech/UArizona; 1000 Ã— 1000 display pixels at 1 m, derived from 0.5 m source imagery, with empirical relative registration |
| Three drill-associated rover proxies | `science/pahrump-hills-v1/` | Confidence Hills, Mojave 2 and Telegraph Peak; NASA [waypoints](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json) joined to published site/drive associations; [science review](terrain/science-target-review.md) records the sources |
| APXS observations | `layer-lab/pahrump-hills-v1/context.json` | [Berger 2020 PDS supplement, sols 0â€“2301](https://pds-geosciences.wustl.edu/msl/urn-nasa-pds-msl_apxs_supplement_sols_0_2301/), DOI 10.17189/1519050; 104 measurement records at 30 coordinate pairs inside the footprint |
| Historical traverse | Same `context.json` | NASA [MSL_traverse.json](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json), clipped spatially to the loaded footprint; no per-feature sol filter |
| Buckskin mineral finding | Same `context.json` | Published [CheMin tridymite finding](https://www.jpl.nasa.gov/news/nasa-scientists-discover-unexpected-mineral-on-mars/), NASA/JPL-Caltech; one sample-associated rover-position proxy |

The context file serves both the main planner and the separate Layer Lab despite
its directory name. It is display/science context, not a route-cost raster.
Raw NASA files are ignored local inputs; a normal checkout needs none of them.
The older `gale/pahrump-hills/` image-only preview is not the active terrain API.

## Methods, provenance and limits

- [Terrain package](../public/data/gale/pahrump-hills-v1/README.md): Float32
  elevation is an area-weighted source-pixel mean. Slope is maximum native Horn
  slope per 5 m cell. Elevations are metres relative to the label's Mars 2000
  equipotential surface; negative values are expected here.
- [Georeferencing review](terrain/georeferencing-review.md): the prototype uses
  a spherical Mars Equirectangular source frame (radius 3396190 m, central
  meridian 137.39Â°E). Absolute positioning and image/DEM accuracy remain unverified.
- [Science positions](terrain/science-positions-provenance.json): activity and
  position-record sols remain distinct. Rover proxies are not exact holes or rock
  targets; source-stated uncertainty is unavailable. No raster-origin pixel
  shift is added to vector positions.
- [APXS inventory/research](terrain/science-expansion-research.md): source row
  identities and quality flags are retained. The UI shows observation metadata,
  not chemical-abundance analysis; APXS chemistry is not direct mineral identification.
- [RGB review](terrain/surface-color-review.md): partial color, synthetic blue,
  and empirical relative registration; not exact human-eye color, an abundance
  map or an accuracy certification. Display resampling adds no native detail.
- [Context and provenance contract](display-context-contract.md): source records
  survive explicit waypoint selection, relocation, mission saving and reports.
- [Processing tools](../scripts/terrain/README.md): region configuration,
  exporters and source checks. Terrain, science and RGB have separate lifecycles;
  adding context does not require rewriting the terrain package.

There is no validated CRISM mineral raster, thermal layer, geological unit map
or real hazard mask in the application. A point mineral finding is not a
continuous mineral layer. Historical traverse is not a suggested EVA route or
a time-filtered Pahrump Hills campaign trace. See
[pending layers](terrain/pending-layer-next-steps.md) before selecting more data.

The Data sources panel currently summarises the terrain package. Imagery and
observation details provide additional references; a unified visitor-facing
catalogue of all sources/methods remains submission work.

## Terrain selection and validation record

Status: initial metadata inspection followed by a source-based candidate AOI.
A 1000 x 1000 projected-metre square has now been selected using NASA Curiosity
waypoints and drill-associated rover poses. Its DEM missing-value coverage has
been checked. A/B visual review was inconclusive, and the source-consistent UA/JP2
origin was selected for prototype use with accuracy limitations recorded. See
[candidate study area](terrain/README.md) for bounds, provenance, coverage, and
preview and [georeferencing review](terrain/georeferencing-review.md). Source
rasters are unchanged. A native-pixel ortho crop and metadata manifest are now
available under `public/data/gale/pahrump-hills`. The subsequent contract-v1
delivery under `public/data/gale/pahrump-hills-v1` now includes 5 m elevation,
conservatively aggregated slope, a same-footprint JPEG, manifest and provenance.
These are integrated through the package loader and the main 2D/3D views.
See the v1 package README for processing methods and runtime integration.

## Candidate source products

Official product page:
https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755

Local originals are in ignored `data/raw/pahrump-hills/`:

- `DTEEC_040770_1755_039280_1755_A01.IMG`
- `ESP_039280_1755_RED_C_02_ORTHO.JP2` and its matching `.LBL`
- `ESP_040770_1755_RED_C_02_ORTHO.JP2` and its matching `.LBL`

Dataset identifier from the labels: `MRO-M-HIRISE-5-DTM-V1.0`.
Producer: University of Arizona. Credit: NASA/JPL-Caltech/UArizona.
Both ortho labels name the selected DTM as a source product.

## Confirmed from local PDS labels

- Dimensions: 6220 columns x 12171 rows, one band.
- Map scale: 1.0117571650087 metres/pixel.
- Equirectangular, planetocentric latitude, east-positive longitude.
- Projection centre: latitude 0 degrees, longitude 137.39 degrees.
- Label reference sphere: radius 3396190 metres.
- Sample projection offset: 3231.5000000001 pixels.
- Line projection offset: -268474.50000001 pixels.
- DEM samples: 32-bit PC_REAL, scale 1, offset 0.
- DEM elevations: metres relative to the Mars 2000 equipotential surface,
  according to the embedded label; this vertical reference is distinct from
  the horizontal projection's reference sphere.
- DEM missing constant: `16#FF7FFFFB#`.
- Ortho samples: unsigned 8-bit RED grayscale; `CORE_NULL=0`, low saturation
  codes 1 and high saturation codes 255. Do not treat these as quantitative
  science measurements without the label's calibration and quality semantics.

## QGIS / GDAL observations supplied by Developer B

Reported GDAL version: 3.13.3. The read-only comparison script is
`scripts/terrain/inspect_qgis_rasters.py`; run it inside QGIS.

DEM, PDS reader:

```text
GeoTransform = (-3269.9991573082198, 1.0117571650087, 0,
                -271630.49311855587, 0, -1.0117571650087)
NoData = -3.4028226550889045e+38
```

Both orthos, both JP2ECW and JP2OpenJPEG readers:

```text
GeoTransform = (-3268.481521560707, 1.0117571650087, 0,
                -271632.01075430337, 0, -1.0117571650087)
NoData = None
```

Isolating georeferencing sources with JP2OpenJPEG reproduced the transform for
`GEOJP2`; `GMLJP2`, `PAM`, and `WORLDFILE` returned no transform.
The ortho labels define null pixels, but the readers do not expose that as NoData.

The ortho origin differs from the DEM reader's origin by approximately
+1.517636 m east and -1.517636 m north: 1.5 pixels on each axis.
Equal dimensions and scale therefore do not establish a common interpreted grid.

The University of Arizona PDS_JP2 documentation uses `(offset - 1)` for its
unrotated origin calculation; this reproduces the observed JP2 origins from the
local labels. It also warns that PDS pixel-origin conventions can differ.
This supports an interpretation-convention explanation, but does not establish
which georeferencing should be adopted or prove physical feature alignment.

References:

- https://pirlwww.lpl.arizona.edu/software/PDS_JP2/PDS_JP2/classPDS__Projection__Data.html
- https://gdal.org/en/stable/drivers/raster/jp2openjpeg.html
- https://gdal.org/en/stable/drivers/raster/pds.html

QGIS reported approximately 74.11% valid DEM samples using approximate
statistics. This is not a full-resolution mask validation and does not describe
valid coverage within a selected study area. Approximate elevation extrema are
also not full-raster validation results.

### Full-resolution sample scan

A read-only NumPy scan of the original IMG payload used the embedded label's
record offset, dimensions, PC_REAL type, and exact missing-value bit pattern.
The file length matched the declared raster layout.

- Total samples: 75,703,620.
- Exact missing-constant samples: 19,402,393.
- Nonfinite samples: 0.
- Finite, non-missing samples: 56,301,227 (74.37058756239134%).
- Observed non-missing extrema: -4500.73095703125 to -3493.104248046875 m.
- One non-missing sample falls slightly below the label's rounded minimum
  (-4500.73 m). This was counted separately, not silently discarded; the
  0.000957 m difference may reflect label rounding and is not proof of an error.

These counts establish missing-value coverage only, not terrain accuracy,
traversability, or valid coverage in a chosen study area.

Developer B also reported valid-looking elevation values around -4000 m at
two interior QGIS identify locations and no identify result outside the raster.
This spot check is consistent with the display, but does not locate Pahrump Hills.

Official location/context references to investigate next:

- https://www.jpl.nasa.gov/images/pia19039-mars-rover-curiositys-walkabout-at-pahrump-hills/
- https://www.jpl.nasa.gov/images/pia21709-key-locations-studied-at-pahrump-hills-on-mars/

Annotated context images are not yet a verified numeric coordinate anchor.

## Original validation sequence

Candidate selection and missing-value counts have since been added in the
[AOI report](terrain/README.md). The sequence below records the validation plan;
georeferencing resolution and aligned derivative production remain outstanding.

1. Inspect the full DEM visually with its existing NoData handling; identify
   missing coverage without modifying the original raster.
2. Locate Pahrump Hills using a cited mission location reference. Do not use the
   raster centre or observation centre as a substitute for the target location.
3. Inspect full-resolution DEM validity around the target and compare imagery
   features against terrain relief. Visual agreement is a diagnostic, not an
   absolute geolocation accuracy certification.
4. Resolve and document the working georeferencing convention before producing
   aligned derivatives. Do not resample merely to hide the metadata discrepancy.
5. Select and validate approximately 1 km x 1 km coverage, then crop aligned
   derivatives while preserving originals and validity masks.
6. Agree on the output coordinate/data contract with Developer Y before frontend
   integration; slope generation and optional hillshade follow validated inputs.

No scientific targets, mineral/thermal products, slope rasters, cropped assets,
or frontend dataset integrations have been validated by this inspection.

## Interpretation of displayed context

Routes have no validated hazard, thermal or astronaut safety model. The shortest
route uses distance and terrain coverage; the slope-aware alternative additionally
uses the selected slope limit and penalty. Neither certifies traversal safety.

Mineral findings describe published samples at associated locations, not a
continuous mineral-distribution map. Drill markers use associated rover positions
rather than exact drill-hole coordinates; positional uncertainty is unknown.

The Curiosity traverse is historical context, spatially clipped to the terrain.
It is neither time-filtered to the Pahrump campaign nor a suggested EVA route.
Concise layer descriptions identify these records in the interface; the full
qualifications also remain in dataset metadata and exported reports.

The fixed planetary locator uses [NASA/JPL Viking global imagery](https://space.jpl.nasa.gov/tmaps/mars.html),
credited Caltech/JPL/USGS. [Locator preparation and nominal position](../public/data/locator/README.md)
are independent of the terrain package; it is display context only.

The [oxygen budget source review](eva/oxygen-budget.md) records NASA BVAD Rev2
Mars closed-loop consumption, the historical EMU primary-capacity reference,
the project reserve allowance, equations and limits of the 2D reach visualization.
