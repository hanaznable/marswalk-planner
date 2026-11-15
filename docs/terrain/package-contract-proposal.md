# Terrain package contract — proposal for coordination

Status: historical Developer B proposal, superseded by the existing
[`docs/terrain-data-contract.md`](../terrain-data-contract.md). Do not implement
a second schema from this document. The real v1 package is now under
`public/data/gale/pahrump-hills-v1` and is integrated in the 2D/3D planner.
The proposed fields below remain historical and must not replace the live schema.

## Separation

Region configuration selects sources and bounds. A source adapter reads actual
formats and CRS metadata. Reusable processing prepares a common raster grid.
A package describes that grid and its assets. Frontend code consumes package
metadata instead of assuming a region name, extent, resolution, or origin.

The source-based Pahrump Hills AOI study is separate from this pipeline. Its
Curiosity observations are optional scientific/context layers, never a required
dependency of terrain processing or pathfinding.

## Proposed package fields

| Field | Meaning |
| --- | --- |
| schema version, id, body | Versioned identity; Mars explicitly identified |
| CRS WKT and units | Native projected coordinate reference; never inferred from a display name |
| bounds and upper-left origin | Actual exported grid footprint; requested AOI recorded separately |
| rows, columns, cell size | Native or explicitly resampled dimensions and metric spacing |
| row/column directions, pixel reference | Array-to-map conversion without hidden offsets |
| image asset | Display image plus its footprint, null handling, attribution |
| elevation asset | Numeric values, data type, vertical units/reference, scale/offset |
| slope asset | Degrees, derivation method, resolution and edge/NoData treatment |
| validity mask | Missing/invalid inputs kept explicit; no zero-filled unknown terrain |
| provenance | Source URLs, product IDs, hashes, processing settings and review notes |
| optional layers | Scientific locations, historical traverse, thermal/mineral data if integrated |
| processing/validation status | Candidate inputs must not masquerade as validated runtime assets |

For a north-up square grid, projected cell centres are:

```text
x = originX + (col + 0.5) * cellSize
y = originY - (row + 0.5) * cellSize
index = row * cols + col
```

Origin and footprint bounds refer to pixel edges. Validate coverage before
converting map points to cells; the east and south edges are outside the
half-open grid domain. Do not treat projected Mars coordinates as Earth lat/lon.

## Developer Y integration points to agree

- Display coordinates and image overlay mapping in Leaflet.
- Browser asset format and numeric array representation.
- Conversion to the existing `TerrainGridInput`: `rows`, `cols`,
  `cellSizeMeters`, row-major `slopeDegrees` (`null` for missing data), and any
  independently validated `hazard` array. Do not invent hazards from missing data.
- Maximum grid size and UI performance limits; a native approximately one-million
  cell grid must be profiled before claiming acceptable interactive routing.
- Whether routing uses a separately derived lower-resolution grid. If so, its
  origin, resolution and map conversion must be explicit, and coarsening must
  preserve missing-data and terrain-constraint semantics.

## Expansion

A separate region can be another package without algorithm changes, provided
its input adapter and projected grid are supported. Seamlessly expanding an
existing map additionally needs aligned coverage, tiling/LOD, loading limits,
and routing across package boundaries. Those are future capabilities, not
features already delivered by this contract proposal.
