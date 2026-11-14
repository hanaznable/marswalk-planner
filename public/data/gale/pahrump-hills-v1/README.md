# Pahrump Hills — real terrain package, contract v1

This is the current Developer B delivery for Developer Y integration. It uses
the existing `TerrainManifest` contract without shared-code/schema changes.
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

## Frontend handoff

With Vite running at its default base URL, the manifest is served at:
`/data/gale/pahrump-hills-v1/manifest.json`.

Developer Y should:

1. Fetch and validate the JSON using existing `parseTerrainManifest`.
2. Resolve each asset URL relative to the manifest URL; fetch the binary layers
   and decode with `decodeRaster(buffer, manifest.raster)`.
3. Build `createTerrainPackage(manifest, { elevation, slope })` and replace the
   synthetic fixture through a loader with explicit loading/error handling.
4. Display `basemap.jpg` using its actual extent/local-metre mapping. Current
   `MapCanvas` draws elevation grayscale and does not yet render this basemap.
5. Pass the package into the existing waypoint/routing hooks. Expose real-data
   attribution and prototype accuracy/terrain-model caveats in the interface.

Do not re-derive slope in the browser or assume the basemap has the same pixel
dimensions as the routing grid. Its footprint is the same; its resolution differs.
Do not interpret Mars projected coordinates as Earth EPSG:4326.

The package was tested against the unchanged TypeScript parser, decoder,
coordinate helpers, routing adapter and round-trip planner. This does not verify
browser integration: `App.tsx` still selects the synthetic fixture. No frontend
components were modified by the data export task.
