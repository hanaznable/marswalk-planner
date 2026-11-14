# Terrain preparation tools — Developer B

The CLI exporters need Python 3.11+; source files remain outside Git under
`data/raw`. To install the recorded export dependencies in a local environment:

```text
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r scripts/terrain/requirements.txt
```

On Windows the following commands can use `.venv/Scripts/python.exe` instead of
`python`. QGIS helpers run in QGIS's separate Python/GDAL environment.

## Current contract-v1 delivery

The canonical frontend contract is `docs/terrain-data-contract.md`. The earlier
proposal under `docs/terrain/package-contract-proposal.md` is historical only.
The current real package is `public/data/gale/pahrump-hills-v1/`; the older
`pahrump-hills/` PNG package is an image-only research preview, not a runtime API.

```text
python scripts/terrain/export_terrain_v1.py --config scripts/terrain/regions/pahrump-hills.json --output-dir public/data/gale/pahrump-hills-v1 --cell-size 5
```

`terrain_resampling.py` contains region-independent Horn slopes, interval overlap
weights and conservative aggregation. `export_terrain_v1.py` produces the
existing v1 manifest, little-endian Float32 elevation/slope, matching-footprint
JPEG, and provenance. Source extent and target cell size are parameters; supported
input formats/projections remain limited to the explicit PDS adapter below.

Elevation is an area-weighted native-pixel mean; slope is maximum native Horn
slope over each routing cell, not slope of the coarse averaged DEM. Unknown
contributors become NaN; a real source halo prevents invented edge gradients.
The image is resampled to precisely match the output extent. Read the package
README and provenance for limitations and Developer Y integration instructions.
No shared schema or frontend files were changed.

## Region-independent preparation step

`terrain_config.py` validates region configurations and plans complete native
grid windows. `plan_terrain_package.py` checks the selected local source hashes,
PDS label compatibility, coordinate conventions, and full-resolution DEM
missing-value coverage. This step writes a **review plan**, not frontend assets.

```text
python scripts/terrain/plan_terrain_package.py --config scripts/terrain/regions/pahrump-hills.json
python -m unittest discover -s scripts/terrain -p "test_*.py"
```

The planner needs NumPy, already used by the source validation tools. It does
not need QGIS, does not download data, and does not modify source rasters.

To prepare another region, create another configuration under `regions/` with
its own source paths, checksums, attribution, AOI, and explicit georeferencing
review. No Curiosity waypoints, campaign sols, geographic centre, or fixed 1 km
extent is required by the general planner. It never fetches a default Earth map.

The first input adapter supports a limited, validated subset of HiRISE PDS3:
single-band little-endian Float32, square north-up metre pixels, spherical
Equirectangular with zero standard parallel, and a matching ortho label. It
rejects unsupported input rather than silently guessing. Future GeoTIFF or
other projection support should use explicit adapters. This is not yet a
global, tiled terrain service or a large-region routing solution.

## Current package status

The Pahrump Hills config uses the UA PDS_JP2 origin interpretation as a
**prototype working convention** because it reproduces the official JP2 origin
from the matching labels. The A/B review found no obvious large mismatch but
did not distinguish the interpretations reliably. The decision is documented
in `docs/terrain/georeferencing-review.md`; physical registration accuracy
and absolute geolocation remain unverified.

The planner retains both the requested 1000 m square and the complete native
pixel window covering it. That window is 989 x 989 at about 1.011757 m/pixel and
is slightly larger than 1000 m on each side. No resampling to an artificial
1 m resolution is performed. All positions refer to upper-left pixel corners;
centres are offset by half a cell. Rows increase southwards, columns eastwards.

The plan still has `frontend_ready: false` because the frontend contract requires
coordination with Developer Y. A separate, explicitly provisional image preview
can now be exported using the documented origin decision:

```text
python scripts/terrain/export_map_preview.py --config scripts/terrain/regions/pahrump-hills.json --output-dir public/data/gale/pahrump-hills
```

`export_map_preview.py` requires NumPy and Pillow. It verifies source hashes,
rejects a pending origin review, preserves decoded source image pixels without
resampling, applies the label's null code as alpha, and writes PNG plus a
manifest with full Mars grid metadata, provenance, and accuracy limitations.
This exporter supports the matching-label UA/JP2 working grid only; other origin
policies require an explicit imagery mapping adapter. No elevation, slope,
hazard, or route asset is exported. The proposed manifest is not an agreed
runtime TypeScript API. Coordinate integration before changing shared types.

## Existing region-specific research helpers

- `inspect_qgis_rasters.py`: read-only GDAL/JP2 reader comparison inside QGIS.
- `select_pahrump_aoi.py`: source-based Pahrump Hills campaign/target AOI study.
  This research helper deliberately retains its region-specific selection rule;
  it is not the general package pipeline.
- `preview_pahrump_aoi_qgis.py`: temporary, labeled QGIS overlay for that study.
- `preview_hillshade_qgis.py`: config-driven QGIS diagnostic. Creates two
  hillshades from identical DEM samples with alternative origins, writes only
  under ignored `data/raw/.../validation-preview`, and adds a mutually exclusive
  A/B group at 50% opacity. Uses a two-pixel halo, Horn shading, metre scaling,
  no vertical exaggeration, and no resampling. Lighting (315/45 degrees) is for
  visualization, not a claim about the Sun at image acquisition. It does not
  approve alignment or change the region configuration. Requires QGIS GDAL
  bindings and must be runtime-checked there; only syntax is checked locally.

See `docs/terrain/README.md` for source downloads and the candidate study area.
