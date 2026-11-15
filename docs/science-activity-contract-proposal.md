# Science Activity Contract (v1) — proposal

**Status:** implemented on `feature/science-suggestions`, 2026-11-15. The filename
is retained for existing review links. The independent parser supports historical
follow-ups, orbital imaging areas and optional sampling procedures. Mission v2
adds science snapshots while retaining v1 import. Existing terrain, target and
context contracts are unchanged. See the [implementation guide](science-suggestions-implementation.md).

Builds on the [science target contract](science-target-contract.md), the
[display context contract](display-context-contract.md) and Developer B's
[observation research](terrain/science-expansion-research.md).

## Goal

Let a user plan an EVA around a science question:

1. Choose a **science objective** and the **equipment** available.
2. See **suggested activities** that fit, each showing the **historical or orbital evidence**
   it is based on.
3. Add chosen activities to the route as waypoints.
4. Compare distance, terrain and estimated duration with the existing planner.

## The one rule this contract enforces

Two kinds of content are kept apart everywhere: in the data, the UI and the
mission report.

| | Historical evidence | Suggested activity |
|---|---|---|
| What it is | Something a mission did or found, as its sources state it | Our proposal for what an astronaut could do there |
| Who wrote it | Mission sources (quoted or closely summarised) | This project (Developer B, reviewed) |
| Example | "APXS measured `Pelona_DRT` on sol 805" | "Re-examine the laminated outcrop at Shoemaker with a hand lens and camera" |
| Shown as | Fact with sources | Suggestion, labelled as ours, with its evidence linked |

The app never presents a suggestion as a finding, never invents a finding, and
does not compute a scientific-value score.

## Proposed shape

One file per terrain package, beside the existing targets:
`public/data/science-activities/pahrump-hills-v1/v1/activities.json` with its own
`provenance.json`. Keep this independent of the existing target provenance file;
do not overwrite it. Bind to both the terrain package ID and exact served manifest
SHA-256. The parser must compare the hash, not just record it.

```json
{
  "contractVersion": 1,
  "id": "pahrump-hills-v1-activities-v1",
  "terrainPackageId": "pahrump-hills-v1",
  "terrainManifestSha256": "<sha256 of the terrain manifest.json>",
  "synthetic": false,

  "objectives": [
    {
      "id": "sedimentary-textures",
      "title": "<short title>",
      "description": "<the science question, in plain words>",
      "sources": [{ "url": "<paper or NASA page>", "attribution": "<credit>", "provides": "why this question matters here" }]
    }
  ],

  "equipment": [
    {
      "id": "hand-lens-camera",
      "name": "<name>",
      "description": "<what it is used for, in general terms>",
      "basis": "scenario-assumption",
      "sources": []
    }
  ],

  "evidence": [
    {
      "id": "apxs-pelona",
      "kind": "apxs-measurement",
      "mission": "MSL Curiosity",
      "instrument": "APXS",
      "targetName": "Pelona_DRT",
      "sol": 805,
      "statement": "<what the source says was measured or found; no interpretation>",
      "footprint": { "type": "point", "position": { "x": 0, "y": 0, "uncertaintyMeters": null, "basis": "rover-position-proxy" } },
      "links": { "targetId": null, "apxsRecordId": "<recordId from context.json, if any>" },
      "productIds": ["<archive product or row identifier>"],
      "qualityFlags": [],
      "sources": [{ "url": "<archive or paper>", "attribution": "<credit>", "provides": "measurement" }]
    }
  ],

  "activities": [
    {
      "id": "shoemaker-lamination-revisit",
      "title": "<short, action-shaped title>",
      "category": "historical-follow-up",
      "experiment": "<brief proposed action>",
      "objectiveIds": ["sedimentary-textures"],
      "evidenceIds": ["apxs-pelona"],
      "requiredEquipmentIds": ["hand-lens-camera"],
      "access": { "evidenceId": "apxs-pelona", "point": { "x": 0, "y": 0 }, "selectionBasis": "associated-rover-position", "justification": "<why this is the planning point>" },
      "rationale": "<why we suggest it, linked to the evidence; clearly our suggestion>",
      "limitations": ["<what is unknown: e.g. exact outcrop position, access, safety>"],
      "durationMinutes": null,
      "durationSource": null,
      "review": { "status": "draft", "by": null, "date": null }
    }
  ]
}
```

All values above are placeholders, not proposed content.

## Field rules

### Objectives

| Field | Rule |
|---|---|
| `id` | Unique, stable. Saved missions refer to it. |
| `title`, `description` | Plain language. Describes a question, never an expected answer. |
| `sources` | At least one, showing that the question is relevant at this site. |

### Equipment

| Field | Rule |
|---|---|
| `basis` | `scenario-assumption` (a planning assumption we chose) or `source` (a capability a cited source describes). |
| `description` | What the item is for in general. No performance numbers (detection limits, depth, speed) unless `basis` is `source` and the source states them. |
| `sources` | Required when `basis` is `source`. |

Equipment assumptions belong in expandable details and reports; primary cards
show short equipment names without repeated explanatory banners.

### Evidence

| Field | Rule |
|---|---|
| `kind` | `apxs-measurement`, `chemcam-observation`, `chemin-mineralogy`, `image-observation` (Mastcam/MAHLI), `drill-sample`. `orbital-image-observation`, `orbital-indicator`, `geologic-map-unit`. Orbital entries require a reviewed source product and footprint before delivery. |
| `statement` | What the source says, without interpretation. A mineral is named only when a mineralogy source (for example CheMin) identifies it. APXS chemistry is never turned into a mineral claim. |
| `sol` | The measurement or activity sol stated by the source, or `null`. Kept separate from the rover-position sol, as in the target contract. |
| `footprint` | Point or reviewed area in source-CRS metres, as specified below. Keep spatial basis and uncertainty explicit. |
| `links` | Optional ties to an existing `targets.json` id or a `context.json` APXS `recordId`, so the map can show one marker instead of duplicates. |
| `productIds`, `qualityFlags` | Exact archive identifiers and the source's own quality flags (for example low-quality spectrum, sample handling). |
| `sources` | At least one. |

### Activities

| Field | Rule |
|---|---|
| `objectiveIds`, `evidenceIds`, `requiredEquipmentIds` | Each must refer to an entry in the same file. At least one objective and one evidence entry. |
| `category` | `historical-follow-up` or `orbital-candidate`; must be supported by its referenced evidence. |
| `experiment` | Short proposed action, such as "Photograph rock textures". It is our activity, not a claim that NASA executed it. |
| `access` | Evidence ID, reviewed source-CRS planning point, selection basis and justification. Keep the actual source point separate from the snapped routing-cell centre. |
| `rationale` | Our suggestion and why. Must point to its evidence; must not state new findings. |
| `limitations` | At least one. For example: proxy position, unverified access, no safety assessment. |
| `durationMinutes` | `null` unless a source states a duration for a comparable activity, in which case `durationSource` cites it. When `null`, the planner uses the user's own "time per stop" setting, as now. |
| `review` | Only `reviewed` activities are selectable in the normal UI. Valid `draft` entries are retained for review but hidden; malformed references reject the collection. The exporter emits only reviewed activities into the runtime delivery. |

## What the app will do (Developer Y)

1. **Choose:** the user picks one objective and ticks the equipment available.
2. **List:** the app shows activities whose objective matches and whose required
   equipment is all available, plus a separate list of activities that would
   need equipment the user did not tick. Order: by straight-line or route
   distance from the current start, which the app computes and labels as
   distance only. There is no hidden score.
3. **Inspect:** each activity card shows the suggestion, with rationale and
   evidence available in details (labelled "Historical evidence"
   or "Orbital evidence" as appropriate). Sources, sols, flags and spatial
   limitations live in expandable details. Primary cards show the target, short
   experiment, category, equipment and add-to-route action.
4. **Add to route:** reuses or adds a waypoint at the activity access cell. An
   independent science-plan snapshot associates activity IDs with waypoint orders
   when saved. Existing APXS/mineral `WaypointOrigin` shapes remain unchanged.
5. **Evaluate:** the existing routes, EVA estimate and report are recalculated.
   The mission report gets two separate sections: "Suggested activities (this
   project's proposals)" and "Supporting evidence".
6. **Save:** saved missions record the activity collection id. Opening a mission
   with another activity collection version retains its saved evidence snapshot
   and reports the mismatch; it never silently substitutes another activity.
7. **Validate:** a file that breaks the contract, names another terrain package,
   or contains an unknown reference is refused with the reason, and no activities
   are shown. The synthetic region gets a small made-up fixture labelled "not
   NASA data".

Not planned: automatic scientific ranking, invented durations, safety or
traversability claims, or mineral maps interpolated from point samples.

## Decisions for Developer B

| # | Question | Proposal |
|---|---|---|
| 1 **(B)** | Is one file with objectives, equipment, evidence and activities right, or should evidence live in its own file? | One file per terrain version, so references are checked in one place. |
| 2 **(B)** | First objectives | Two or three, for example sedimentary textures (Shoemaker, Whale Rock), vein chemistry (Garden City) and sample mineralogy (Buckskin). |
| 3 **(B)** | First activities | Three to five reviewed examples from your prioritised list: Pelona (Shoemaker), Punchbowl (Book Cliffs), Pickhandle/Goldstone (Chinle), a Garden City vein target. Buckskin as a separate sample case. |
| 4 **(B)** | Equipment list | A short list, all `scenario-assumption`, unless you find sources that describe astronaut field tools for these tasks. |
| 5 **(B)** | Evidence positions | Keep `rover-position-proxy` for APXS rows, as your research recommends, until a geometry review supports `target-location`. |
| 6 **(B)** | Quality-flagged rows | Exclude them as evidence, or include them only with their flags shown. Proposal: exclude in the first delivery. |
| 7 **(B)** | Durations | All `null` in the first delivery. |
| 8 **(B)** | Review | Who reviews each activity, and what "reviewed" means (sources read, position checked, rationale checked). |
| 9 | Relation to `context.json` | Activities reuse APXS records through `links.apxsRecordId`, so the existing APXS layer and the activity markers stay consistent. |
| 10 | Mission files | Use explicit mission format v2 when activities are added; continue reading v1 missions. Preserve `marswalk-mission` as the format identifier. See compatibility rules below. |

## Delivery steps, once agreed

1. Developer B: exporter (or a reviewed hand-edited file plus provenance) for
   `activities.json`, with a test that every reference resolves and every
   position is on a covered cell.
2. Developer Y: parser and validation (`src/features/datasets/scienceActivities.ts`),
   a synthetic fixture, then the objective/equipment selector, activity cards,
   add-to-route, report sections and mission-file support, in that order, each
   in its own PR.
3. Registry: add `scienceActivitiesUrl` to the dataset entry once the file exists,
   as was done for `scienceTargetsUrl`.

## Developer B revision: orbital candidates and area evidence

These rules extend the original point-only draft. They describe capabilities,
not new findings or approval of any particular orbital target.

### Evidence footprints

All coordinates use the terrain source CRS in metres. These are custom contract
objects, not RFC 7946 GeoJSON. Never interpret them as Earth longitude/latitude.

- Point: `{ "type": "point", "position": { "x", "y", "basis", "uncertaintyMeters" } }`.
  Reuse the existing rover-proxy meaning for APXS; record position sol separately
  from measurement sol when available. Never estimate missing uncertainty.
- Area: `{ "type": "area", "ring": [[x,y], ...], "basis": "reviewed-orbital-footprint",
  "uncertaintyMeters": null, "nativeResolutionMeters": number,
  "geometrySource": { "productId", "method", "sources": [...] } }`.
  Geologic map features use `basis: "reviewed-map-footprint"` instead.
  A simple closed polygon with at least three distinct vertices is sufficient
  for the initial version; no holes or multipolygons. Reject nonfinite values,
  self-intersections and zero-area rings. Preserve original source/feature IDs
  and geometry/clip history in provenance. Mapping scale and spectral interpretation
  remain recorded separately; resampling does not improve native resolution.

Evidence must intersect covered terrain. An area must be explicitly clipped to
the package footprint; uncovered raster cells remain excluded. Never replace an
area by a precise-looking point or infer its shape from a browse-image rectangle.

### Access points and coverage

`access.evidenceId` must be among the activity's `evidenceIds`. A point-based
follow-up uses its associated source position. An area-based activity uses a
reviewed access point inside the evidence polygon and on covered terrain.
`selectionBasis` is `associated-rover-position` or `reviewed-area-access`.

The parser validates source location, snapped cell and finite elevation/slope.
For an area, also test the snapped cell centre against the polygon; if snapping
would leave the evidence area, refuse that activity as unavailable. Do not
silently choose a centroid or move the scientific point to a nearby valid cell.
These are coverage tests. Reachability is evaluated separately using the current
start, slope settings and route algorithm; a covered cell may be unreachable.

### Interpretation and visit history

- `historical-follow-up` requires a surface mission record or published sample
  finding supporting its question. APXS detection alone does not prove layering
  or a mineral; those claims require separate imagery/mineralogy evidence.
- `orbital-candidate` requires reviewed orbital image, spectrum or geologic-map
  evidence. A published spectral interpretation may support a mineral indicator;
  an unreviewed bright pixel or RGB color is insufficient.
- Use the short UI category "Orbital candidate". Do not label a candidate
  "unvisited" or "no mission has been here" from distance to the traverse.
  Remote observations are not visits, and an incomplete traverse cannot prove
  absence. If visit history is later added, make its source coverage explicit.
- No automatic novelty or science-value score. No extrapolated mineral maps
  from APXS points. Additional orbital layers are optional inputs, not dependencies
  of all historical suggestions.

### Selection, timing and persistence

Keep selected activity IDs in a separate selection model keyed by collection ID
and activity ID. Several activities may share one routing cell. Reuse one waypoint
for that cell without losing any selected activities or their evidence. Removing
an activity does not remove other activities at the same stop; removing its waypoint
removes its route associations. Removing the last activity also removes a stop
created by suggestions; manually created or pre-existing observation stops remain.
Persist the optional `createdWaypoint` flag in selection records and transfer
ownership when activities share a generated stop. Legacy missing flags mean
unknown ownership, so the stop is preserved. Distinct objectives/equipment choices filter the
list without deleting already selected activities.

Moving an activity waypoint preserves the original evidence/access coordinates
and explicitly records relocation in details/reports. Do not claim the proposed
experiment still occurs inside its evidence area after relocation.

Initial activity durations are null. The user's time-per-stop applies once to a
physical stop, not once per activity. No activity-time model or new EVA arithmetic
is required in the first iteration. Future activity timing must replace or augment
that stop-time rule explicitly, never double-count it.

Mission format v2 stores a full collection snapshot (including its ID), collection SHA-256, terrain binding,
objective/equipment selections and selected-activity/evidence snapshots linked to
waypoint IDs. Retain legacy v1 import and ordinary APXS/mineral origins. Old v1
missions migrate in memory with an empty activity selection; no stored file is
rewritten merely by loading. Old builds may reject v2 exports clearly.

Reports distinguish proposed activities from supporting historical/orbital evidence,
retain original source geometry/access and moved-waypoint state, and include
scenario equipment/timing inputs. Routing still consumes only waypoints and terrain.

The current `WaypointOrigin.position` remains rover-proxy-only. Activity evidence
and access geometry are retained in `sciencePlan`, independently of the existing
origin sidecar. Several activities may refer to the same waypoint order. Report
JSON carries that snapshot additively; its existing report format remains v1.
The current local implementation includes point activities and two reviewed orbital
imaging polygons. See the v2 and v3 source reviews for delivered evidence and limits.

### First-delivery choices

One independent collection per terrain version; historical activities first.
Start with imaging/comparison objectives and a camera/magnifier as explicitly
scenario-assumption equipment. Exclude low-quality, failed-preparation and handled
sample/dump records in the initial candidate set. Durations stay null. Review must
record the actual reviewer and date after sources, positions, rationale and links
have been checked. Do not pre-mark examples reviewed. Orbital activities remain
undelivered until an individual source feature passes that same review.


### Optional sampling fields (local v3 collection)

Contract version remains 1. An activity may have `experimentType: photography | rock-sampling`
and `procedure: { steps: string[], outcome: string, sources: TargetSource[] }`.
Legacy collections may omit both. Unknown experiment types are rejected. Procedures
require nonempty steps/outcome and valid source links; real collections require
at least one procedure source. Rock-sampling activities require a procedure and
nonempty resolvable equipment requirements. These fields are retained in full
mission/report snapshots; the UI and printable report show collection steps separately
from historical evidence. A proposed procedure is not a historical measurement.
See [the sampling source review](terrain/rock-sampling-v3.md).

Area rings are limited to 512 coordinate pairs, including the repeated closing
coordinate, before intersection checks. More detailed source geometry must be
reviewed and simplified offline rather than freezing the browser during import.
