# Pahrump Hills — real terrain package, contract v1

This is the real terrain package integrated into the default 2D/3D planner.
It uses the existing `TerrainManifest` contract.
It is a prototype with unverified absolute geolocation and image/DEM accuracy.

| File | Content |
| --- | --- |
| `manifest.json` | Contract v1 metadata; `synthetic: false`, real source attribution |
| `elevation.f32` | 200 x 200 little-endian Float32 samples, metres, row-major |
| `slope.f32` | Same grid, degrees; conservative maximum native slope per cell |
| `basemap.jpg` | Actual HiRISE grayscale imagery, 989 x 989 pixels, same footprint |
| `provenance.json` | Methods, source/output hashes, quality limits and origin decision |

The grid is exactly 1000 x 1000 projected metres, 5 m square cells, north-up.
Row 0 is north; column 0 is west. The raster origin is a pixel corner, not a
centre. Both numeric layers currently have 40,000 finite samples and no NoData.
The encoding reserves NaN for missing data; no zero substitution is performed.

## Methods and limits

- Elevation: area-weighted mean of the positively overlapping native DEM pixels.
- Slope: Horn 3x3 slope at source resolution using a real one-cell halo, then
  the maximum across native pixels overlapping each 5 m output cell. All stencil
  samples must be valid. Missing contributors propagate as NaN without filling.
- This slope is not the derivative of the averaged 5 m elevation grid. It
  deliberately preserves local steepness, and can conservatively block coarse
  cells even if a finer path exists within part of them. It is not a safety model.
- Basemap: bilinear fractional crop to match the exact routing footprint,
  grayscale JPEG quality 95. Image brightness is not a mineral/thermal measurement.
- Horizontal reference: label-defined spherical Mars Equirectangular CRS. Source
  radii and central meridian are carried in the full WKT. Elevations refer to the
  source label's Mars 2000 equipotential surface.
- Working origin: UA PDS_JP2 convention B, chosen for label/JP2 consistency.
  Visual A/B review was inconclusive. The original PDS reader origin and the
  decision are retained in provenance; no absolute or subpixel accuracy claimed.

Source: https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755
Credit: NASA/JPL-Caltech/UArizona.

## Reproduce

Original source files and labels must be present under ignored
`data/raw/pahrump-hills`. Requires NumPy and Pillow; no new npm dependencies.

```text
python scripts/terrain/export_terrain_v1.py --config scripts/terrain/regions/pahrump-hills.json --output-dir public/data/gale/pahrump-hills-v1 --cell-size 5
python -m unittest discover -s scripts/terrain -p "test_*.py"
npm test
```

## Runtime integration

With Vite running at its default base URL, the manifest is served at:
`/data/gale/pahrump-hills-v1/manifest.json`.

`loadTerrainPackage.ts` validates the manifest, resolves relative URLs, decodes
the binary layers and creates a `TerrainPackage`. `useTerrainSource` selects it
from the region registry with explicit loading/error/retry states. Synthetic
terrain is available only through a separate labelled development selection.

`MapCanvas` displays the actual basemap at its manifest footprint and uses the
package in shared waypoint/routing hooks. The lazy-loaded 3D renderer consumes
the same package and route results. Source and accuracy limitations remain
visible. Additional science/context and RGB assets live in separate packages;
see [the source guide](../../../../docs/data-sources.md).

Do not re-derive slope in the browser or assume the basemap has the same pixel
dimensions as the routing grid. Its footprint is the same; its resolution differs.
Do not interpret Mars projected coordinates as Earth EPSG:4326.

Package/coordinate checks and browser integration are recorded separately in
[the baseline verification](../../../../docs/terrain/premerge-verification-2026-11-15.md).
Those checks do not certify absolute positioning or operational traversal safety.
