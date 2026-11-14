# Gale / Pahrump Hills: candidate terrain validation

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
These are not integrated into the application yet. See the v1 package README
for processing methods and Developer Y handoff instructions.

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
