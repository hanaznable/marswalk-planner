# Science Target Contract (v1)

**Status:** Agreed conventions between Developer B (data) and Developer Y
(frontend). Code: `src/features/datasets/scienceTargets.ts` (jointly owned
`datasets/` folder). Coordinate breaking schema changes.

Covers SCOPE.md MVP criterion 5: sourced historical mission locations and
science targets, shown only within the loaded terrain's coverage, never invented.

## Decisions (Developer B)

| Topic | Decision |
|---|---|
| What the positions are | For the first delivery: **rover-position proxies** associated with three drill activities, **not** exact drill-hole coordinates. |
| Position source | Rover positions from NASA's `MSL_waypoints.json`. Targets matched to waypoints by site/drive using NASA's August 2020 PAC presentation (slide 5): Confidence Hills `42_1020`, Mojave 2 `45_0`, Telegraph Peak `45_450`. The [NASA/JPL PIA21709 description](https://www.jpl.nasa.gov/images/pia21709-key-locations-studied-at-pahrump-hills-on-mars/) confirms the activities but gives no hole coordinates. |
| Frame conversion | `R = 3396190 m`, `x = R × radians(longitudeEast − 137.39)`, `y = R × radians(latitude)`. The source JSON declares no CRS or datum; this reading matches its easting/northing properties numerically, but absolute alignment is unverified. **No 1.5-pixel origin shift** is applied to vector coordinates. |
| Uncertainty | `uncertaintyMeters` stays `null`: the sources state none. |
| Sols | Activity sol and position-record sol are kept separately. |
| Location | Separate collection: `public/data/science/pahrump-hills-v1/targets.json` plus `provenance.json`. The terrain package files stay unchanged. |
| Traverse | **Not part of the point contract v1.** Implemented separately in the [display context](display-context-contract.md) collection. The downloaded traverse has no per-feature sol, so its spatial subset is not a time-filtered campaign route. |

## Shape

```json
{
  "contractVersion": 1,
  "id": "pahrump-hills-targets-v1",
  "terrainPackageId": "pahrump-hills-v1",
  "terrainManifestSha256": "<sha256 of the terrain manifest.json>",
  "synthetic": false,
  "targets": [
    {
      "id": "<unique id>",
      "name": "<target name used by the sources>",
      "kind": "drill-site",
      "position": {
        "x": 0,
        "y": 0,
        "uncertaintyMeters": null,
        "basis": "rover-position-proxy"
      },
      "mission": "MSL Curiosity",
      "activitySol": null,
      "positionSol": null,
      "description": "<what the sources say; for a proxy, say it is not the hole location>",
      "sources": [
        { "url": "<waypoints source>", "attribution": "NASA/JPL-Caltech", "provides": "rover position" },
        { "url": "<presentation>", "attribution": "NASA", "provides": "target association" }
      ]
    }
  ]
}
```

All values above are placeholders, not real data.

## Field rules

| Field | Rule |
|---|---|
| `terrainPackageId` | Must match the terrain manifest `id`; targets prepared for another package are refused. |
| `terrainManifestSha256` | SHA-256 of that package's `manifest.json` (64 hex characters), recording the exact terrain version the positions were prepared against. |
| `position.x`, `.y` | Metres in the terrain package's source CRS (conversion above). |
| `position.basis` | Required. `rover-position-proxy` (where the rover was recorded around the activity) or `target-location` (the target itself). A `drill-site` with a proxy basis never implies an exact hole location; the UI always shows the proxy caveat (`describePosition`). |
| `position.uncertaintyMeters` | Stated by a source, or `null`. Never estimated. |
| `activitySol`, `positionSol` | Separate, non-negative integers or `null`. |
| `description` | Only what the sources say. |
| `sources` | At least one for real data, each with `url`, `attribution` and what it `provides`. Empty for synthetic fixtures. |
| `id` | Unique within the file. |

### Kinds and the evidence each needs

| Kind | Allowed when |
|---|---|
| `drill-site` | A sourced drill activity. In the first delivery, only as rover-position proxies. |
| `observation-site` | There is observation-specific evidence; a waypoint alone is not enough. |
| `landing-site` | A sourced landing location (none in the first delivery). |
| `traverse-point` | A sourced rover waypoint. |
| `landmark` | A sourced name and position. |

## Coverage

`splitByCoverage` places each target on the routing grid. Targets on a covered
cell are shown and can be added as waypoints. Targets outside the terrain or on a
no-data cell are **not shown as part of the region**; they are listed separately
as "outside this terrain". Next to every target the UI shows its position caveat,
and that the terrain's absolute geolocation is unverified.

## Delivering a collection

1. Add `targets.json` (and `provenance.json`) under
   `public/data/science/pahrump-hills-v1/`.
2. Set `scienceTargetsUrl: 'data/science/pahrump-hills-v1/targets.json'` on the
   package's entry in `src/features/datasets/registry.ts`.

The app then loads and validates the file when that terrain is loaded. A file that
breaks the contract or names another terrain package is reported as an error, and
no targets are shown. Until then, real terrain shows no targets. The synthetic
development region uses made-up targets
(`src/features/science/fixtures/syntheticTargets.ts`) labelled as not NASA data.

`terrainManifestSha256` is recorded but not yet checked in the browser. Git
line-ending conversion can change the served manifest's bytes, so a hash check
needs `manifest.json` pinned to LF first.
