# Developer B review of Developer Y's proposed science-target contract

Status: historical review of the supplied proposal summary. The agreed
[point contract](../science-target-contract.md) and runtime collection at
`public/data/science/pahrump-hills-v1/` are now integrated. The historical
traverse is delivered separately through [display context](../display-context-contract.md).
The source/frame reasoning below remains applicable; future-tense handoff notes
record the original review, not outstanding implementation work.

## 1. Position sources and frame

`MSL_waypoints.json` from NASA's public Curiosity MMGIS map supplies rover poses,
not drill-hole points or every observed rock's location. Its properties include
RMC (site/drive), sol, longitude, latitude, easting and northing. The downloaded
JSON has no formal CRS member or stated uncertainty. Do not infer Earth WGS84
from its GeoJSON-like representation.

For the three drill-associated poses, NASA's August 2020 PAC presentation,
slide 5, joins named activities to site/drive IDs:

| Target | Drill sol | RMC | Position record sol |
| --- | --- | --- | --- |
| Confidence Hills | 759 | 42_1020 | 753 |
| Mojave 2 | 882 | 45_0 | 864 |
| Telegraph Peak | 908 | 45_450 | 903 |

The chart says Mojave; NASA/JPL's Pahrump Hills description identifies the
sample as Mojave 2. Join by site/drive, not by choosing a nearby sol. The runtime
target's `sol` should describe the sourced activity (759/882/908); preserve the
position-record sol separately in provenance.

Detailed source hashes, coordinate values, package cells, and conversion are
recorded in `science-positions-provenance.json`. They are expressed in the
package's source Mars CRS, not the frontend local frame. The prototype converts
using R=3396190 m, central meridian 137.39 E, standard parallel 0:

```text
x = R * radians(lonEast - 137.39)
y = R * radians(lat)
```

This interpretation agrees numerically with the source easting/northing
properties, but does not independently certify latitude type or the datum tie.
The package's documented working-origin uncertainty remains. Do not translate
these world-coordinate vectors by the 1.5-pixel raster interpretation difference.
Convert to cells using the actual package geotransform.

`uncertaintyMeters: null` is appropriate: no source-stated uncertainty exists.
Do not put zero, the raster resolution, or the 1.5-pixel difference in that field.

**Required presentation rule:** these are associated rover-position proxies,
not exact hole coordinates. Either represent position role explicitly in the
joint contract or require that limitation in each target's label/description
and provenance. A `drill-site` kind alone must not imply exact positioning.
General observation-site positions still need observation-specific sources;
final drive stops alone do not establish which target was observed there.

## 2. Kinds

The proposed kinds fit a general activity/context vocabulary. They do not
establish that we have records for every kind:

| Proposed kind | Source-supported use |
| --- | --- |
| drill-site | Three sourced activities; positions currently rover-pose proxies |
| observation-site | Only when a source identifies the observation and its position semantics; not every waypoint |
| landing-site | Valid category for a separately sourced landing position; not present in this Pahrump Hills delivery |
| traverse-point | Source-backed final-drive waypoints, clearly distinguished from scientific targets |
| landmark | Only with a source-backed name and position; no invented geology or scientific value |

For initial runtime delivery, prioritize the three drill-associated records.
Kind, instrument/analysis, and coordinate role are different concepts; avoid
encoding all three into a single `kind`. Do not attach unsourced analysis results.

## 3. File location and hashes

Recommend a separate optional collection directory:

```text
public/data/science/pahrump-hills-v1/
  targets.json
  provenance.json
```

Use `terrainPackageId: "pahrump-hills-v1"` and bind provenance to the exact terrain
manifest hash. Update 2026-11-15: this collection has now been exported and
registered on Developer B's branch using the agreed science contract v1.
Do not edit the existing terrain manifest/provenance to add the overlay.
The recorded terrain output hashes can remain unchanged. Store a reviewed
overlay URL separately through coordination in the registry or optional loader.
The existing terrain hashes cover specified files, not a recursive directory
digest; a separate folder is recommended for independent lifecycle/versioning,
not because merely adding a file necessarily invalidates existing hashes.

## 4. Traverse

Keep the line out of point-contract v1. Initial science markers do not require
it. If wanted later, use a separately versioned line/context overlay, not a
fake target point or a calculated EVA route.

NASA's `MSL_traverse.json` supplies actual line geometry. The downloaded snapshot
has no per-feature sol field, so spatial clipping does not certify a
753-923-only campaign trace. Preserve the exact source hash and label it as a
historical spatial subset. Do not manufacture timing from geometry alone.

## Sources

- https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json
- https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json
- https://science.nasa.gov/mission/msl-curiosity/location-map/
- https://assets.science.nasa.gov/content/dam/science/cds/researchers/nac/pac/2020/06-Meyer-PAC-Mars_Science_8-2020_v9_Tagged.pdf
- https://www.jpl.nasa.gov/images/pia21709-key-locations-studied-at-pahrump-hills-on-mars/
