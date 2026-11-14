# Terrain Data Contract (v1) — Proposal

**Status:** Proposal from Developer Y for review by Developer B. Nothing here is final
until both agree. Code: `src/features/datasets/terrainContract.ts`.

This contract defines how processed terrain data gets from the Python pipeline
(`scripts/`) to the frontend. It fixes formats and conventions, not values: no
coordinates, raster sizes, or elevations are assumed.

## What the pipeline delivers

One folder per terrain package, for example `public/data/gale/<package-id>/`:

```text
manifest.json     Metadata (below)
elevation.f32     Required. Elevation in metres
slope.f32         Optional. Slope in degrees (frontend derives it if missing)
hazard.u8         Optional. 1 = known hazard, 0 = none
basemap.png|jpg   Optional. Orthoimage covering exactly the raster extent
```

## Raster rules

All raster layers in a package share one grid.

| Topic | Rule |
|---|---|
| Dimensions | Any `width` × `height`; given in the manifest, never assumed |
| Orientation | Row-major, row 0 is the **north** edge, column 0 the **west** edge |
| Resolution | Square cells in metres, from the geotransform |
| Encoding | `.f32` = little-endian Float32, `.u8` = one byte per cell, no header |
| NoData | `NaN` in float layers. Convert the source sentinel (e.g. HiRISE `-3.4028227e+38`) to NaN during preprocessing |
| Coverage | Cells without DEM coverage are NaN. The frontend treats them as impassable and never as safe |
| CRS | A projected Mars CRS in metres; the full WKT goes in the manifest |
| Pixel → map | GDAL geotransform: `x = x0 + (col + 0.5) * dx`, `y = y0 + (row + 0.5) * dy` for cell centres |
| Basemap alignment | Cropped and resampled to exactly the raster extent; any pixel size is fine |

The geotransform must be north-up with no rotation (`rx = ry = 0`, `dx > 0`,
`dy < 0`) and square cells (`|dx| = |dy|`). The frontend rejects packages that break this.

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
    "slope": { "url": "slope.f32", "dataType": "float32" },
    "hazard": { "url": "hazard.u8", "dataType": "uint8" }
  },
  "basemap": { "url": "basemap.jpg" }
}
```

The values above are placeholders, not real data. `geoTransform` is exactly what
GDAL's `GetGeoTransform()` returns. Development fixtures set `"synthetic": true`
and `"source": null`; the UI labels them as synthetic and never presents them as
NASA data.

## How the frontend uses it

- Leaflet displays the package in its own projected metres (`CRS.Simple` with map
  y/x in metres). Over a ~1 km area this needs no projection library.
- Clicks become grid cells with `mapToCell`; routes are drawn with `cellCenterToMap`.
- `parseTerrainManifest` validates the manifest and lists every problem at once,
  so pipeline mistakes show up clearly.

## Open questions for Developer B

1. Which CRS does the processed DTM use (the HiRISE product's native one)?
2. What is the DTM cell size, and do you prefer to deliver slope or let the frontend derive it?
3. Is there a hazard source, or should `hazard` stay out of v1?
4. Should the basemap be PNG or JPEG, and at what pixel size?
5. Where should the shared contract code live? It is in `src/features/datasets/` for now.
