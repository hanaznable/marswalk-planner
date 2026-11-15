# Science Activity Contract (v1) — proposal

**Status:** Draft by Developer Y for review by Developer B. Nothing here is
implemented, and no UI work starts until the decisions marked **(B)** below are
agreed. Once agreed, this file becomes `docs/science-activity-contract.md`.

Builds on the [science target contract](science-target-contract.md), the
[display context contract](display-context-contract.md) and Developer B's
[observation research](terrain/science-expansion-research.md).

## Goal

Let a user plan an EVA around a science question:

1. Choose a **science objective** and the **equipment** available.
2. See **suggested activities** that fit, each showing the **historical evidence**
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
`public/data/science/pahrump-hills-v1/activities.json` (plus `provenance.json`,
as for targets). It is bound to the exact terrain version, like the target
collection.

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
      "position": { "x": 0, "y": 0, "uncertaintyMeters": null, "basis": "rover-position-proxy" },
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
      "objectiveIds": ["sedimentary-textures"],
      "evidenceIds": ["apxs-pelona"],
      "requiredEquipmentIds": ["hand-lens-camera"],
      "location": { "evidenceId": "apxs-pelona" },
      "rationale": "<why we suggest it, linked to the evidence; clearly our suggestion>",
      "limitations": ["<what is unknown: e.g. exact outcrop position, access, safety>"],
      "durationMinutes": null,
      "durationSource": null,
      "review": { "status": "reviewed", "by": "Developer B", "date": "2026-11-20" }
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

The UI labels scenario-assumption equipment as "planning assumption, not a
specified suit or tool capability".

### Evidence

| Field | Rule |
|---|---|
| `kind` | `apxs-measurement`, `chemcam-observation`, `chemin-mineralogy`, `image-observation` (Mastcam/MAHLI), `drill-sample`. Later: `orbital-indicator` (for example CRISM), only after its own layer review. |
| `statement` | What the source says, without interpretation. A mineral is named only when a mineralogy source (for example CheMin) identifies it. APXS chemistry is never turned into a mineral claim. |
| `sol` | The measurement or activity sol stated by the source, or `null`. Kept separate from the rover-position sol, as in the target contract. |
| `position` | Same rules as science targets: source CRS metres, a required `basis`, and `uncertaintyMeters` only when a source states it. |
| `links` | Optional ties to an existing `targets.json` id or a `context.json` APXS `recordId`, so the map can show one marker instead of duplicates. |
| `productIds`, `qualityFlags` | Exact archive identifiers and the source's own quality flags (for example low-quality spectrum, sample handling). |
| `sources` | At least one. |

### Activities

| Field | Rule |
|---|---|
| `objectiveIds`, `evidenceIds`, `requiredEquipmentIds` | Each must refer to an entry in the same file. At least one objective and one evidence entry. |
| `location` | Normally `{ "evidenceId": ... }`: the activity happens at that evidence position. Alternative: `{ "x", "y", "basis" }` with a separate justification. The app snaps it to a routing cell, exactly like a target. |
| `rationale` | Our suggestion and why. Must point to its evidence; must not state new findings. |
| `limitations` | At least one. For example: proxy position, unverified access, no safety assessment. |
| `durationMinutes` | `null` unless a source states a duration for a comparable activity, in which case `durationSource` cites it. When `null`, the planner uses the user's own "time per stop" setting, as now. |
| `review` | Only `reviewed` activities are shown in the normal UI. `draft` entries are refused by the app. |

## What the app will do (Developer Y)

1. **Choose:** the user picks one objective and ticks the equipment available.
2. **List:** the app shows activities whose objective matches and whose required
   equipment is all available, plus a separate list of activities that would
   need equipment the user did not tick. Order: by straight-line or route
   distance from the current start, which the app computes and labels as
   distance only. There is no hidden score.
3. **Inspect:** each activity card shows the suggestion and rationale (labelled
   "Suggested activity"), then its evidence (labelled "Historical evidence",
   with sources, sols, quality flags and the position caveat), then its
   limitations.
4. **Add to route:** adds a waypoint at the activity's cell, with a new
   `WaypointOrigin` kind `suggested-activity` that records the activity id, its
   objective and evidence ids, and the collection id.
5. **Evaluate:** the existing routes, EVA estimate and report are recalculated.
   The mission report gets two separate sections: "Suggested activities (this
   project's proposals)" and "Historical evidence used".
6. **Save:** saved missions record the activity collection id. Opening a mission
   with another activity collection version opens with a warning, as for science
   targets.
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
| 10 | Mission files | `WaypointOrigin` gains the kind `suggested-activity`. Mission format stays version 1. Older app builds will refuse a mission that uses the new kind, which is acceptable for the prototype. |

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
