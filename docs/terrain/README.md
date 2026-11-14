# Pahrump Hills: source-based candidate study area

This folder records the source-based study-area selection and earlier image-only
preview. The current **contract-v1 terrain delivery** is documented in
[`public/data/gale/pahrump-hills-v1/README.md`](../../public/data/gale/pahrump-hills-v1/README.md).
It includes real 5 m elevation/slope layers and a same-footprint basemap.
Original rasters, frontend code, and routing algorithms are unchanged.

The next preparation step now uses the region-independent
[terrain planner](../../scripts/terrain/README.md) with a separate region config.
Its [package plan](pahrump-hills-package-plan.json) records the native grid,
source verification, and outstanding review items. The
[contract proposal](package-contract-proposal.md) is historical; the canonical
contract is [`docs/terrain-data-contract.md`](../terrain-data-contract.md).

## Selected square

| Parameter | Value |
| --- | --- |
| Projected width / height | 1000 / 1000 m |
| Projected area | 1,000,000 m2 |
| West / east | -1234.766187 / -234.766187 m |
| South / north | -276902.868138 / -275902.868138 m |
| Centre longitude / latitude | Approximately 137.377604 E, -4.663084 degrees |

Use the unrounded values and explicit Mars WKT in `pahrump-hills-aoi.json` for
calculations. These are projected dimensions, not an exact geodesic area claim.
The WKT is not an Earth EPSG code. The JSON is a custom report, not RFC 7946 GeoJSON.

The centre is the midpoint of the bounding box of the 23 published final-drive
waypoints dated sols 753 through 923, inclusive. This interval brackets the
Pahrump Hills campaign. The selection leaves surrounding terrain for route
planning context; the three drill-associated rover poses are clustered within
roughly 50 m, not distributed across the entire kilometre.

## Scientific basis and position semantics

The [NASA/JPL Pahrump Hills description](https://www.jpl.nasa.gov/images/pia21709-key-locations-studied-at-pahrump-hills-on-mars/)
identifies Confidence Hills, Mojave 2, and Telegraph Peak as drilled sample targets.
This is a Mastcam perspective mosaic, not a georeferenced overhead map, so it
was not digitized to create coordinates.

Slide 5 of the [NASA PAC Mars Science presentation, August 2020](https://assets.science.nasa.gov/content/dam/science/cds/researchers/nac/pac/2020/06-Meyer-PAC-Mars_Science_8-2020_v9_Tagged.pdf)
contains the NASA/JPL-Caltech drill-site chart used for these associations:

| Scientific target | Drill sol | Site / drive | Published waypoint sol |
| --- | --- | --- | --- |
| Confidence Hills | 759 | 42 / 1020 | 753 |
| Mojave 2 (chart label: Mojave) | 882 | 45 / 0 | 864 |
| Telegraph Peak | 908 | 45 / 450 | 903 |

These associations were checked visually in the chart image embedded in the
downloaded PDF. Site/drive identifiers, rather than nearest-date interpolation,
join the chart to the official NASA waypoint records. **The resulting coordinates
are rover-pose proxies associated with the targets, not surveyed drill holes.**
The drill sol and waypoint sol are deliberately kept separate.

The [official NASA Curiosity map](https://science.nasa.gov/mission/msl-curiosity/location-map/)
provides context. Downloaded source files:

- [MSL_waypoints.json](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json)
- [MSL_traverse.json](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json)

The trace uses the actual published traverse geometry clipped spatially to the
square, not lines interpolated between final-drive waypoints. Its source does
not supply sol fields, so the trace is **not temporally filtered** to sols
753-923 and may include other visits. It is a historical reference, not an EVA
route or evidence that an astronaut can safely traverse it.

Geographic coordinates are converted using the DEM label's sphere and projection:
`x = 3396190 * radians(longitude - 137.39)`,
`y = 3396190 * radians(latitude)`.
For campaign waypoints, the implied zero-meridian easting/northing agree with
the source's projected properties within 0.003 m. This checks numerical
consistency, not absolute geolocation accuracy.

## Coverage checks and open issues

The original DEM payload was read without interpolation. Every raster cell
touching the candidate square was checked using both observed origin conventions:

- GDAL PDS origin: 979,110 cells; no missing-constant or nonfinite samples.
- University of Arizona PDS_JP2 origin candidate: 978,121 cells; likewise no missing samples.
- Observed elevation extrema for both windows: about -4466.49 to -4401.68 m.

Both ortho windows have no label-defined null pixels (`CORE_NULL=0`). The
`ESP_039280` window has no pixels with saturation codes 1 or 255. The `ESP_040770`
window has 16 pixels with code 1 and none with code 255. Therefore the preview
uses `ESP_039280_1755_RED_C_02_ORTHO`; this is a local image-quality preference,
not an accuracy ranking for the entire product.

The DEM/JP2 1.5-pixel interpretation discrepancy is documented. The prototype
uses the UA/JP2 convention B for consistency with the source labels and official
JP2 metadata. Developer B's A/B comparison was visually inconclusive; it did not
prove B more accurate. See [decision and limitations](georeferencing-review.md).
Checking both windows establishes missing-data coverage, not accurate physical
registration. Absolute rover localization and image/DEM registration accuracy
are not certified. See [validation notes](../data-sources.md).

## Artifacts and reproduction

- `pahrump-hills-aoi.json`: candidate bounds, WKT, source hashes, source URLs,
  campaign waypoints, target associations, clipped traverse, and coverage checks.
- `pahrump-hills-aoi-preview.png`: actual ortho imagery with AOI and reference
  overlays; right panel enlarges the compact science campaign area.

Original NASA rasters, matching labels, downloaded waypoint/traverse JSON, and
the reference PDF remain under ignored `data/raw/pahrump-hills/`. Source snapshot
hashes in the report make upstream changes detectable. No large originals are
added to Git. They must be present locally to regenerate the report:

```text
python scripts/terrain/select_pahrump_aoi.py
```

The selection script requires NumPy; optional image checks and PNG output use
Pillow and Matplotlib. No shared project dependencies were changed. Source
downloads are explicit inputs; the script makes no network requests.

For an interactive QGIS preview, keep at least one source raster from the local
project folder loaded, then execute this single line in the QGIS Python console:

```python
exec(open("C:/Users/Batuhan/marswalk-planner/scripts/terrain/preview_pahrump_aoi_qgis.py", encoding="utf-8").read())
```

This adds temporary Mars-CRS vector layers with source-role labels and zooms to
the candidate square. It preserves the project CRS and source raster files.
Re-running replaces only layers previously created by the helper. QGIS runtime
execution must be verified in QGIS; the helper is syntax-checked locally.

The QGIS area and A/B hillshade review have been performed. The selected working
convention and unverified accuracy are carried into the real v1 package's
provenance. Numeric terrain derivatives have now been prepared and checked
against the existing frontend contract and routing adapter. Developer Y has
integrated the package loader and basemap into the UI.

## Science target delivery (2026-11-15)

The agreed science contract v1 now has a real collection under
`public/data/science/pahrump-hills-v1/`, registered in the dataset registry.
Confidence Hills, Mojave 2 and Telegraph Peak are drill-associated rover-position
proxies, not exact hole coordinates. The separate provenance records the source
snapshot hashes, site/drive joins, coordinate conversion and terrain manifest hash.
The original terrain files and hashes are unchanged.

Rebuild the science files with `python scripts/terrain/export_science_targets.py`.
This uses the committed reviewed position artifact, accepts explicit review,
terrain and output paths for other packages, and checks the terrain version,
recomputed positions and coverage. It does not discover or validate new science
associations automatically. See the science folder's README for handoff details.

## Local layer comparison

Run `npm run dev` and open `/layer-lab.html` for Developer B's independent
comparison page. After user review, six selected overlays are also available on
the main planner, alongside grayscale imagery. Hillshade, roughness, coverage and
recorded-position display layers have been removed. Enhanced RGB is now an
optional registered prototype basemap; its partial-color coverage and relative
alignment are documented in [surface-color-review.md](surface-color-review.md).
Four further candidates show
their missing-data/processing status. Display choices do not change route inputs. See
[Layer Lab instructions](layer-lab.md) for layer definitions and feedback export.
