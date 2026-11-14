# Science Target Contract (v1) — Proposal

**Status:** Proposal from Developer Y for review by Developer B. Nothing here is
final until both agree. Code: `src/features/datasets/scienceTargets.ts`
(jointly owned `datasets/` folder).

Covers SCOPE.md MVP criterion 5: sourced historical mission locations and
science targets, shown only within the loaded terrain's coverage, never invented.

## Shape

One JSON file per terrain package:

```json
{
  "contractVersion": 1,
  "id": "pahrump-hills-targets-v1",
  "terrainPackageId": "pahrump-hills-v1",
  "synthetic": false,
  "targets": [
    {
      "id": "<unique id>",
      "name": "<name used by the source>",
      "kind": "drill-site",
      "position": { "x": 0, "y": 0, "uncertaintyMeters": null },
      "mission": "MSL Curiosity",
      "sol": null,
      "description": "<what the source says was observed or done>",
      "source": { "url": "<official source page>", "attribution": "NASA/JPL-Caltech" }
    }
  ]
}
```

All values above are placeholders, not real data.

| Field | Rule |
|---|---|
| `terrainPackageId` | Must match the terrain manifest `id`. The frontend refuses targets prepared for another package. |
| `kind` | One of `drill-site`, `observation-site`, `landing-site`, `traverse-point`, `landmark`. |
| `position.x`, `position.y` | Metres in the **terrain package's source CRS**, the same frame as its `geoTransform`, using the same working-origin convention (UA PDS_JP2) as the DEM. |
| `position.uncertaintyMeters` | The horizontal uncertainty the source states, or `null` when it states none. Never estimated. |
| `mission`, `sol` | From the source, or `null`. `sol` is a non-negative integer. |
| `description` | What the source says. Analysis results or targets that are not in the source must not be added. |
| `source` | Required with `url` and `attribution` for real data. `null` only when `synthetic: true`. |
| `id` | Unique within the file. |

The frontend lists every problem at once (`parseScienceTargets`), so pipeline
mistakes are easy to fix.

## Coverage

`splitByCoverage` places each target on the routing grid:

- On a covered cell → shown on the map and can be added as a waypoint.
- Outside the terrain, or on a no-data cell → **not shown as part of the region**;
  listed separately as "outside this terrain".

Targets near the edge may move by the stated position uncertainty plus the
unverified absolute geolocation of the terrain package. The UI will show both
caveats next to the target.

## Open questions for Developer B

1. **Source:** which product gives Curiosity drill and observation positions for
   Pahrump Hills, and in which frame (e.g. planetocentric latitude/longitude)?
   The conversion into the package CRS and origin convention should be recorded
   in the targets' provenance, like `provenance.json` for the terrain.
2. **Kinds:** does this list cover what the sources provide, or should a kind be
   added or renamed?
3. **Location:** next to the terrain (`public/data/gale/pahrump-hills-v1/science-targets.json`)
   or in its own folder (`public/data/gale/science-targets/pahrump-hills-v1.json`)
   so the terrain package's recorded hashes stay unchanged?
4. **Traverse:** v1 covers points only. Is the Curiosity traverse line needed in
   v1, or later as its own contract? `traverse-point` covers sampled points
   in the meantime.
