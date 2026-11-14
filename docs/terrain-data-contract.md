# Terrain Data Contract (v1)

**Status:** Agreed conventions between Developer B (data pipeline) and Developer Y
(frontend). The final raster metadata is not verified yet; the values below are
implementation targets, not claims about processed datasets. The shared code in
`src/features/datasets/` is jointly owned: coordinate breaking schema changes.
Code: `src/features/datasets/terrainContract.ts`.

This contract defines how processed terrain data gets from the Python pipeline
(`scripts/`) to the frontend. It fixes formats and conventions, not values: no
coordinates, raster sizes, or elevations are assumed.

## Decisions (Developer B)

| Topic | Decision |
|---|---|
| CRS | The candidate HiRISE DTM uses an equirectangular Mars projection (exact parameters to be confirmed in QGIS/GDAL). The original CRS and transform are preserved in the manifest; the frontend works in local metres derived from the raster. No Earth EPSG:4326 coordinates. |
| Resolution | Source DTM ~1.01 m/pixel. Routing grid target: **5 m/cell, about 200 × 200 cells** for the ~1 × 1 km area. The full-resolution DEM is kept for later use. |
| Slope | Computed by the pipeline in degrees (Python/Rasterio/NumPy). **Required layer**; the frontend does not derive slope. |
| Hazard | No validated hazard dataset. **Not part of v1.** Routing uses distance, slope and no-data handling only. Slope limits are planning assumptions, not certified safety thresholds. |
| Basemap | JPEG, at most about 2048 × 2048 px, same footprint as the routing grid, with its own pixel-to-map transform. |
| Ownership | `src/features/datasets/` is jointly owned by B and Y. |

## What the pipeline delivers

One folder per terrain package, for example `public/data/gale/<package-id>/`:

```text
manifest.json   Metadata (below)
elevation.f32   Required. Elevation in metres
slope.f32       Required. Slope in degrees
basemap.jpg     Optional. Orthoimage with the same footprint
```

## Raster rules

Elevation and slope share one grid.

| Topic | Rule |
|---|---|
| Dimensions | Any `width` × `height`; given in the manifest, never assumed |
| Orientation | Row-major, row 0 is the **north** edge, column 0 the **west** edge |
| Resolution | Square cells in metres, from the geotransform |
| Encoding | Little-endian Float32, no header, `width × height × 4` bytes |
| NoData | `NaN`. Convert the source sentinel (e.g. HiRISE `-3.4028227e+38`) to NaN in preprocessing |
| Coverage | Cells without DEM coverage are NaN. The frontend treats them as impassable and never as safe |
| CRS | The source Mars CRS (projected, metres); the full WKT goes in the manifest |
| Pixel → map | GDAL geotransform: `x = x0 + (col + 0.5) * dx`, `y = y0 + (row + 0.5) * dy` for cell centres |

The geotransform must be north-up with no rotation (`rx = ry = 0`, `dx > 0`,
`dy < 0`) and square cells (`|dx| = |dy|`). The frontend rejects packages that break this.

**Frontend frame:** the map uses local metres east and north of the raster's
south-west corner (`toLocalMetres` / `fromLocalMetres`). This keeps map numbers
small; the source CRS coordinates are always recoverable from the manifest.

**Basemap alignment:** the basemap carries its own `width`, `height` and
`geoTransform` (any pixel size, north-up). Its footprint must match the raster
extent to within half a basemap pixel, or the package is rejected.

## manifest.json

```json
{
  "contractVersion": 1,
  "id": "gale-pahrump-v1",
  "title": "Pahrump Hills, Gale Crater",
  "synthetic": false,
  "source": {
    "productId": "DTEEC_040770_1755_039280_1755_A01",
    "url": "https://www.uahirise.org/dtm/dtm.php?ID=ESP_040770_1755",
    "attribution": "NASA/JPL/University of Arizona"
  },
  "crs": { "name": "<from gdalinfo>", "wkt": "<full WKT from gdalinfo>" },
  "raster": { "width": 0, "height": 0, "geoTransform": [0, 0, 0, 0, 0, 0] },
  "layers": {
    "elevation": { "url": "elevation.f32", "dataType": "float32" },
    "slope": { "url": "slope.f32", "dataType": "float32" }
  },
  "basemap": {
    "url": "basemap.jpg",
    "width": 0,
    "height": 0,
    "geoTransform": [0, 0, 0, 0, 0, 0]
  }
}
```

The values above are placeholders, not real data. Each `geoTransform` is exactly
what GDAL's `GetGeoTransform()` returns. Development fixtures set
`"synthetic": true` and `"source": null`; the UI labels them as synthetic and
never presents them as NASA data.

## How the frontend uses it

- `parseTerrainManifest` validates the manifest and lists every problem at once,
  so pipeline mistakes show up clearly.
- Leaflet (`CRS.Simple`) displays the package in local metres. Over a ~1 km area
  this needs no projection library.
- Clicks become grid cells with `mapToCell`; routes are drawn with `cellCenterToMap`.
